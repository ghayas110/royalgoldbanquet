'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type HallResult = { ok: true; message?: string } | { ok: false; error: string };

const hallSchema = z.object({
  name: z.string().min(2, 'Name required').max(120),
  capacity: z.number().int().min(0).max(100000),
  baseCharge: z.number().min(0).max(999999999),
  description: z.string().max(500).optional().nullable(),
});

export async function createHall(input: unknown): Promise<HallResult> {
  const actor = await assertPermission('halls.manage');
  const parsed = hallSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, capacity, baseCharge, description } = parsed.data;
  const res = await execute(
    `INSERT INTO halls (name, capacity, base_charge, description, is_active) VALUES (?,?,?,?,1)`,
    [name, capacity, baseCharge, description || null],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'hall', entityId: res.insertId, after: { name, capacity, baseCharge } });
  revalidatePath('/app/halls');
  return { ok: true, message: `${name} created.` };
}

export async function updateHall(id: number, input: unknown): Promise<HallResult> {
  const actor = await assertPermission('halls.manage');
  const parsed = hallSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, capacity, baseCharge, description } = parsed.data;
  const before = await queryOne(`SELECT * FROM halls WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Hall not found.' };
  await execute(`UPDATE halls SET name=?, capacity=?, base_charge=?, description=? WHERE id=?`,
    [name, capacity, baseCharge, description || null, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'hall', entityId: id, before, after: { name, capacity, baseCharge } });
  revalidatePath('/app/halls');
  return { ok: true, message: 'Hall updated.' };
}

export async function deleteHall(id: number): Promise<HallResult> {
  const actor = await assertPermission('halls.manage');
  const used = await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM bookings WHERE hall_id = ?`, [id]);
  if (used && used.c > 0) {
    // Soft-delete (archive) when there are bookings, to preserve history.
    await execute(`UPDATE halls SET is_active = 0 WHERE id = ?`, [id]);
    await audit({ userId: actor.id, action: 'ARCHIVE', entity: 'hall', entityId: id });
    return { ok: true, message: 'Hall has bookings — archived instead of deleted.' };
  }
  await execute(`DELETE FROM halls WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'hall', entityId: id });
  revalidatePath('/app/halls');
  return { ok: true, message: 'Hall deleted.' };
}

export async function restoreHall(id: number): Promise<HallResult> {
  const actor = await assertPermission('halls.manage');
  await execute(`UPDATE halls SET is_active = 1 WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'RESTORE', entity: 'hall', entityId: id });
  revalidatePath('/app/halls');
  return { ok: true };
}
