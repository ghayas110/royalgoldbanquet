'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { ALL_PERMISSIONS, ALL_ROLES, ROLE_DEFAULTS } from '@/lib/types';
import type { Role } from '@/lib/types';
import type { UserRow } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// Cast keeps the parsed value narrowed to `Role`, so ROLE_DEFAULTS[role] type-checks.
const roleEnum = z.enum(ALL_ROLES as [Role, ...Role[]]);
const permsSchema = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional();

/**
 * How this account relates to the payroll:
 *  - `none`     login only (default) — never appears in Attendance;
 *  - `link`     attach to an existing staff record (`employeeId`);
 *  - `create`   make a new staff record from `designation` + `monthlySalary`.
 */
const staffSchema = z.object({
  mode: z.enum(['none', 'link', 'create']).default('none'),
  employeeId: z.number().int().positive().nullable().optional(),
  designation: z.string().trim().max(80).optional(),
  monthlySalary: z.number().min(0).optional(),
  phone: z.string().trim().max(40).optional(),
}).optional();

const createSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
  role: roleEnum,
  permissions: permsSchema,
  staff: staffSchema,
});

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createUser(input: unknown): Promise<ActionResult> {
  const actor = await assertPermission('users.manage');
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, email, password, role, permissions, staff } = parsed.data;

  const existing = await queryOne<UserRow>(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase()]);
  if (existing) return { ok: false, error: 'A user with that email already exists.' };

  const linked = await resolveStaffLink(staff, name, null);
  if (!linked.ok) return linked;

  const hash = await bcrypt.hash(password, 10);
  // Only store a permissions override if it differs from the role default.
  const permsJson = permissions && !sameSet(permissions, ROLE_DEFAULTS[role]) ? JSON.stringify(permissions) : null;

  const res = await execute(
    `INSERT INTO users (name, email, password_hash, role, permissions, employee_id, is_active) VALUES (?,?,?,?,?,?,1)`,
    [name, email.toLowerCase(), hash, role, permsJson, linked.employeeId],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'user', entityId: res.insertId, after: { name, email, role, permissions: permsJson, employeeId: linked.employeeId } });
  revalidatePath('/app/users');
  revalidatePath('/app/attendance');
  return {
    ok: true,
    message: linked.employeeId ? `${name} created and added to staff.` : `${name} created.`,
  };
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(2),
  role: roleEnum,
  permissions: permsSchema,
  staff: staffSchema,
});

export async function updateUser(input: unknown): Promise<ActionResult> {
  const actor = await assertPermission('users.manage');
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { id, name, role, permissions, staff } = parsed.data;

  const before = await queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'User not found.' };

  const linked = await resolveStaffLink(staff, name, before.employee_id ?? null);
  if (!linked.ok) return linked;

  const permsJson = permissions && !sameSet(permissions, ROLE_DEFAULTS[role]) ? JSON.stringify(permissions) : null;
  await execute(
    `UPDATE users SET name = ?, role = ?, permissions = ?, employee_id = ? WHERE id = ?`,
    [name, role, permsJson, linked.employeeId, id],
  );
  await audit({
    userId: actor.id, action: 'UPDATE', entity: 'user', entityId: id,
    before: { name: before.name, role: before.role, permissions: before.permissions, employeeId: before.employee_id ?? null },
    after: { name, role, permissions: permsJson, employeeId: linked.employeeId },
  });
  revalidatePath('/app/users');
  revalidatePath('/app/attendance');
  return { ok: true, message: 'User updated.' };
}

/**
 * Works out which `employees.id` (if any) this account should point at.
 *
 * Unlinking never deletes the staff record — attendance and salary history hang
 * off it, so the row stays and only the pointer is cleared.
 */
async function resolveStaffLink(
  staff: { mode: 'none' | 'link' | 'create'; employeeId?: number | null; designation?: string; monthlySalary?: number; phone?: string } | undefined,
  userName: string,
  currentEmployeeId: number | null,
): Promise<{ ok: true; employeeId: number | null } | { ok: false; error: string }> {
  const mode = staff?.mode ?? 'none';

  if (mode === 'none') return { ok: true, employeeId: null };

  if (mode === 'link') {
    const empId = staff?.employeeId ?? null;
    if (!empId) return { ok: false, error: 'Choose a staff member to link to.' };
    const emp = await queryOne<{ id: number }>(`SELECT id FROM employees WHERE id = ?`, [empId]);
    if (!emp) return { ok: false, error: 'That staff record no longer exists.' };
    // Already ours — nothing to check.
    if (currentEmployeeId !== empId) {
      const taken = await queryOne<{ name: string }>(
        `SELECT name FROM users WHERE employee_id = ?`, [empId],
      );
      if (taken) return { ok: false, error: `That staff record is already linked to ${taken.name}.` };
    }
    return { ok: true, employeeId: empId };
  }

  // mode === 'create' — but if this user already has a record, update it in
  // place rather than orphaning the existing attendance history.
  const designation = staff?.designation?.trim() || 'Staff';
  const salary = staff?.monthlySalary ?? 0;
  const phone = staff?.phone?.trim() || null;

  if (currentEmployeeId) {
    await execute(
      `UPDATE employees SET name = ?, designation = ?, monthly_salary = ?, phone = ? WHERE id = ?`,
      [userName, designation, salary, phone, currentEmployeeId],
    );
    return { ok: true, employeeId: currentEmployeeId };
  }

  const res = await execute(
    `INSERT INTO employees (name, designation, monthly_salary, phone, joined_date, is_active)
     VALUES (?,?,?,?,CURDATE(),1)`,
    [userName, designation, salary, phone],
  );
  return { ok: true, employeeId: res.insertId };
}

export async function setUserActive(id: number, active: boolean): Promise<ActionResult> {
  const actor = await assertPermission('users.manage');
  if (actor.id === id && !active) return { ok: false, error: 'You cannot deactivate your own account.' };
  const before = await queryOne<UserRow>(`SELECT id, is_active FROM users WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'User not found.' };
  await execute(`UPDATE users SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: active ? 'ACTIVATE' : 'DEACTIVATE', entity: 'user', entityId: id });
  revalidatePath('/app/users');
  return { ok: true };
}

export async function resetPassword(id: number, password: string): Promise<ActionResult> {
  const actor = await assertPermission('users.manage');
  if (password.length < 6) return { ok: false, error: 'Min 6 characters.' };
  const hash = await bcrypt.hash(password, 10);
  await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, id]);
  await audit({ userId: actor.id, action: 'RESET_PASSWORD', entity: 'user', entityId: id });
  return { ok: true, message: 'Password reset.' };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}
