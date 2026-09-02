'use server';

import { z } from 'zod';
import { execute, queryOne, withTransaction } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { CATERING_BILLABLE, cateringLineAmount, type CateringUnit } from '@/lib/types';
import { eventRootId } from '@/lib/catering';

export type CateringResult = { ok: true; message?: string; id?: number } | { ok: false; error: string };

const PATH = '/catering';

function refresh(id?: number) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/quotations`);
  revalidatePath(`${PATH}/menu`);
  revalidatePath(`${PATH}/customers`);
  revalidatePath(`${PATH}/categories`);
  revalidatePath(`${PATH}/rules`);
  revalidatePath(`${PATH}/invoices`);
  revalidatePath(`${PATH}/vendors`);
  revalidatePath(`${PATH}/ledger`);
  revalidatePath(`${PATH}/templates`);
  if (id) revalidatePath(`${PATH}/quotations/${id}`);
}

const money = z.number().min(0, 'Amount cannot be negative').max(999999999);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date');

// ═══════════════════════════════════════════════════════════════
// Customers
// ═══════════════════════════════════════════════════════════════

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Customer name required').max(160),
  phone: z.string().trim().max(40).default(''),
  phone2: z.string().trim().max(40).default(''),
  address: z.string().trim().max(400).default(''),
  note: z.string().trim().max(500).default(''),
});

export async function saveCateringCustomer(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  if (id) {
    await execute(
      `UPDATE catering_customers SET name=?, phone=?, phone2=?, address=?, note=? WHERE id=?`,
      [d.name, d.phone, d.phone2, d.address, d.note, id],
    );
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_customer', entityId: id, after: d });
    refresh();
    return { ok: true, message: `${d.name} updated.`, id };
  }
  const res = await execute(
    `INSERT INTO catering_customers (name, phone, phone2, address, note) VALUES (?,?,?,?,?)`,
    [d.name, d.phone, d.phone2, d.address, d.note],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'catering_customer', entityId: res.insertId, after: d });
  refresh();
  return { ok: true, message: `${d.name} added.`, id: res.insertId };
}

export async function deleteCateringCustomer(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  // Quotations keep the customer NAME snapshotted, so deleting the record does
  // not corrupt a slip already handed over — but it does lose the contact, so
  // it is only offered for customers with no history.
  const used = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM catering_quotations WHERE customer_id = ?`, [id],
  );
  if (Number(used?.n ?? 0) > 0) {
    return { ok: false, error: 'This customer has quotations — they cannot be deleted.' };
  }
  await execute(`DELETE FROM catering_customers WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_customer', entityId: id });
  refresh();
  return { ok: true, message: 'Customer deleted.' };
}

// ═══════════════════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════════════════

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name required').max(60),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export async function saveCateringCategory(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = { ...parsed.data, name: parsed.data.name.toUpperCase() };

  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM catering_categories WHERE name = ? AND id <> ?`, [d.name, id ?? 0],
  );
  if (clash) return { ok: false, error: `"${d.name}" already exists.` };

  if (id) {
    await execute(`UPDATE catering_categories SET name=?, sort_order=? WHERE id=?`, [d.name, d.sortOrder, id]);
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_category', entityId: id, after: d });
    refresh();
    return { ok: true, message: `${d.name} updated.`, id };
  }
  const res = await execute(
    `INSERT INTO catering_categories (name, sort_order, is_active) VALUES (?,?,1)`, [d.name, d.sortOrder],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'catering_category', entityId: res.insertId, after: d });
  refresh();
  return { ok: true, message: `${d.name} added.`, id: res.insertId };
}

export async function setCateringCategoryActive(id: number, active: boolean): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_categories SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_category', entityId: id, after: { active } });
  refresh();
  return { ok: true, message: active ? 'Category restored.' : 'Category archived.' };
}

export async function deleteCateringCategory(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const used = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM catering_menu_item_categories WHERE category_id = ?`, [id],
  );
  if (Number(used?.n ?? 0) > 0) {
    return { ok: false, error: 'Dishes are priced under this category — archive it instead of deleting.' };
  }
  await execute(`DELETE FROM catering_categories WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_category', entityId: id });
  refresh();
  return { ok: true, message: 'Category deleted.' };
}

// ═══════════════════════════════════════════════════════════════
// Meat types
// ═══════════════════════════════════════════════════════════════

const meatSchema = z.object({
  name: z.string().trim().min(1, 'Meat name required').max(60),
  unit: z.enum(['KG', 'LITRE', 'PCS']),
  rate: money,
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export async function saveCateringMeatType(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = meatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = { ...parsed.data, name: parsed.data.name.toUpperCase() };

  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM catering_meat_types WHERE name = ? AND id <> ?`, [d.name, id ?? 0],
  );
  if (clash) return { ok: false, error: `"${d.name}" already exists.` };

  if (id) {
    await execute(`UPDATE catering_meat_types SET name=?, unit=?, rate=?, sort_order=? WHERE id=?`,
      [d.name, d.unit, d.rate, d.sortOrder, id]);
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_meat_type', entityId: id, after: d });
    refresh();
    return { ok: true, message: `${d.name} updated.`, id };
  }
  const res = await execute(
    `INSERT INTO catering_meat_types (name, unit, rate, sort_order, is_active) VALUES (?,?,?,?,1)`,
    [d.name, d.unit, d.rate, d.sortOrder],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'catering_meat_type', entityId: res.insertId, after: d });
  refresh();
  return { ok: true, message: `${d.name} added.`, id: res.insertId };
}

export async function setCateringMeatTypeActive(id: number, active: boolean): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_meat_types SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_meat_type', entityId: id, after: { active } });
  refresh();
  return { ok: true, message: active ? 'Meat restored.' : 'Meat archived.' };
}

export async function deleteCateringMeatType(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const used = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM catering_menu_item_categories WHERE meat_type_id = ?`, [id],
  );
  if (Number(used?.n ?? 0) > 0) {
    return { ok: false, error: 'Dishes pull this meat — archive it instead of deleting.' };
  }
  await execute(`DELETE FROM catering_meat_types WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_meat_type', entityId: id });
  refresh();
  return { ok: true, message: 'Meat deleted.' };
}

// ═══════════════════════════════════════════════════════════════
// Menu
// ═══════════════════════════════════════════════════════════════

const menuSchema = z.object({
  name: z.string().trim().min(2, 'Dish name required').max(160),
  // The unit the RATE is quoted in. A line may be ordered in a smaller unit
  // (GRAM, ML) and is converted before the amount is worked out. PLATE is here
  // and deliberately NOT in `meatSchema`: meat is bought by weight.
  unit: z.enum(['KG', 'LITRE', 'PCS', 'PLATE']),
  defaultRate: money,
  sortOrder: z.number().int().min(0).max(9999).default(0),
  /** One priced variant per category — QORMA sells as BEEF and as CHICKEN. */
  variants: z.array(z.object({
    categoryId: z.number().int().positive(),
    rate: money,
    /** The meat this variant consumes — kept as the primary; `meats` below is
     *  the full picture. Null for a meatless dish. */
    meatTypeId: z.number().int().positive().nullable().optional(),
    /**
     * Every meat the variant draws on, with its percentage share of the dish.
     * Half chicken, half beef is two entries at 50; a single-meat dish is one
     * entry at 100; an empty list means the dish uses no meat.
     */
    meats: z.array(z.object({
      meatTypeId: z.number().int().positive(),
      share: z.number().min(0).max(100),
    })).default([]),
  })).default([]),
});

export async function saveCateringMenuItem(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = menuSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM catering_menu_items WHERE name = ? AND id <> ?`, [d.name, id ?? 0],
  );
  if (clash) return { ok: false, error: `"${d.name}" is already on the menu.` };

  // A duplicate category inside one dish would violate the unique key as a raw
  // SQL error, so it is caught here and reported as something actionable.
  const seen = new Set<number>();
  for (const v of d.variants) {
    if (seen.has(v.categoryId)) return { ok: false, error: 'The same category is listed twice on this dish.' };
    seen.add(v.categoryId);
  }

  try {
    const itemId = await withTransaction(async (tx) => {
      let out = id;
      if (out) {
        await tx.execute(
          `UPDATE catering_menu_items SET name=?, unit=?, default_rate=?, sort_order=? WHERE id=?`,
          [d.name, d.unit, d.defaultRate, d.sortOrder, out],
        );
        // Variants are replaced wholesale — the editor posts the full set.
        await tx.execute(`DELETE FROM catering_menu_item_categories WHERE menu_item_id = ?`, [out]);
      } else {
        const res = await tx.execute(
          `INSERT INTO catering_menu_items (name, category, unit, default_rate, sort_order, is_active)
           VALUES (?,'',?,?,?,1)`,
          [d.name, d.unit, d.defaultRate, d.sortOrder],
        );
        out = res.insertId;
      }
      for (const v of d.variants) {
        // The largest share is written to the legacy column too, so anything
        // that still understands only one meat sees the main one.
        const split = [...(v.meats ?? [])].sort((a, b) => b.share - a.share);
        const primary = split[0]?.meatTypeId ?? v.meatTypeId ?? null;
        const res = await tx.execute(
          `INSERT INTO catering_menu_item_categories (menu_item_id, category_id, rate, meat_type_id, is_active) VALUES (?,?,?,?,1)`,
          [out, v.categoryId, v.rate, primary],
        ) as { insertId: number };

        // The split itself. Variants were deleted above, and the rows cascade
        // with them, so this is always a clean write.
        for (const m of split) {
          await tx.execute(
            `INSERT INTO catering_variant_meats (variant_id, meat_type_id, share) VALUES (?,?,?)`,
            [res.insertId, m.meatTypeId, m.share],
          );
        }
      }
      return out!;
    });
    await audit({ userId: actor.id, action: id ? 'UPDATE' : 'CREATE', entity: 'catering_menu_item', entityId: itemId, after: d });
    refresh();
    return { ok: true, message: id ? `${d.name} updated.` : `${d.name} added to the menu.`, id: itemId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save the dish.' };
  }
}

export async function setCateringMenuItemActive(id: number, active: boolean): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_menu_items SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_menu_item', entityId: id, after: { active } });
  refresh();
  return { ok: true, message: active ? 'Back on the menu.' : 'Archived.' };
}

export async function deleteCateringMenuItem(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const used = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM catering_quotation_items WHERE menu_item_id = ?`, [id],
  );
  if (Number(used?.n ?? 0) > 0) {
    return { ok: false, error: 'This dish is used by existing quotations — archive it instead.' };
  }
  await execute(`DELETE FROM catering_menu_items WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_menu_item', entityId: id });
  refresh();
  return { ok: true, message: 'Dish deleted.' };
}

// ═══════════════════════════════════════════════════════════════
// Quotations
// ═══════════════════════════════════════════════════════════════

const lineSchema = z.object({
  section: z.enum(['DISH', 'CHARGE', 'MEAT']),
  menuItemId: z.number().int().positive().nullable().optional(),
  description: z.string().trim().min(1, 'Every line needs a description').max(200),
  category: z.string().trim().max(60).default(''),
  categoryId: z.number().int().positive().nullable().optional(),
  meatTypeId: z.number().int().positive().nullable().optional(),
  qty: z.number().min(0).max(9999999).default(0),
  // Every unit a LINE can be ordered in, PLATE included. This is the schema a
  // quotation and a template both validate against, so a per-plate dish that
  // the menu allows must be accepted here too.
  unit: z.enum(['KG', 'GRAM', 'LITRE', 'ML', 'PCS', 'PLATE']).default('KG'),
  rate: money.default(0),
  // A CHARGE line (TRANSPORT, SERVICE) carries an amount with no qty or rate,
  // so the amount is taken as given rather than derived.
  amount: money.default(0),
});

const quotationSchema = z.object({
  customerId: z.number().int().positive().nullable().optional(),
  customerName: z.string().trim().max(160).default(''),
  contactNo: z.string().trim().max(40).default(''),
  placeOfFunction: z.string().trim().max(200).default(''),
  quotationDate: isoDate,
  deliveryDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().default(''),
  persons: z.number().int().min(0).max(1000000).default(0),
  status: z.enum(['QUOTATION', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).default('QUOTATION'),
  advanceAmount: money.default(0),
  note: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});

/**
 * A CHARGE line is the amount as entered; everything else is converted to the
 * rate's base unit first, so 500 GRAM at 800/kg bills as 400 rather than
 * 400,000. `cateringLineAmount` is shared with the editor and the slip.
 */
function lineAmount(l: z.infer<typeof lineSchema>): number {
  return l.section === 'CHARGE' ? l.amount : cateringLineAmount(l.qty, l.unit as CateringUnit, l.rate);
}

/**
 * SC-18706, SC-18707 … from a counter that only ever goes up.
 *
 * Deriving it from the table would re-issue a number as soon as the highest
 * quotation is deleted, and a quotation number that has been handed to a
 * customer must never be given to a second one. Seeded from the highest
 * existing number so an established series carries on where it left off.
 */
async function nextQuotaNo(tx: {
  queryOne: <R>(sql: string, p?: unknown[]) => Promise<R | null>;
  execute: (sql: string, p?: unknown[]) => Promise<unknown>;
}): Promise<string> {
  const prefixRow = await tx.queryOne<{ value: string }>(
    "SELECT `value` FROM settings WHERE `key` = 'catering.quota_prefix'",
  );
  const prefix = (prefixRow?.value || 'SC').trim();
  const key = `catering.quota_seq.${prefix}`;

  const seeded = await tx.queryOne<{ n: number | string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(quota_no, '-', -1) AS UNSIGNED)), 0) AS n
       FROM catering_quotations WHERE quota_no LIKE ?`,
    [`${prefix}-%`],
  );
  // MySQL returns CAST(... AS UNSIGNED) as a STRING; without Number() the
  // arithmetic below concatenates.
  const floor = Number(seeded?.n ?? 0);

  await tx.execute(
    `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = GREATEST(CAST(\`value\` AS UNSIGNED), ?) + 1`,
    [key, String(floor + 1), floor],
  );
  const row = await tx.queryOne<{ value: string }>(
    "SELECT `value` FROM settings WHERE `key` = ?", [key],
  );
  return `${prefix}-${Number(row?.value ?? floor + 1)}`;
}

export async function saveCateringQuotation(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  if (!d.customerId && !d.customerName) {
    return { ok: false, error: 'Pick a customer, or type a name for this quotation.' };
  }

  const lines = d.lines.map((l) => ({ ...l, amount: lineAmount(l) }));
  const itemsTotal = lines.filter((l) => l.section !== 'MEAT').reduce((s, l) => s + l.amount, 0);
  const meatTotal = lines.filter((l) => l.section === 'MEAT').reduce((s, l) => s + l.amount, 0);
  const grandTotal = itemsTotal + meatTotal;

  if (d.advanceAmount > grandTotal) {
    return { ok: false, error: 'Advance cannot exceed the total.' };
  }

  try {
    const qid = await withTransaction(async (tx) => {
      let out = id;
      if (out) {
        const before = await tx.queryOne<any>(`SELECT * FROM catering_quotations WHERE id = ?`, [out]);
        if (!before) throw new Error('Quotation not found.');
        await tx.execute(
          `UPDATE catering_quotations
              SET customer_id=?, customer_name=?, contact_no=?, place_of_function=?,
                  quotation_date=?, delivery_date=?, persons=?,
                  items_total=?, meat_total=?, grand_total=?, advance_amount=?, status=?, note=?
            WHERE id=?`,
          [d.customerId ?? null, d.customerName, d.contactNo, d.placeOfFunction,
           d.quotationDate, d.deliveryDate || null, d.persons,
           itemsTotal, meatTotal, grandTotal, d.advanceAmount, d.status, d.note || null, out],
        );
        // Lines are replaced wholesale — the editor always posts the full set.
        await tx.execute(`DELETE FROM catering_quotation_items WHERE quotation_id = ?`, [out]);
      } else {
        const quotaNo = await nextQuotaNo(tx);
        const res = await tx.execute(
          `INSERT INTO catering_quotations
             (quota_no, customer_id, customer_name, contact_no, place_of_function,
              quotation_date, delivery_date, persons, items_total, meat_total, grand_total,
              advance_amount, paid_amount, status, note, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
          [quotaNo, d.customerId ?? null, d.customerName, d.contactNo, d.placeOfFunction,
           d.quotationDate, d.deliveryDate || null, d.persons,
           itemsTotal, meatTotal, grandTotal, d.advanceAmount, d.status, d.note || null, actor.id],
        );
        out = res.insertId;
      }

      let n = 0;
      for (const l of lines) {
        await tx.execute(
          `INSERT INTO catering_quotation_items
             (quotation_id, section, menu_item_id, description, category, category_id, meat_type_id, qty, unit, rate, amount, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [out, l.section, l.menuItemId ?? null, l.description, l.category, l.categoryId ?? null,
           l.meatTypeId ?? null, l.qty, l.unit, l.rate, l.amount, n++],
        );
      }
      return out!;
    });

    await audit({
      userId: actor.id, action: id ? 'UPDATE' : 'CREATE',
      entity: 'catering_quotation', entityId: qid,
      after: { ...d, itemsTotal, meatTotal, grandTotal },
    });
    refresh(qid);
    return { ok: true, message: id ? 'Quotation updated.' : 'Quotation created.', id: qid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save the quotation.' };
  }
}

export async function setCateringQuotationStatus(
  id: number,
  status: 'QUOTATION' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_quotations SET status = ? WHERE id = ?`, [status, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_quotation', entityId: id, after: { status } });
  refresh(id);
  return { ok: true, message: `Marked ${status.toLowerCase()}.` };
}

export async function deleteCateringQuotation(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const before = await queryOne<any>(`SELECT * FROM catering_quotations WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Quotation not found.' };
  // Lines and receipts follow via ON DELETE CASCADE.
  await execute(`DELETE FROM catering_quotations WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_quotation', entityId: id, before });
  refresh();
  return { ok: true, message: `${before.quota_no} deleted.` };
}

// ═══════════════════════════════════════════════════════════════
// Receipts
// ═══════════════════════════════════════════════════════════════

const paymentSchema = z.object({
  amount: z.number().positive('Enter an amount greater than zero').max(999999999),
  paymentDate: isoDate,
  method: z.string().trim().min(1).max(40).default('CASH'),
  note: z.string().trim().max(255).nullable().optional(),
});

export async function recordCateringPayment(quotationId: number, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  try {
    await withTransaction(async (tx) => {
      const q = await tx.queryOne<any>(
        `SELECT grand_total, paid_amount, status FROM catering_quotations WHERE id = ? FOR UPDATE`,
        [quotationId],
      );
      if (!q) throw new Error('Quotation not found.');
      if (!CATERING_BILLABLE.includes(q.status)) {
        throw new Error('Confirm the quotation before recording money against it.');
      }
      const outstanding = Number(q.grand_total) - Number(q.paid_amount);
      if (d.amount > outstanding + 0.01) {
        throw new Error(`That is more than the ${outstanding.toLocaleString()} still outstanding.`);
      }
      await tx.execute(
        `INSERT INTO catering_payments (quotation_id, amount, payment_date, method, received_by, note)
         VALUES (?,?,?,?,?,?)`,
        [quotationId, d.amount, d.paymentDate, d.method, actor.id, d.note || null],
      );
      // Recomputed from the ledger rather than incremented, so the roll-up can
      // never drift from the receipts behind it.
      await tx.execute(
        `UPDATE catering_quotations
            SET paid_amount = (SELECT COALESCE(SUM(amount),0) FROM catering_payments WHERE quotation_id = ?)
          WHERE id = ?`,
        [quotationId, quotationId],
      );
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not record the payment.' };
  }

  await audit({ userId: actor.id, action: 'PAYMENT', entity: 'catering_quotation', entityId: quotationId, after: d });
  refresh(quotationId);
  return { ok: true, message: 'Payment recorded.' };
}

export async function deleteCateringPayment(paymentId: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const row = await queryOne<any>(`SELECT * FROM catering_payments WHERE id = ?`, [paymentId]);
  if (!row) return { ok: false, error: 'Payment not found.' };
  const qid = Number(row.quotation_id);

  await withTransaction(async (tx) => {
    await tx.execute(`DELETE FROM catering_payments WHERE id = ?`, [paymentId]);
    await tx.execute(
      `UPDATE catering_quotations
          SET paid_amount = (SELECT COALESCE(SUM(amount),0) FROM catering_payments WHERE quotation_id = ?)
        WHERE id = ?`,
      [qid, qid],
    );
  });

  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_payment', entityId: paymentId, before: row });
  refresh(qid);
  return { ok: true, message: 'Payment removed.' };
}

// ═══════════════════════════════════════════════════════════════
// Business profile
// ═══════════════════════════════════════════════════════════════

const profileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  person: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(60).default(''),
  address: z.string().trim().max(400).default(''),
  terms: z.string().trim().max(500).default(''),
  note: z.string().trim().max(1000).default(''),
  // Short by design: it prints as a chip in the slip header, not a paragraph.
  taxNote: z.string().trim().max(120).default(''),
  quotaPrefix: z.string().trim().regex(/^[A-Za-z]{1,6}$/, 'Prefix must be 1–6 letters').default('SC'),
});

export async function saveCateringProfile(input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const entries: [string, string][] = [
    ['catering.name', d.name],
    ['catering.person', d.person],
    ['catering.phone', d.phone],
    ['catering.address', d.address],
    ['catering.terms', d.terms],
    ['catering.note', d.note],
    ['catering.tax_note', d.taxNote],
    ['catering.quota_prefix', d.quotaPrefix.toUpperCase()],
  ];
  for (const [k, v] of entries) {
    await execute(
      "INSERT INTO settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [k, v],
    );
  }
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_profile', after: d });
  refresh();
  revalidatePath(`${PATH}/settings`);
  return { ok: true, message: 'Catering profile saved.' };
}

// ── Standing rules printed on every quotation ──────────

const ruleSchema = z.object({
  text: z.string().trim().min(2, 'Rule text required').max(500),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

/** Create when `id` is null, update otherwise — same shape either way. */
export async function saveCateringRule(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  if (id) {
    const before = await queryOne(`SELECT * FROM catering_rules WHERE id = ?`, [id]);
    if (!before) return { ok: false, error: 'Rule not found.' };
    await execute(`UPDATE catering_rules SET text = ?, sort_order = ? WHERE id = ?`, [d.text, d.sortOrder, id]);
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_rule', entityId: id, before, after: d });
    refresh();
    return { ok: true, message: 'Rule updated.', id };
  }

  // New rules go to the end rather than colliding on 0.
  const max = await queryOne<{ m: number }>(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM catering_rules`);
  const order = d.sortOrder || Number(max?.m ?? 0) + 10;
  const res = await execute(
    `INSERT INTO catering_rules (text, sort_order, is_active) VALUES (?,?,1)`,
    [d.text, order],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'catering_rule', entityId: res.insertId, after: d });
  refresh();
  return { ok: true, message: 'Rule added.', id: res.insertId };
}

/** Switching a rule off stops it printing without losing the wording. */
export async function setCateringRuleActive(id: number, active: boolean): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_rules SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_rule', entityId: id, after: { active } });
  refresh();
  return { ok: true, message: active ? 'Rule will print.' : 'Rule hidden from the slip.' };
}

export async function deleteCateringRule(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`DELETE FROM catering_rules WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_rule', entityId: id });
  refresh();
  return { ok: true, message: 'Rule deleted.' };
}

// ── Invoices ───────────────────────────────────────────

/**
 * Number an invoice from its own series.
 *
 * Deliberately a separate sequence from the quotation prefix, so SC-18709 and
 * SI-1 can exist side by side and neither renumbers the other. Same
 * seed-from-the-highest-existing trick as `nextQuotaNo`, so an established
 * series carries on rather than restarting at 1.
 */
async function nextInvoiceNo(tx: {
  queryOne: <R>(sql: string, p?: unknown[]) => Promise<R | null>;
  execute: (sql: string, p?: unknown[]) => Promise<unknown>;
}): Promise<string> {
  const prefixRow = await tx.queryOne<{ value: string }>(
    "SELECT `value` FROM settings WHERE `key` = 'catering.invoice_prefix'",
  );
  const prefix = (prefixRow?.value || 'SI').trim();
  const key = `catering.invoice_seq.${prefix}`;

  const seeded = await tx.queryOne<{ n: number | string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(quota_no, '-', -1) AS UNSIGNED)), 0) AS n
       FROM catering_quotations WHERE quota_no LIKE ?`,
    [`${prefix}-%`],
  );
  const floor = Number(seeded?.n ?? 0);

  await tx.execute(
    `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = GREATEST(CAST(\`value\` AS UNSIGNED), ?) + 1`,
    [key, String(floor + 1), floor],
  );
  const row = await tx.queryOne<{ value: string }>(
    "SELECT `value` FROM settings WHERE `key` = ?", [key],
  );
  return `${prefix}-${Number(row?.value ?? floor + 1)}`;
}

/**
 * Raise an invoice from a quotation.
 *
 * The invoice is a NEW record with its own copy of every line, so adjusting
 * final quantities on it never rewrites the quotation the customer was
 * originally shown. The quotation stays exactly as it was, as the record of
 * what was promised.
 *
 * One invoice per quotation: raising a second would make the event ledger
 * ambiguous about which figure is the revenue.
 *
 * Receipts MOVE to the invoice rather than staying behind. An advance taken
 * against the quotation is money received for this event, and the invoice is
 * now the document that says what the event is owed. Leaving the receipts on
 * the quotation makes a fully paid invoice show as unpaid, which invites
 * someone to record the same payment a second time and doubles the revenue in
 * the ledger.
 */
export async function createInvoiceFromQuotation(quotationId: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');

  const q = await queryOne<any>(
    `SELECT * FROM catering_quotations WHERE id = ?`, [quotationId],
  );
  if (!q) return { ok: false, error: 'Quotation not found.' };
  if (q.doc_type === 'INVOICE') return { ok: false, error: 'That is already an invoice.' };

  const existing = await queryOne<{ id: number; quota_no: string }>(
    `SELECT id, quota_no FROM catering_quotations WHERE source_quotation_id = ? AND doc_type = 'INVOICE'`,
    [quotationId],
  );
  if (existing) {
    return { ok: false, error: `Invoice ${existing.quota_no} already exists for this quotation.` };
  }

  try {
    const created = await withTransaction(async (tx) => {
      const invoiceNo = await nextInvoiceNo(tx);
      const res = await tx.execute(
        `INSERT INTO catering_quotations
           (quota_no, doc_type, source_quotation_id, customer_id, customer_name, contact_no,
            place_of_function, quotation_date, delivery_date, persons,
            items_total, meat_total, grand_total, advance_amount, paid_amount, status, note, created_by)
         SELECT ?, 'INVOICE', ?, customer_id, customer_name, contact_no,
                place_of_function, CURDATE(), delivery_date, persons,
                items_total, meat_total, grand_total, advance_amount, 0, 'CONFIRMED', note, ?
           FROM catering_quotations WHERE id = ?`,
        [invoiceNo, quotationId, actor.id, quotationId],
      ) as { insertId: number };

      // Its own copy of the lines: the whole point of a separate record.
      await tx.execute(
        `INSERT INTO catering_quotation_items
           (quotation_id, section, menu_item_id, description, category, category_id,
            meat_type_id, qty, unit, rate, amount, sort_order)
         SELECT ?, section, menu_item_id, description, category, category_id,
                meat_type_id, qty, unit, rate, amount, sort_order
           FROM catering_quotation_items WHERE quotation_id = ?`,
        [res.insertId, quotationId],
      );

      // Receipts follow the event onto the invoice, which is now the
      // authoritative document. See the note above: leaving them behind is how
      // a payment ends up recorded twice.
      await tx.execute(
        `UPDATE catering_payments SET quotation_id = ? WHERE quotation_id = ?`,
        [res.insertId, quotationId],
      );
      const moved = await tx.queryOne<{ total: number | string }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM catering_payments WHERE quotation_id = ?`,
        [res.insertId],
      );
      const paid = Number(moved?.total ?? 0);
      await tx.execute(
        `UPDATE catering_quotations SET paid_amount = ?, status = ? WHERE id = ?`,
        [paid, paid >= Number(q.grand_total) && Number(q.grand_total) > 0 ? 'COMPLETED' : 'CONFIRMED', res.insertId],
      );

      // The quotation's job is done once it has been billed, and its receipts
      // now live on the invoice.
      await tx.execute(
        `UPDATE catering_quotations SET status = 'COMPLETED', paid_amount = 0 WHERE id = ?`,
        [quotationId],
      );

      return { id: res.insertId, invoiceNo, paid };
    });

    await audit({
      userId: actor.id, action: 'CREATE', entity: 'catering_invoice', entityId: created.id,
      after: { invoiceNo: created.invoiceNo, fromQuotation: q.quota_no },
    });
    refresh(created.id);
    return { ok: true, id: created.id, message: `Invoice ${created.invoiceNo} raised.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not raise the invoice.' };
  }
}

// ── Vendors ────────────────────────────────────────────

const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Vendor name required').max(160),
  category: z.string().trim().max(60).default(''),
  phone: z.string().trim().max(40).default(''),
  note: z.string().trim().max(500).default(''),
});

export async function saveCateringVendor(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM catering_vendors WHERE name = ? AND id <> ?`, [d.name, id ?? 0],
  );
  if (clash) return { ok: false, error: 'A vendor with that name already exists.' };

  if (id) {
    const before = await queryOne(`SELECT * FROM catering_vendors WHERE id = ?`, [id]);
    if (!before) return { ok: false, error: 'Vendor not found.' };
    await execute(
      `UPDATE catering_vendors SET name = ?, category = ?, phone = ?, note = ? WHERE id = ?`,
      [d.name, d.category, d.phone, d.note, id],
    );
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_vendor', entityId: id, before, after: d });
    refresh();
    return { ok: true, message: 'Vendor updated.', id };
  }

  const res = await execute(
    `INSERT INTO catering_vendors (name, category, phone, note, is_active) VALUES (?,?,?,?,1)`,
    [d.name, d.category, d.phone, d.note],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'catering_vendor', entityId: res.insertId, after: d });
  refresh();
  return { ok: true, message: 'Vendor added.', id: res.insertId };
}

export async function setCateringVendorActive(id: number, active: boolean): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_vendors SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_vendor', entityId: id, after: { active } });
  refresh();
  return { ok: true, message: active ? 'Vendor restored.' : 'Vendor archived.' };
}

export async function deleteCateringVendor(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const used = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM catering_payables WHERE vendor_id = ?`, [id],
  );
  if (Number(used?.n ?? 0) > 0) {
    return { ok: false, error: 'This vendor has bills against it — archive it instead of deleting.' };
  }
  await execute(`DELETE FROM catering_vendors WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_vendor', entityId: id });
  refresh();
  return { ok: true, message: 'Vendor deleted.' };
}

// ── Payables ───────────────────────────────────────────

const payableSchema = z.object({
  eventId: z.number().int().positive(),
  vendorId: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(200).default(''),
  amount: money,
  paidAmount: money.default(0),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().trim().max(500).default(''),
});

export async function saveCateringPayable(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = payableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;
  if (d.paidAmount > d.amount) return { ok: false, error: 'Paid cannot exceed the bill amount.' };
  if (!d.vendorId && !d.description.trim()) {
    return { ok: false, error: 'Pick a vendor or describe the bill.' };
  }

  // Bills belong to the event, so an invoice files them against the quotation
  // it came from rather than starting a second ledger of its own.
  const root = await eventRootId(d.eventId);

  if (id) {
    const before = await queryOne(`SELECT * FROM catering_payables WHERE id = ?`, [id]);
    if (!before) return { ok: false, error: 'Bill not found.' };
    await execute(
      `UPDATE catering_payables SET vendor_id = ?, description = ?, amount = ?, paid_amount = ?, due_date = ?, note = ?
        WHERE id = ?`,
      [d.vendorId ?? null, d.description, d.amount, d.paidAmount, d.dueDate || null, d.note, id],
    );
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_payable', entityId: id, before, after: d });
    refresh(d.eventId);
    return { ok: true, message: 'Bill updated.', id };
  }

  const res = await execute(
    `INSERT INTO catering_payables (event_id, vendor_id, description, amount, paid_amount, due_date, note, created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [root, d.vendorId ?? null, d.description, d.amount, d.paidAmount, d.dueDate || null, d.note, actor.id],
  );
  await audit({ userId: actor.id, action: 'CREATE', entity: 'catering_payable', entityId: res.insertId, after: { ...d, eventId: root } });
  refresh(d.eventId);
  return { ok: true, message: 'Bill added.', id: res.insertId };
}

/** Settle a bill in full. The common case, and one click rather than a form. */
export async function settleCateringPayable(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const row = await queryOne<{ amount: number; event_id: number }>(
    `SELECT amount, event_id FROM catering_payables WHERE id = ?`, [id],
  );
  if (!row) return { ok: false, error: 'Bill not found.' };
  await execute(`UPDATE catering_payables SET paid_amount = amount WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'catering_payable', entityId: id, after: { settled: true } });
  refresh(Number(row.event_id));
  return { ok: true, message: 'Bill marked paid.' };
}

export async function deleteCateringPayable(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`DELETE FROM catering_payables WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_payable', entityId: id });
  refresh();
  return { ok: true, message: 'Bill removed.' };
}

// ── Quotation templates ────────────────────────────────

const templateSchema = z.object({
  name: z.string().trim().min(2, 'Template name required').max(160),
  description: z.string().trim().max(400).default(''),
  persons: z.number().int().min(0).max(100000).default(0),
  note: z.string().trim().max(1000).default(''),
  lines: z.array(lineSchema).default([]),
});

/** Create when `id` is null, replace the lines wholesale when editing. */
export async function saveCateringTemplate(id: number | null, input: unknown): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM catering_templates WHERE name = ? AND id <> ?`, [d.name, id ?? 0],
  );
  if (clash) return { ok: false, error: 'A template with that name already exists.' };

  try {
    const templateId = await withTransaction(async (tx) => {
      let out = id ?? 0;
      if (id) {
        await tx.execute(
          `UPDATE catering_templates SET name = ?, description = ?, persons = ?, note = ? WHERE id = ?`,
          [d.name, d.description, d.persons, d.note, id],
        );
        // Replaced rather than diffed: line order and content are the whole
        // point of a template, and rewriting is simpler to reason about than
        // reconciling inserts, updates and deletes.
        await tx.execute(`DELETE FROM catering_template_items WHERE template_id = ?`, [id]);
      } else {
        const res = await tx.execute(
          `INSERT INTO catering_templates (name, description, persons, note, is_active, created_by)
           VALUES (?,?,?,?,1,?)`,
          [d.name, d.description, d.persons, d.note, actor.id],
        ) as { insertId: number };
        out = res.insertId;
      }

      let n = 0;
      for (const l of d.lines) {
        const amount = l.section === 'CHARGE' ? l.amount : cateringLineAmount(l.qty, l.unit as CateringUnit, l.rate);
        await tx.execute(
          `INSERT INTO catering_template_items
             (template_id, section, menu_item_id, description, category, category_id, meat_type_id, qty, unit, rate, amount, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [out, l.section, l.menuItemId ?? null, l.description, l.category ?? '', l.categoryId ?? null,
           l.meatTypeId ?? null, l.qty, l.unit, l.rate, amount, n++],
        );
      }
      return out;
    });

    await audit({
      userId: actor.id, action: id ? 'UPDATE' : 'CREATE', entity: 'catering_template',
      entityId: templateId, after: { name: d.name, lines: d.lines.length },
    });
    refresh();
    return { ok: true, id: templateId, message: id ? 'Template updated.' : 'Template saved.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the template.' };
  }
}

export async function deleteCateringTemplate(id: number): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const before = await queryOne<{ name: string }>(`SELECT name FROM catering_templates WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Template not found.' };
  // Safe to delete outright: quotations copy a template's lines, they do not
  // reference it, so nothing is orphaned.
  await execute(`DELETE FROM catering_templates WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'catering_template', entityId: id, before });
  refresh();
  return { ok: true, message: `Template "${before.name}" deleted.` };
}

export async function setCateringTemplateActive(id: number, active: boolean): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  await execute(`UPDATE catering_templates SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'catering_template', entityId: id, after: { active } });
  refresh();
  return { ok: true, message: active ? 'Template restored.' : 'Template archived.' };
}

/**
 * Capture a quotation that has already been built as a reusable template.
 *
 * This is where the time is actually saved: the operator does not sit down to
 * author a template, they finish a job and keep it.
 */
export async function createTemplateFromQuotation(quotationId: number, name: string): Promise<CateringResult> {
  const actor = await assertPermission('catering.manage');
  const trimmed = (name ?? '').trim();
  if (trimmed.length < 2) return { ok: false, error: 'Give the template a name.' };

  const q = await queryOne<any>(`SELECT * FROM catering_quotations WHERE id = ?`, [quotationId]);
  if (!q) return { ok: false, error: 'Quotation not found.' };

  const clash = await queryOne<{ id: number }>(`SELECT id FROM catering_templates WHERE name = ?`, [trimmed]);
  if (clash) return { ok: false, error: 'A template with that name already exists.' };

  try {
    const templateId = await withTransaction(async (tx) => {
      const res = await tx.execute(
        `INSERT INTO catering_templates (name, description, persons, note, is_active, created_by)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [trimmed, `Saved from ${q.quota_no}`, Number(q.persons ?? 0), q.note ?? '', actor.id],
      ) as { insertId: number };

      await tx.execute(
        `INSERT INTO catering_template_items
           (template_id, section, menu_item_id, description, category, category_id, meat_type_id, qty, unit, rate, amount, sort_order)
         SELECT ?, section, menu_item_id, description, category, category_id, meat_type_id, qty, unit, rate, amount, sort_order
           FROM catering_quotation_items WHERE quotation_id = ?`,
        [res.insertId, quotationId],
      );
      return res.insertId;
    });

    await audit({
      userId: actor.id, action: 'CREATE', entity: 'catering_template', entityId: templateId,
      after: { name: trimmed, from: q.quota_no },
    });
    refresh();
    return { ok: true, id: templateId, message: `Saved as template "${trimmed}".` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the template.' };
  }
}
