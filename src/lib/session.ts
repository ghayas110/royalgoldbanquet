import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';
import { can, effectiveCan, isAdminRole } from './permissions';
import type { Permission, Role } from './types';

export interface SessionUser {
  id: number;
  name?: string | null;
  email?: string | null;
  role: Role;
  permissions: Permission[];
  /** Per-device session id — identifies which device this request came from. */
  sid?: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser) ?? null;
}

/** For pages/layouts — redirect to /login if unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Super Admins implicitly hold every permission, and Owners hold every
 * permission except the Live Cooking ones (robust against stale JWTs).
 * See `effectiveCan` in permissions.ts for why Live Cooking is carved out.
 */
export function hasPermission(user: { role: Role; permissions: Permission[] }, perm: Permission): boolean {
  return effectiveCan(user.role, user.permissions, perm);
}

/** Guard a page by permission — redirect to dashboard if missing. */
export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, perm)) redirect('/app?denied=' + perm);
  return user;
}

/**
 * Owner-only gate for irreversible operations (bulk deletes, factory reset).
 * Deliberately checks the ROLE, not a permission: permissions can be granted
 * to a manager, but destroying the whole dataset must never be delegable.
 * Super Admin ranks above Owner, so it passes the same gate.
 */
export async function assertOwner(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('Not authenticated');
  if (!isAdminRole(user.role)) throw new Error('Only the owner can perform this action.');
  return user;
}

/**
 * Super-Admin-only gate, for the places where "the Owner can do anything"
 * must NOT hold.
 */
export async function assertSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('Not authenticated');
  if (user.role !== 'SUPER_ADMIN') throw new Error('Only a Super Admin can perform this action.');
  return user;
}

/** For server actions — throw instead of redirect. */
export async function assertPermission(perm: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('Not authenticated');
  if (!hasPermission(user, perm)) throw new Error(`Missing permission: ${perm}`);
  return user;
}

export { can, effectiveCan, isAdminRole };
