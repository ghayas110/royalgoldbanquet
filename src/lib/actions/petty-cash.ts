'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

async function isLocked(year: number, month: number): Promise<boolean> {
  const row = await queryOne(`SELECT id FROM monthly_locks WHERE year = ? AND month = ?`, [year, month]);
  return !!row;
}

export type CellResult = { ok: true; id?: number } | { ok: false; error: string };

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  headId: z.number().int().positive(),
  amount: z.number().min(0).max(99999999),
  qtyNote: z.string().max(80).nullable().optional(),
});

/** Add a single expense line for a date (multiple lines per category allowed). */
export async function addPettyEntry(input: unknown): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { date, headId, amount, qtyNote } = parsed.data;
  const [y, m] = date.split('-').map(Number);
  if (await isLocked(y, m)) return { ok: false, error: 'This month is locked.' };
  if (amount <= 0) return { ok: false, error: 'Enter an amount.' };

  const res = await execute(
    `INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, entered_by) VALUES (?,?,?,?,?)`,
    [date, headId, amount, qtyNote ?? null, actor.id],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'petty_cash', entityId: res.insertId, after: { date, headId, amount } });
  revalidatePath('/app/petty-cash');
  return { ok: true, id: res.insertId };
}

/**
 * Set a single day×category cell to an amount (one entry per cell).
 * amount 0 clears it. Used by the zero-default daily grid.
 */
export async function saveCell(input: unknown): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { date, headId, amount, qtyNote } = parsed.data;
  const [y, m] = date.split('-').map(Number);
  if (await isLocked(y, m)) return { ok: false, error: 'This month is locked.' };

  await execute(`DELETE FROM petty_cash_entries WHERE entry_date = ? AND expense_head_id = ?`, [date, headId]);
  if (amount > 0) {
    await execute(
      `INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, entered_by) VALUES (?,?,?,?,?)`,
      [date, headId, amount, qtyNote ?? null, actor.id],
    );
  }
  return { ok: true };
}

export async function updatePettyEntry(id: number, amount: number, qtyNote: string | null): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const row = await queryOne<{ entry_date: string }>(`SELECT entry_date FROM petty_cash_entries WHERE id = ?`, [id]);
  if (!row) return { ok: false, error: 'Entry not found.' };
  const [y, m] = String(row.entry_date).slice(0, 7).split('-').map(Number);
  if (await isLocked(y, m)) return { ok: false, error: 'This month is locked.' };
  await execute(`UPDATE petty_cash_entries SET amount = ?, qty_note = ? WHERE id = ?`, [amount, qtyNote, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'petty_cash', entityId: id, after: { amount } });
  revalidatePath('/app/petty-cash');
  return { ok: true };
}

export async function deletePettyEntry(id: number): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  await execute(`DELETE FROM petty_cash_entries WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'petty_cash', entityId: id });
  revalidatePath('/app/petty-cash');
  return { ok: true };
}

export async function setMonthLock(year: number, month: number, lock: boolean): Promise<CellResult> {
  const actor = await assertPermission('pettycash.lock');
  if (lock) {
    await execute(`INSERT IGNORE INTO monthly_locks (year, month, locked_by) VALUES (?,?,?)`, [year, month, actor.id]);
    await audit({ userId: actor.id, action: 'LOCK', entity: 'monthly_lock', entityId: `${year}-${month}` });
  } else {
    await execute(`DELETE FROM monthly_locks WHERE year = ? AND month = ?`, [year, month]);
    await audit({ userId: actor.id, action: 'UNLOCK', entity: 'monthly_lock', entityId: `${year}-${month}` });
  }
  revalidatePath('/app/petty-cash');
  return { ok: true };
}

// ── Expense category admin (add / update / delete / archive) ──
export async function addExpenseHead(name: string, hasQtyNote: boolean): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  if (name.trim().length < 2) return { ok: false, error: 'Name too short.' };
  const max = await queryOne<{ m: number }>(`SELECT COALESCE(MAX(sort_order),0) m FROM expense_heads`);
  const res = await execute(
    `INSERT INTO expense_heads (name, sort_order, has_qty_note, is_active) VALUES (?,?,?,1)`,
    [name.trim(), (max?.m ?? 0) + 1, hasQtyNote ? 1 : 0],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'expense_head', entityId: res.insertId, after: { name } });
  revalidatePath('/app/petty-cash');
  return { ok: true, id: res.insertId };
}

export async function updateExpenseHead(id: number, name: string, hasQtyNote: boolean): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  if (name.trim().length < 2) return { ok: false, error: 'Name too short.' };
  await execute(`UPDATE expense_heads SET name = ?, has_qty_note = ? WHERE id = ?`, [name.trim(), hasQtyNote ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'expense_head', entityId: id, after: { name } });
  revalidatePath('/app/petty-cash');
  return { ok: true };
}

export async function deleteExpenseHead(id: number): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const used = await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM petty_cash_entries WHERE expense_head_id = ?`, [id]);
  if (used && used.c > 0) {
    await execute(`UPDATE expense_heads SET is_active = 0 WHERE id = ?`, [id]);
    await audit({ userId: actor.id, action: 'ARCHIVE', entity: 'expense_head', entityId: id });
    return { ok: true };
  }
  await execute(`DELETE FROM expense_heads WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'expense_head', entityId: id });
  revalidatePath('/app/petty-cash');
  return { ok: true };
}

export async function restoreExpenseHead(id: number): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  await execute(`UPDATE expense_heads SET is_active = 1 WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'RESTORE', entity: 'expense_head', entityId: id });
  revalidatePath('/app/petty-cash');
  return { ok: true };
}
