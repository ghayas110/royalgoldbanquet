import { requirePermission } from '@/lib/session';
import { query } from '@/lib/db';
import { resolvePermissions } from '@/lib/permissions';
import { ALL_ROLES, type UserRow } from '@/lib/types';
import { UsersClient } from './users-client';

export const metadata = { title: 'Users — Skylight Ballroom & Catering' };

export default async function UsersPage() {
  await requirePermission('users.manage');
  // FIELD(role, …) sorts by seniority; a plain ORDER BY role would use the
  // ENUM's declaration order, which no longer matches how we want them listed.
  const [rows, staff] = await Promise.all([
    query<UserRow & { employee_name: string | null; designation: string | null; monthly_salary: string | null }>(
      `SELECT u.*, e.name AS employee_name, e.designation, e.monthly_salary
         FROM users u
         LEFT JOIN employees e ON e.id = u.employee_id
        ORDER BY FIELD(u.role, ${ALL_ROLES.map((r) => `'${r}'`).join(',')}), u.name`,
    ),
    query<any>(
      `SELECT e.id, e.name, e.designation, e.monthly_salary, u.name AS linked_to
         FROM employees e
         LEFT JOIN users u ON u.employee_id = e.id
        WHERE e.is_active = 1
        ORDER BY e.name`,
    ),
  ]);

  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    is_active: u.is_active === 1,
    permissions: resolvePermissions(u.role, u.permissions),
    hasOverride: !!u.permissions,
    employeeId: u.employee_id ?? null,
    employeeName: u.employee_name ?? null,
    designation: u.designation ?? null,
    monthlySalary: u.monthly_salary != null ? Number(u.monthly_salary) : null,
  }));

  const staffOptions = staff.map((e: any) => ({
    id: e.id,
    name: e.name,
    designation: e.designation ?? '',
    salary: Number(e.monthly_salary ?? 0),
    linkedTo: e.linked_to ?? null,
  }));

  return <UsersClient users={users} staffOptions={staffOptions} />;
}
