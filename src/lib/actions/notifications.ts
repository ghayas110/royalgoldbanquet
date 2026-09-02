'use server';

/**
 * Notification bell + browser push subscription management.
 *
 * The bell reads `notifications` with a per-user read marker; push endpoints
 * live in `push_subscriptions`, one row per browser that granted permission.
 */

import { z } from 'zod';
import { query, execute, toInt } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getVapidPublicKey as readVapidPublicKey } from '@/lib/notify';
import { revalidatePath } from 'next/cache';

export interface NotificationItem {
  id: number;
  type: 'BOOKING' | 'ENQUIRY' | 'LEAD' | 'PAYMENT' | 'REVIEW';
  title: string;
  body: string | null;
  url: string | null;
  /** Seconds since it was raised, measured by MySQL — see devices.ts for why. */
  secondsAgo: number;
  read: boolean;
}

/** Most recent alerts, newest first, with this user's read state. */
export async function getMyNotifications(limit = 20): Promise<NotificationItem[]> {
  const user = await requireUser();
  const rows = await query<any>(
    `SELECT n.id, n.type, n.title, n.body, n.url,
            TIMESTAMPDIFF(SECOND, n.created_at, NOW()) AS seconds_ago,
            r.user_id IS NOT NULL AS is_read
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      ORDER BY n.id DESC
      LIMIT ${toInt(limit, 20)}`,
    [user.id],
  );
  return rows.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    url: n.url ?? null,
    secondsAgo: Math.max(0, Number(n.seconds_ago ?? 0)),
    read: !!Number(n.is_read),
  }));
}

/** Drives the badge on the bell. Called on a poll, so kept as cheap as possible. */
export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      WHERE r.user_id IS NULL`,
    [user.id],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function markRead(id: number): Promise<{ ok: true }> {
  const user = await requireUser();
  await execute(
    `INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?,?)`,
    [id, user.id],
  );
  return { ok: true };
}

export async function markAllRead(): Promise<{ ok: true; count: number }> {
  const user = await requireUser();
  const res = await execute(
    `INSERT IGNORE INTO notification_reads (notification_id, user_id)
     SELECT n.id, ? FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      WHERE r.user_id IS NULL`,
    [user.id, user.id],
  );
  return { ok: true, count: res.affectedRows };
}

/** The browser needs this to create a subscription. Safe to expose. */
export async function getVapidPublicKey(): Promise<string> {
  await requireUser();
  return readVapidPublicKey();
}

const subSchema = z.object({
  endpoint: z.string().url().max(500),
  keys: z.object({
    p256dh: z.string().min(10).max(255),
    auth: z.string().min(5).max(255),
  }),
  deviceLabel: z.string().trim().max(120).optional(),
});

/** Register this browser for push. Re-subscribing just refreshes the keys. */
export async function subscribePush(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That subscription looks invalid.' };
  const { endpoint, keys, deviceLabel } = parsed.data;

  await execute(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       device_label = COALESCE(VALUES(device_label), device_label)`,
    [user.id, endpoint, keys.p256dh, keys.auth, deviceLabel ?? null],
  );
  revalidatePath('/app/account');
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<{ ok: true }> {
  const user = await requireUser();
  await execute(
    `DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`,
    [endpoint, user.id],
  );
  revalidatePath('/app/account');
  return { ok: true };
}

/** True when this exact browser is already registered. */
export async function isPushSubscribed(endpoint: string): Promise<boolean> {
  const user = await requireUser();
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`,
    [endpoint, user.id],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/**
 * Sends a test alert to this user's own devices, so the owner can confirm the
 * whole chain works without waiting for a real booking.
 */
export async function sendTestNotification(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const subs = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?`, [user.id],
  );
  if (Number(subs[0]?.n ?? 0) === 0) {
    return { ok: false, error: 'Turn on notifications for this device first.' };
  }
  // Pushed straight to this user's own devices: a test must not land in
  // everyone else's bell or on their phones.
  const { sendPush } = await import('@/lib/notify');
  await sendPush([user.id], {
    title: 'Skylight Ballroom & Catering — test alert',
    body: 'Notifications are working. New bookings and enquiries will appear like this.',
    url: '/app',
    tag: 'test',
  });
  return { ok: true };
}
