'use server';

/**
 * Signed-in device management.
 *
 * Sessions use the JWT strategy, so there is no server-side session store by
 * default. `user_sessions` gives us one: a row per device, keyed by the `sid`
 * minted into the token at sign-in. Revoking a row makes the jwt callback
 * reject that token on its next check, which signs that device out.
 */

import { headers } from 'next/headers';
import { query, execute } from '@/lib/db';
import { getSessionUser, requireUser, hasPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type DeviceRow = {
  id: number;
  sid: string;
  deviceLabel: string;
  /** Owner-supplied name, when one has been set. */
  customLabel: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  /**
   * Seconds since this device was last seen, measured by MySQL. Sent instead of
   * a timestamp because `last_seen_at` has no timezone, so the browser cannot
   * safely diff it against its own clock.
   */
  secondsAgo: number;
  current: boolean;
  /** Who is signed in on it — populated on the all-users view. */
  userId?: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
};

/** Turn a raw user-agent into something a non-technical owner can recognise. */
function describe(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const s = ua.toLowerCase();

  let os = 'Unknown';
  if (/iphone/.test(s)) os = 'iPhone';
  else if (/ipad/.test(s)) os = 'iPad';
  else if (/android/.test(s)) os = 'Android';
  else if (/windows/.test(s)) os = 'Windows';
  else if (/mac os x|macintosh/.test(s)) os = 'Mac';
  else if (/linux/.test(s)) os = 'Linux';

  let browser = '';
  // Order matters — Edge and Chrome both contain "chrome" etc.
  if (/edg\//.test(s)) browser = 'Edge';
  else if (/opr\/|opera/.test(s)) browser = 'Opera';
  else if (/chrome|crios/.test(s)) browser = 'Chrome';
  else if (/firefox|fxios/.test(s)) browser = 'Firefox';
  else if (/safari/.test(s)) browser = 'Safari';

  return browser ? `${os} · ${browser}` : os;
}

/**
 * Records the current device against the signed-in session. Called from the
 * client once after login (and on app load) because the user agent and IP are
 * not available inside the NextAuth jwt callback.
 */
export async function touchDevice(userAgent?: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  const sid = user?.sid;
  if (!user || !sid) return { ok: false };

  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get('x-forwarded-for')?.split(',')[0].trim()
      ?? h.get('x-real-ip')
      ?? null;
  } catch { /* headers unavailable — not worth failing over */ }

  const ua = (userAgent ?? '').slice(0, 400) || null;
  try {
    await execute(
      `INSERT INTO user_sessions (user_id, sid, user_agent, device_label, ip)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         user_agent   = COALESCE(VALUES(user_agent), user_agent),
         device_label = COALESCE(VALUES(device_label), device_label),
         ip           = COALESCE(VALUES(ip), ip),
         last_seen_at = NOW()`,
      [user.id, sid, ua, describe(ua), ip],
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Every device this user is currently signed in on. */
export async function getMyDevices(): Promise<DeviceRow[]> {
  const user = await requireUser();
  const rows = await query<any>(
    `SELECT id, sid, user_agent, device_label, custom_label, ip, created_at, last_seen_at,
            TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS seconds_ago
       FROM user_sessions
      WHERE user_id = ? AND revoked_at IS NULL
      ORDER BY last_seen_at DESC`,
    [user.id],
  );
  return rows.map((r: any) => map(r, user.sid));
}

/** Shared row shape; `custom_label` wins so a renamed device keeps its name. */
function map(r: any, currentSid?: string): DeviceRow {
  return {
    id: r.id,
    sid: r.sid,
    deviceLabel: r.custom_label || r.device_label || describe(r.user_agent),
    customLabel: r.custom_label ?? null,
    userAgent: r.user_agent,
    ip: r.ip,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    secondsAgo: Math.max(0, Number(r.seconds_ago ?? 0)),
    current: r.sid === currentSid,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    userRole: r.user_role,
  };
}

/**
 * Every device signed in across the whole portal — the owner's view of who
 * else is using it. Gated on `users.manage`, since it exposes other people's
 * sessions; a plain user only ever sees their own via getMyDevices().
 */
export async function getAllDevices(): Promise<DeviceRow[]> {
  const user = await requireUser();
  if (!hasPermission(user, 'users.manage')) return [];
  const rows = await query<any>(
    `SELECT s.id, s.sid, s.user_agent, s.device_label, s.custom_label, s.ip,
            s.created_at, s.last_seen_at, s.user_id,
            TIMESTAMPDIFF(SECOND, s.last_seen_at, NOW()) AS seconds_ago,
            u.name AS user_name, u.email AS user_email, u.role AS user_role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL
      ORDER BY s.last_seen_at DESC`,
  );
  return rows.map((r: any) => map(r, user.sid));
}

/**
 * Rename a device. Owners/admins may rename anyone's; everyone else only their
 * own — which is what turns "Unknown device" into "Reception iPad".
 */
export async function renameDevice(
  sid: string, label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const name = label.trim().slice(0, 120);

  const owned = await query<any>(`SELECT user_id FROM user_sessions WHERE sid = ?`, [sid]);
  if (owned.length === 0) return { ok: false, error: 'That device is no longer signed in.' };
  const isMine = owned[0].user_id === user.id;
  if (!isMine && !hasPermission(user, 'users.manage')) {
    return { ok: false, error: 'You can only rename your own devices.' };
  }

  // Empty string clears the override and falls back to the detected label.
  await execute(`UPDATE user_sessions SET custom_label = ? WHERE sid = ?`, [name || null, sid]);
  await audit({ userId: user.id, action: 'RENAME_DEVICE', entity: 'user_session', after: { sid, label: name } });
  revalidatePath('/app/account');
  return { ok: true };
}

/** Sign a single device out. */
export async function revokeDevice(sid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  // Own devices always; anyone else's only with users.manage.
  const admin = hasPermission(user, 'users.manage');
  const res = await execute(
    admin
      ? `UPDATE user_sessions SET revoked_at = NOW() WHERE sid = ? AND revoked_at IS NULL`
      : `UPDATE user_sessions SET revoked_at = NOW() WHERE sid = ? AND user_id = ? AND revoked_at IS NULL`,
    admin ? [sid] : [sid, user.id],
  );
  if (res.affectedRows === 0) return { ok: false, error: 'That device is already signed out.' };
  await audit({ userId: user.id, action: 'REVOKE_DEVICE', entity: 'user_session', after: { sid } });
  revalidatePath('/app/account');
  return { ok: true };
}

/** Sign out everywhere except the device making the request. */
export async function revokeOtherDevices(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.sid) return { ok: false, error: 'Current device could not be identified.' };
  const res = await execute(
    `UPDATE user_sessions SET revoked_at = NOW()
      WHERE user_id = ? AND sid <> ? AND revoked_at IS NULL`,
    [user.id, user.sid],
  );
  await audit({ userId: user.id, action: 'REVOKE_DEVICES', entity: 'user_session', after: { count: res.affectedRows } });
  revalidatePath('/app/account');
  return { ok: true, count: res.affectedRows };
}
