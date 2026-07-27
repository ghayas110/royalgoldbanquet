'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type AttResult = { ok: true; message?: string } | { ok: false; error: string };

// ── Employees ──────────────────────────────────────────
const empSchema = z.object({
  name: z.string().min(2, 'Name required').max(120),
  phone: z.string().max(40).optional().nullable(),
  designation: z.string().max(80).default('Staff'),
  monthlySalary: z.number().min(0).max(9999999).default(0),
});

export async function createEmployee(input: unknown): Promise<AttResult> {
  const actor = await assertPermission('employees.manage');
  const parsed = empSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, phone, designation, monthlySalary } = parsed.data;
  const res = await execute(`INSERT INTO employees (name, phone, designation, monthly_salary, is_active) VALUES (?,?,?,?,1)`,
    [name, phone || null, designation, monthlySalary]);
  await audit({ userId: actor.id, action: 'CREATE', entity: 'employee', entityId: res.insertId, after: { name, designation } });
  revalidatePath('/app/attendance');
  return { ok: true, message: `${name} added.` };
}

export async function updateEmployee(id: number, input: unknown): Promise<AttResult> {
  const actor = await assertPermission('employees.manage');
  const parsed = empSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, phone, designation, monthlySalary } = parsed.data;
  await execute(`UPDATE employees SET name=?, phone=?, designation=?, monthly_salary=? WHERE id=?`,
    [name, phone || null, designation, monthlySalary, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'employee', entityId: id, after: { name, designation } });
  revalidatePath('/app/attendance');
  return { ok: true, message: 'Employee updated.' };
}

export async function setEmployeeActive(id: number, active: boolean): Promise<AttResult> {
  const actor = await assertPermission('employees.manage');
  await execute(`UPDATE employees SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: active ? 'ACTIVATE' : 'DEACTIVATE', entity: 'employee', entityId: id });
  revalidatePath('/app/attendance');
  return { ok: true };
}

// ── Attendance marking ─────────────────────────────────
const markSchema = z.object({
  employeeId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']),
});

export async function markAttendance(input: unknown): Promise<AttResult> {
  const actor = await assertPermission('attendance.mark');
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { employeeId, date, status } = parsed.data;
  await execute(
    `INSERT INTO attendance (employee_id, att_date, status, marked_by) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)`,
    [employeeId, date, status, actor.id],
  );
  return { ok: true };
}

/** Mark all active employees PRESENT for a day (quick action). */
export async function markAllPresent(date: string): Promise<AttResult> {
  const actor = await assertPermission('attendance.mark');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Bad date.' };
  await execute(
    `INSERT INTO attendance (employee_id, att_date, status, marked_by)
       SELECT id, ?, 'PRESENT', ? FROM employees WHERE is_active = 1
     ON DUPLICATE KEY UPDATE status = 'PRESENT'`,
    [date, actor.id],
  );
  await audit({ userId: actor.id, action: 'MARK_ALL_PRESENT', entity: 'attendance', entityId: date });
  revalidatePath('/app/attendance');
  return { ok: true, message: 'All marked present.' };
}
