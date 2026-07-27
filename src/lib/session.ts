import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';
import { can } from './permissions';
import type { Permission, Role } from './types';

export interface SessionUser {
  id: number;
  name?: string | null;
  email?: string | null;
  role: Role;
  permissions: Permission[];
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

/** Owners implicitly hold every permission (robust against stale JWTs). */
export function hasPermission(user: { role: Role; permissions: Permission[] }, perm: Permission): boolean {
  return user.role === 'OWNER' || can(user.permissions, perm);
}

/** Guard a page by permission — redirect to dashboard if missing. */
export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, perm)) redirect('/app?denied=' + perm);
  return user;
}

/** For server actions — throw instead of redirect. */
export async function assertPermission(perm: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('Not authenticated');
  if (!hasPermission(user, perm)) throw new Error(`Missing permission: ${perm}`);
  return user;
}

export { can };
