'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type StockResult = { ok: true; message?: string } | { ok: false; error: string };

const PATH = '/app/stock';

/** Movement kinds that add to stock. The rest subtract. */
const INBOUND = ['PURCHASE', 'RETURN'] as const;
const MOVEMENT_KINDS = ['PURCHASE', 'ISSUE', 'RETURN', 'BREAKAGE', 'LOSS', 'ADJUSTMENT'] as const;

// ═══════════════════════════════════════════════════════════════
// Items
// ═══════════════════════════════════════════════════════════════

const itemSchema = z.object({
  name: z.string().trim().min(2, 'Item name required').max(140),
  categoryId: z.number().int().positive().nullable().optional(),
  kind: z.enum(['DURABLE', 'CONSUMABLE']),
  unit: z.string().trim().min(1, 'Unit required').max(24),
  openingQty: z.number().min(0, 'Opening quantity cannot be negative').max(9999999),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative').max(9999999),
  unitCost: z.number().min(0, 'Unit cost cannot be negative').max(9999999),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function createStockItem(input: unknown): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  // The unique key would surface as a raw SQL error, so check first and
  // return something the owner can act on.
  const clash = await queryOne<{ id: number }>(`SELECT id FROM stock_items WHERE name = ?`, [d.name]);
  if (clash) return { ok: false, error: `"${d.name}" already exists in stock.` };

  const res = await execute(
    `INSERT INTO stock_items (category_id, name, kind, unit, opening_qty, reorder_level, unit_cost, notes, is_active)
     VALUES (?,?,?,?,?,?,?,?,1)`,
    [d.categoryId ?? null, d.name, d.kind, d.unit, d.openingQty, d.reorderLevel, d.unitCost, d.notes || null],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'stock_item', entityId: res.insertId, after: d });
  revalidatePath(PATH);
  return { ok: true, message: `${d.name} added to stock.` };
}

export async function updateStockItem(id: number, input: unknown): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const before = await queryOne<any>(`SELECT * FROM stock_items WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Item not found.' };

  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM stock_items WHERE name = ? AND id <> ?`, [d.name, id],
  );
  if (clash) return { ok: false, error: `Another item is already called "${d.name}".` };

  await execute(
    `UPDATE stock_items
        SET category_id=?, name=?, kind=?, unit=?, opening_qty=?, reorder_level=?, unit_cost=?, notes=?
      WHERE id=?`,
    [d.categoryId ?? null, d.name, d.kind, d.unit, d.openingQty, d.reorderLevel, d.unitCost, d.notes || null, id],
  );
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'stock_item', entityId: id, before, after: d });
  revalidatePath(PATH);
  return { ok: true, message: `${d.name} updated.` };
}

/**
 * Delete an item outright only when it has no ledger. Once movements exist the
 * item is archived instead — deleting would cascade the movements away and
 * silently rewrite the breakage history the owner is trying to keep.
 */
export async function deleteStockItem(id: number): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const item = await queryOne<{ name: string }>(`SELECT name FROM stock_items WHERE id = ?`, [id]);
  if (!item) return { ok: false, error: 'Item not found.' };

  const used = await queryOne<{ c: number }>(
    `SELECT COUNT(*) c FROM stock_movements WHERE item_id = ?`, [id],
  );
  if (used && used.c > 0) {
    await execute(`UPDATE stock_items SET is_active = 0 WHERE id = ?`, [id]);
    await audit({ userId: actor.id, action: 'ARCHIVE', entity: 'stock_item', entityId: id, before: item });
    revalidatePath(PATH);
    return { ok: true, message: `${item.name} has ${used.c} movement(s) — archived instead of deleted.` };
  }

  await execute(`DELETE FROM stock_items WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'stock_item', entityId: id, before: item });
  revalidatePath(PATH);
  return { ok: true, message: `${item.name} deleted.` };
}

export async function restoreStockItem(id: number): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  await execute(`UPDATE stock_items SET is_active = 1 WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'RESTORE', entity: 'stock_item', entityId: id });
  revalidatePath(PATH);
  return { ok: true, message: 'Item restored.' };
}

// ═══════════════════════════════════════════════════════════════
// Movements
// ═══════════════════════════════════════════════════════════════

const movementSchema = z
  .object({
    itemId: z.number().int().positive('Pick an item'),
    kind: z.enum(MOVEMENT_KINDS),
    qty: z.number().refine((n) => n !== 0, 'Quantity cannot be zero').refine((n) => Math.abs(n) <= 9999999, 'Quantity is too large'),
    unitCost: z.number().min(0).max(9999999).nullable().optional(),
    bookingId: z.number().int().positive().nullable().optional(),
    movedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
    note: z.string().trim().max(500).nullable().optional(),
  })
  // ADJUSTMENT is the stock-take correction and is the only kind that can go
  // both ways. Everything else has its direction fixed by `kind`, so a negative
  // qty there would silently invert the movement.
  .refine((d) => d.kind === 'ADJUSTMENT' || d.qty > 0, {
    message: 'Quantity must be positive — only a stock-take adjustment can be negative.',
    path: ['qty'],
  });

export async function createStockMovement(input: unknown): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const item = await queryOne<{ name: string; unit: string }>(
    `SELECT name, unit FROM stock_items WHERE id = ?`, [d.itemId],
  );
  if (!item) return { ok: false, error: 'Item not found.' };

  const res = await execute(
    `INSERT INTO stock_movements (item_id, kind, qty, unit_cost, booking_id, moved_on, note, created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      d.itemId, d.kind, d.qty,
      d.kind === 'PURCHASE' ? d.unitCost ?? null : null,
      d.bookingId ?? null, d.movedOn, d.note || null, actor.id,
    ],
  );

  // A purchase is also the freshest price we have, so it updates the item's
  // valuation cost. Older items keep whatever was last paid.
  if (d.kind === 'PURCHASE' && d.unitCost != null && d.unitCost > 0) {
    await execute(`UPDATE stock_items SET unit_cost = ? WHERE id = ?`, [d.unitCost, d.itemId]);
  }

  await audit({ userId: actor.id, action: 'CREATE', entity: 'stock_movement', entityId: res.insertId, after: d });
  revalidatePath(PATH);
  const verb = (INBOUND as readonly string[]).includes(d.kind) ? 'added to' : 'taken out of';
  return { ok: true, message: `${Math.abs(d.qty)} ${item.unit} of ${item.name} ${verb} stock.` };
}

export async function updateStockMovement(id: number, input: unknown): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const before = await queryOne<any>(`SELECT * FROM stock_movements WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Movement not found.' };
  // A booking owns its issues: editing the services rewrites them, so a change
  // made here would be silently discarded the next time that booking is saved.
  if (before.source === 'BOOKING') {
    return { ok: false, error: 'This issue comes from a booking. Change the quantity on the booking\u2019s services instead.' };
  }

  await execute(
    `UPDATE stock_movements
        SET item_id=?, kind=?, qty=?, unit_cost=?, booking_id=?, moved_on=?, note=?
      WHERE id=?`,
    [
      d.itemId, d.kind, d.qty,
      d.kind === 'PURCHASE' ? d.unitCost ?? null : null,
      d.bookingId ?? null, d.movedOn, d.note || null, id,
    ],
  );
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'stock_movement', entityId: id, before, after: d });
  revalidatePath(PATH);
  return { ok: true, message: 'Movement updated.' };
}

export async function deleteStockMovement(id: number): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const before = await queryOne<any>(`SELECT * FROM stock_movements WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Movement not found.' };
  if (before.source === 'BOOKING') {
    return { ok: false, error: 'This issue comes from a booking. Remove the service line on that booking instead.' };
  }
  await execute(`DELETE FROM stock_movements WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'stock_movement', entityId: id, before });
  revalidatePath(PATH);
  return { ok: true, message: 'Movement deleted — the item total has been recalculated.' };
}

// ═══════════════════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════════════════

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name required').max(80),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function createStockCategory(input: unknown): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, sortOrder } = parsed.data;

  const clash = await queryOne<{ id: number }>(`SELECT id FROM stock_categories WHERE name = ?`, [name]);
  if (clash) return { ok: false, error: `"${name}" already exists.` };

  const res = await execute(
    `INSERT INTO stock_categories (name, sort_order, is_active) VALUES (?,?,1)`,
    [name, sortOrder ?? 99],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'stock_category', entityId: res.insertId, after: { name } });
  revalidatePath(PATH);
  return { ok: true, message: `Category "${name}" added.` };
}

export async function updateStockCategory(id: number, input: unknown): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, sortOrder } = parsed.data;

  const before = await queryOne<any>(`SELECT * FROM stock_categories WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Category not found.' };
  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM stock_categories WHERE name = ? AND id <> ?`, [name, id],
  );
  if (clash) return { ok: false, error: `Another category is already called "${name}".` };

  await execute(`UPDATE stock_categories SET name=?, sort_order=? WHERE id=?`, [name, sortOrder ?? before.sort_order, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'stock_category', entityId: id, before, after: { name } });
  revalidatePath(PATH);
  return { ok: true, message: 'Category updated.' };
}

/**
 * Categories are only a grouping, so deleting one must never take its items
 * with it — the FK is ON DELETE SET NULL and the items land in "Uncategorised".
 */
export async function deleteStockCategory(id: number): Promise<StockResult> {
  const actor = await assertPermission('stock.manage');
  const cat = await queryOne<{ name: string }>(`SELECT name FROM stock_categories WHERE id = ?`, [id]);
  if (!cat) return { ok: false, error: 'Category not found.' };
  const used = await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM stock_items WHERE category_id = ?`, [id]);

  await execute(`DELETE FROM stock_categories WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'stock_category', entityId: id, before: cat });
  revalidatePath(PATH);
  return {
    ok: true,
    message: used && used.c > 0
      ? `Category deleted — its ${used.c} item(s) are now uncategorised.`
      : 'Category deleted.',
  };
}
