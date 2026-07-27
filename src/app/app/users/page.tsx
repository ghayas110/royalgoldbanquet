import { requirePermission } from '@/lib/session';
import { query } from '@/lib/db';
import { resolvePermissions } from '@/lib/permissions';
import type { UserRow } from '@/lib/types';
import { UsersClient } from './users-client';

export const metadata = { title: 'Users — Royal Gold Banquet' };

export default async function UsersPage() {
  await requirePermission('users.manage');
  const rows = await query<UserRow>(`SELECT * FROM users ORDER BY role, name`);
  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    is_active: u.is_active === 1,
    permissions: resolvePermissions(u.role, u.permissions),
    hasOverride: !!u.permissions,
  }));
  return <UsersClient users={users} />;
}
