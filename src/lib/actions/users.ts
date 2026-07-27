'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { ALL_PERMISSIONS, ROLE_DEFAULTS } from '@/lib/types';
import type { UserRow } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const roleEnum = z.enum(['OWNER', 'MANAGER', 'VIEWER']);
const permsSchema = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional();

const createSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
  role: roleEnum,
  permissions: permsSchema,
});

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createUser(input: unknown): Promise<ActionResult> {
  const actor = await assertPermission('users.manage');
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, email, password, role, permissions } = parsed.data;

  const existing = await queryOne<UserRow>(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase()]);
  if (existing) return { ok: false, error: 'A user with that email already exists.' };

  const hash = await bcrypt.hash(password, 10);
  // Only store a permissions override if it differs from the role default.
  const permsJson = permissions && !sameSet(permissions, ROLE_DEFAULTS[role]) ? JSON.stringify(permissions) : null;

  const res = await execute(
    `INSERT INTO users (name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,1)`,
    [name, email.toLowerCase(), hash, role, permsJson],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'user', entityId: res.insertId, after: { name, email, role, permissions: permsJson } });
  revalidatePath('/app/users');
  return { ok: true, message: `${name} created.` };
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(2),
  role: roleEnum,
  permissions: permsSchema,
});

export async function updateUser(input: unknown): Promise<ActionResult> {
  const actor = await assertPermission('users.manage');
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { id, name, role, permissions } = parsed.data;

  const before = await queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'User not found.' };

  const permsJson = permissions && !sameSet(permissions, ROLE_DEFAULTS[role]) ? JSON.stringify(permissions) : null;
  await execute(`UPDATE users SET name = ?, role = ?, permissions = ? WHERE id = ?`, [name, role, permsJson, id]);
  await audit({
    userId: actor.id, action: 'UPDATE', entity: 'user', entityId: id,
    before: { name: before.name, role: before.role, permissions: before.permissions },
    after: { name, role, permissions: permsJson },
  });
  revalidatePath('/app/users');
  return { ok: true, message: 'User updated.' };
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
