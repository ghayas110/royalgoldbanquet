'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { saveUpload } from '@/lib/uploads';

async function isLocked(year: number, month: number): Promise<boolean> {
  const row = await queryOne(`SELECT id FROM monthly_locks WHERE year = ? AND month = ?`, [year, month]);
  return !!row;
}

export type CellResult =
  | { ok: true; id?: number; message?: string; attachment?: string; attachmentKind?: 'IMAGE' | 'VIDEO' }
  | { ok: false; error: string };

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

  // Carry any evidence across the delete-and-reinsert: editing the amount on a
  // line must not silently drop the photo filed against it.
  const prev = await queryOne<{ attachment: string | null; attachment_kind: 'IMAGE' | 'VIDEO' | null }>(
    `SELECT attachment, attachment_kind FROM petty_cash_entries WHERE entry_date = ? AND expense_head_id = ?`,
    [date, headId],
  );
  await execute(`DELETE FROM petty_cash_entries WHERE entry_date = ? AND expense_head_id = ?`, [date, headId]);
  if (amount > 0) {
    const res = await execute(
      `INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, attachment, attachment_kind, entered_by)
       VALUES (?,?,?,?,?,?,?)`,
      [date, headId, amount, qtyNote ?? null, prev?.attachment ?? null, prev?.attachment_kind ?? null, actor.id],
    );
    // The id goes back so the client can attach evidence without a reload.
    return { ok: true, id: res.insertId };
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
  const cleanName = name.trim();
  if (cleanName.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };

  const existing = await queryOne<{ id: number; is_active: number }>(
    `SELECT id, is_active FROM expense_heads WHERE name = ? LIMIT 1`,
    [cleanName],
  );
  if (existing) {
    if (existing.is_active === 0) {
      await execute(`UPDATE expense_heads SET is_active = 1, has_qty_note = ? WHERE id = ?`, [hasQtyNote ? 1 : 0, existing.id]);
      await audit({ userId: actor.id, action: 'RESTORE', entity: 'expense_head', entityId: existing.id });
      revalidatePath('/app/settings');
      revalidatePath('/app/petty-cash');
      revalidatePath('/app/reports');
      return { ok: true, id: existing.id, message: `Restored archived expense head "${cleanName}".` };
    }
    return { ok: false, error: `Expense head "${cleanName}" already exists.` };
  }

  const max = await queryOne<{ m: number }>(`SELECT COALESCE(MAX(sort_order),0) m FROM expense_heads`);
  const res = await execute(
    `INSERT INTO expense_heads (name, sort_order, has_qty_note, is_active) VALUES (?,?,?,1)`,
    [cleanName, (max?.m ?? 0) + 1, hasQtyNote ? 1 : 0],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'expense_head', entityId: res.insertId, after: { name: cleanName } });
  revalidatePath('/app/settings');
  revalidatePath('/app/petty-cash');
  revalidatePath('/app/reports');
  return { ok: true, id: res.insertId };
}

export async function updateExpenseHead(id: number, name: string, hasQtyNote: boolean): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const cleanName = name.trim();
  if (cleanName.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };

  const dup = await queryOne<{ id: number }>(
    `SELECT id FROM expense_heads WHERE name = ? AND id != ? LIMIT 1`,
    [cleanName, id],
  );
  if (dup) return { ok: false, error: `Another expense head named "${cleanName}" already exists.` };

  await execute(`UPDATE expense_heads SET name = ?, has_qty_note = ? WHERE id = ?`, [cleanName, hasQtyNote ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'expense_head', entityId: id, after: { name: cleanName } });
  revalidatePath('/app/settings');
  revalidatePath('/app/petty-cash');
  revalidatePath('/app/reports');
  return { ok: true };
}

export async function deleteExpenseHead(id: number): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const usedEntries = await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM petty_cash_entries WHERE expense_head_id = ?`, [id]);
  const usedAdj = await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM income_adjustments WHERE expense_head_id = ?`, [id]);
  const totalUsed = (usedEntries?.c ?? 0) + (usedAdj?.c ?? 0);

  if (totalUsed > 0) {
    await execute(`UPDATE expense_heads SET is_active = 0 WHERE id = ?`, [id]);
    await audit({ userId: actor.id, action: 'ARCHIVE', entity: 'expense_head', entityId: id });
    revalidatePath('/app/settings');
    revalidatePath('/app/petty-cash');
    revalidatePath('/app/reports');
    return { ok: true, message: 'Expense head archived because it has recorded entries.' };
  }

  await execute(`DELETE FROM expense_heads WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'expense_head', entityId: id });
  revalidatePath('/app/settings');
  revalidatePath('/app/petty-cash');
  revalidatePath('/app/reports');
  return { ok: true, message: 'Expense head deleted permanently.' };
}

export async function restoreExpenseHead(id: number): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  await execute(`UPDATE expense_heads SET is_active = 1 WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'RESTORE', entity: 'expense_head', entityId: id });
  revalidatePath('/app/settings');
  revalidatePath('/app/petty-cash');
  revalidatePath('/app/reports');
  return { ok: true, message: 'Expense head restored.' };
}

// ── Evidence against a line ────────────────────────────

/**
 * Attach a photo or a short clip to one expense line.
 *
 * Takes FormData rather than a plain object because the file has to survive
 * the trip as a File; a base64 string in JSON would inflate a 6 MB photo to
 * 8 MB and blow the action body limit.
 *
 * The month lock applies here too. A locked month is closed, and quietly
 * letting evidence be swapped afterwards would defeat the point of locking it.
 */
export async function attachToPettyEntry(entryId: number, form: FormData): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');

  const row = await queryOne<{ entry_date: string; attachment: string | null }>(
    `SELECT entry_date, attachment FROM petty_cash_entries WHERE id = ?`, [entryId],
  );
  if (!row) return { ok: false, error: 'That expense line no longer exists.' };

  const d = new Date(row.entry_date);
  if (await isLocked(d.getFullYear(), d.getMonth() + 1)) return { ok: false, error: 'This month is locked.' };

  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Choose a photo or video first.' };

  const saved = await saveUpload(file);
  if (!saved.ok) return { ok: false, error: saved.error };

  await execute(
    `UPDATE petty_cash_entries SET attachment = ?, attachment_kind = ? WHERE id = ?`,
    [saved.saved.name, saved.saved.kind, entryId],
  );
  await audit({
    userId: actor.id, action: 'UPDATE', entity: 'petty_cash', entityId: entryId,
    before: { attachment: row.attachment }, after: { attachment: saved.saved.name },
  });
  revalidatePath('/app/petty-cash');
  // The stored name goes back so the row can show the new evidence without a
  // round trip; the client cannot derive it, since it is generated here.
  return {
    ok: true,
    message: saved.saved.kind === 'VIDEO' ? 'Video attached.' : 'Photo attached.',
    attachment: saved.saved.name,
    attachmentKind: saved.saved.kind,
  };
}

/**
 * Detach evidence from a line.
 *
 * The row is cleared; the file itself is left on disk. Deleting it would make
 * the audit trail point at nothing, and these files are small next to the
 * value of being able to answer "what did we actually buy" a year later.
 */
export async function detachFromPettyEntry(entryId: number): Promise<CellResult> {
  const actor = await assertPermission('pettycash.edit');
  const row = await queryOne<{ entry_date: string; attachment: string | null }>(
    `SELECT entry_date, attachment FROM petty_cash_entries WHERE id = ?`, [entryId],
  );
  if (!row) return { ok: false, error: 'That expense line no longer exists.' };

  const d = new Date(row.entry_date);
  if (await isLocked(d.getFullYear(), d.getMonth() + 1)) return { ok: false, error: 'This month is locked.' };

  await execute(`UPDATE petty_cash_entries SET attachment = NULL, attachment_kind = NULL WHERE id = ?`, [entryId]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'petty_cash', entityId: entryId, before: { attachment: row.attachment }, after: { attachment: null } });
  revalidatePath('/app/petty-cash');
  return { ok: true, message: 'Attachment removed.' };
}
