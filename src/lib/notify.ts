import webpush from 'web-push';
import { query, queryOne, execute } from './db';
import { getSetting, getBrand } from './data';
import { BRAND_DEFAULTS } from './brand-info';

/**
 * Notification fan-out.
 *
 * Every alert is written to `notifications` (which drives the in-app bell) and
 * then, best-effort, pushed to whichever devices have granted permission. Push
 * is deliberately fire-and-forget: a booking must never fail to save because
 * Google's push endpoint was slow or a subscription had expired.
 */

export type NotificationType = 'BOOKING' | 'ENQUIRY' | 'LEAD' | 'PAYMENT' | 'REVIEW';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  url?: string | null;
  entity?: string | null;
  entityId?: number | null;
  createdBy?: number | null;
  /**
   * Only users holding this permission are pushed to. The row is still written
   * for everyone — the bell menu applies its own visibility rules.
   */
  permission?: string;
}

/**
 * VAPID keys identify this server to the browser push services.
 *
 * Kept in the `settings` table rather than the environment: the owner wants
 * `.env` to hold nothing but DATABASE_URL and NODE_ENV, and these need to
 * survive redeploys — regenerating them would silently invalidate every
 * existing subscription.
 */
async function getVapid(): Promise<{ publicKey: string; privateKey: string } | null> {
  const publicKey = await getSetting('vapid_public_key', '');
  const privateKey = await getSetting('vapid_private_key', '');
  if (publicKey && privateKey) return { publicKey, privateKey };
  return null;
}

/** Creates the keypair on first use and persists it. */
export async function ensureVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await getVapid();
  if (existing) return existing;

  const keys = webpush.generateVAPIDKeys();
  await execute(
    `INSERT INTO settings (\`key\`, value) VALUES ('vapid_public_key', ?), ('vapid_private_key', ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [keys.publicKey, keys.privateKey],
  );
  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await ensureVapid()).publicKey;
}

/** Recipients: active users who can act on this kind of alert. */
async function recipients(permission: string): Promise<number[]> {
  const rows = await query<any>(
    `SELECT id, role, permissions FROM users WHERE is_active = 1`,
  );
  return rows
    .filter((u: any) => {
      if (u.role === 'OWNER' || u.role === 'SUPER_ADMIN') return true;
      // `permissions` is a JSON override; NULL means "use the role defaults",
      // which we can't evaluate here without importing client-side tables, so
      // managers and supervisors are included by role.
      if (!u.permissions) return ['MANAGER', 'SUPERVISOR', 'RECEPTIONIST'].includes(u.role);
      try {
        const list = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions;
        return Array.isArray(list) && list.includes(permission);
      } catch {
        return false;
      }
    })
    .map((u: any) => u.id);
}

/**
 * Raise a notification. Never throws — callers are mutations whose success
 * must not depend on the alert being delivered.
 */
export async function notify(input: NotifyInput): Promise<{ id: number | null }> {
  let id: number | null = null;
  try {
    const res = await execute(
      `INSERT INTO notifications (type, title, body, url, entity, entity_id, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [
        input.type, input.title.slice(0, 200), input.body?.slice(0, 500) ?? null,
        input.url ?? null, input.entity ?? null, input.entityId ?? null,
        input.createdBy ?? null,
      ],
    );
    id = res.insertId;
  } catch (e) {
    console.error('[notify] could not record notification:', e);
    return { id: null };
  }

  // The person who created the booking doesn't need to be told about it.
  try {
    const targets = (await recipients(input.permission ?? 'bookings.view'))
      .filter((uid) => uid !== input.createdBy);
    if (targets.length > 0) {
      await sendPush(targets, {
        title: input.title,
        body: input.body ?? '',
        url: input.url ?? '/app',
        tag: `${input.type}-${input.entityId ?? id}`,
      });
    }
  } catch (e) {
    console.error('[notify] push fan-out failed:', e);
  }

  return { id };
}

interface PushPayload { title: string; body: string; url: string; tag: string }

/**
 * Delivers to every registered device for these users. Expired subs are pruned.
 * Exported so a "send me a test" can target one person without raising an
 * alert in everybody else's bell.
 */
export async function sendPush(userIds: number[], payload: PushPayload): Promise<void> {
  const vapid = await getVapid();
  if (!vapid) return; // nobody has subscribed yet, so no keys exist

  const subs = await query<any>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
      WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
    userIds,
  );
  if (subs.length === 0) return;

  // The mailto is the contact the push services complain to; the saved
  // business email is the right one, with the shipped default as a fallback.
  const brand = await getBrand();
  webpush.setVapidDetails(
    `mailto:${brand.email || BRAND_DEFAULTS.email}`,
    vapid.publicKey,
    vapid.privateKey,
  );

  const body = JSON.stringify(payload);
  const dead: number[] = [];

  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err: any) {
        // 404/410 mean the browser dropped the subscription for good.
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.id);
        else console.error('[notify] push failed:', err?.statusCode ?? err);
      }
    }),
  );

  if (dead.length > 0) {
    await execute(
      `DELETE FROM push_subscriptions WHERE id IN (${dead.map(() => '?').join(',')})`,
      dead,
    ).catch(() => undefined);
  }

  await execute(
    `UPDATE push_subscriptions SET last_used_at = NOW()
      WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
    userIds,
  ).catch(() => undefined);
}

/** Convenience wrapper used by the booking actions. */
export async function notifyBooking(opts: {
  isEnquiry: boolean;
  bookingId: number;
  slipNo: string;
  partyName: string;
  hall: string;
  eventDate: string;
  shift: string;
  amount: number;
  createdBy?: number | null;
}): Promise<void> {
  const kind = opts.isEnquiry ? 'Enquiry' : 'Booking';
  const money = new Intl.NumberFormat('en-PK').format(Math.round(opts.amount));
  await notify({
    type: opts.isEnquiry ? 'ENQUIRY' : 'BOOKING',
    title: `New ${kind.toLowerCase()} — ${opts.partyName}`,
    body: `${opts.hall} · ${opts.eventDate} · ${opts.shift} · Rs. ${money} (${opts.slipNo})`,
    url: `/app/bookings/${opts.bookingId}`,
    entity: 'booking',
    entityId: opts.bookingId,
    createdBy: opts.createdBy ?? null,
    permission: 'bookings.view',
  });
}

export async function notifyLead(opts: {
  leadId: number; name: string; phone: string; eventDate?: string | null; message?: string | null;
}): Promise<void> {
  await notify({
    type: 'LEAD',
    title: `Website enquiry — ${opts.name}`,
    body: [opts.phone, opts.eventDate ? `Event ${opts.eventDate}` : null, opts.message]
      .filter(Boolean).join(' · ').slice(0, 500),
    url: '/app/leads',
    entity: 'lead',
    entityId: opts.leadId,
    permission: 'leads.view',
  });
}

/** Used by the settings page to show whether push has ever been configured. */
export async function pushSubscriberCount(): Promise<number> {
  const row = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM push_subscriptions`);
  return Number(row?.n ?? 0);
}
