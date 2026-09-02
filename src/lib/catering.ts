/**
 * Catering — read layer.
 *
 * A separate business from the ballroom halls: its own customers, its own
 * quotation series and its own books. Nothing here joins to `bookings`, and no
 * ballroom query joins to these tables. The only place the two meet is the
 * Super Admin's combined view.
 */
import { query, queryOne } from '@/lib/db';
import { monthRange, monthLabel } from '@/lib/format';
import {
  CATERING_BILLABLE, CATERING_PROFILE_DEFAULTS,
  type CateringCategoryRow, type CateringCustomerRow, type CateringLineRow,
  type CateringMeatTypeRow, type CateringMenuItemRow,
  type BillFilter, type CateringBillRow,
  type CateringDocType, type CateringEventLedger, type CateringPayableRow,
  type CateringPaymentRow, type CateringProfile, type CateringQuotationRow,
  type CateringRuleRow, type CateringTemplateRow, type CateringVendorRow,
  type CateringStatus,
} from '@/lib/types';

const num = (v: unknown) => Number(v ?? 0);
const BILLABLE_SQL = CATERING_BILLABLE.map((s) => `'${s}'`).join(',');

// ── Business profile ───────────────────────────────────

/**
 * The catering arm's trading identity. Held in `settings` under a `catering.`
 * prefix so the client can edit it without a deploy, exactly like the ballroom
 * profile. Falls back to defaults when a key has never been saved.
 */
export async function getCateringProfile(): Promise<CateringProfile> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT `key`, `value` FROM settings WHERE `key` LIKE 'catering.%'",
  );
  const map = new Map(rows.map((r) => [r.key.replace(/^catering\./, ''), r.value]));
  const KEY: Partial<Record<keyof CateringProfile, string>> = { quotaPrefix: 'quota_prefix', taxNote: 'tax_note' };
  const pick = (k: keyof CateringProfile) => map.get(KEY[k] ?? k) ?? CATERING_PROFILE_DEFAULTS[k];
  return {
    name: pick('name'),
    person: pick('person'),
    phone: pick('phone'),
    address: pick('address'),
    terms: pick('terms'),
    note: pick('note'),
    taxNote: pick('taxNote'),
    quotaPrefix: pick('quotaPrefix'),
  };
}

/**
 * The standing conditions printed under the terms on every quotation slip.
 *
 * `activeOnly` for the slip — a rule switched off should stop printing without
 * being deleted — and the full list for the management screen.
 */
export async function getCateringRules(activeOnly = false): Promise<CateringRuleRow[]> {
  const rows = await query<any>(
    `SELECT * FROM catering_rules ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY is_active DESC, sort_order, id`,
  );
  return rows.map((r) => ({
    id: Number(r.id), text: r.text, sortOrder: Number(r.sort_order ?? 0),
    isActive: (Number(r.is_active) ? 1 : 0) as 0 | 1,
  }));
}

// ── Customers ──────────────────────────────────────────

export async function getCateringCustomers(search?: string): Promise<CateringCustomerRow[]> {
  const where = search ? 'WHERE c.name LIKE ? OR c.phone LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`] : [];
  const rows = await query<any>(
    `SELECT c.*, (SELECT COUNT(*) FROM catering_quotations q WHERE q.customer_id = c.id) AS quotation_count
       FROM catering_customers c ${where} ORDER BY c.name`,
    params,
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, phone: r.phone ?? '', phone2: r.phone2 ?? '',
    address: r.address ?? '', note: r.note ?? '', quotationCount: Number(r.quotation_count ?? 0),
  }));
}

// ── Menu ───────────────────────────────────────────────

export async function getCateringMenu(activeOnly = false): Promise<CateringMenuItemRow[]> {
  const rows = await query<any>(
    `SELECT m.*, (SELECT COUNT(*) FROM catering_quotation_items i WHERE i.menu_item_id = m.id) AS used_count
       FROM catering_menu_items m
      ${activeOnly ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.is_active DESC, m.sort_order, m.name`,
  );
  if (rows.length === 0) return [];

  // Variants in one round trip rather than a query per dish.
  const ids = rows.map((r: any) => Number(r.id));
  const vRows = await query<any>(
    `SELECT v.id AS variant_id, v.menu_item_id, v.category_id, v.rate, v.meat_type_id,
            c.name AS category_name, mt.name AS meat_name, mt.rate AS meat_rate
       FROM catering_menu_item_categories v
       JOIN catering_categories c ON c.id = v.category_id
       LEFT JOIN catering_meat_types mt ON mt.id = v.meat_type_id
      WHERE v.menu_item_id IN (${ids.map(() => '?').join(',')}) AND v.is_active = 1
      ORDER BY c.sort_order, c.name`,
    ids,
  );

  // A variant can draw on more than one meat: mixed karahi is half chicken,
  // half beef. Fetched in one round trip and grouped, rather than a query per
  // variant.
  const variantIds = vRows.map((v: any) => Number(v.variant_id));
  const meatRows = variantIds.length
    ? await query<any>(
      `SELECT vm.variant_id, vm.meat_type_id, vm.share, mt.name AS meat_name, mt.rate AS meat_rate
         FROM catering_variant_meats vm
         JOIN catering_meat_types mt ON mt.id = vm.meat_type_id
        WHERE vm.variant_id IN (${variantIds.map(() => '?').join(',')})
        ORDER BY vm.share DESC, mt.name`,
      variantIds,
    )
    : [];
  const meatsByVariant = new Map<number, { meatTypeId: number; meatName: string; meatRate: number; share: number }[]>();
  for (const m of meatRows) {
    const k = Number(m.variant_id);
    if (!meatsByVariant.has(k)) meatsByVariant.set(k, []);
    meatsByVariant.get(k)!.push({
      meatTypeId: Number(m.meat_type_id), meatName: m.meat_name,
      meatRate: num(m.meat_rate), share: num(m.share),
    });
  }
  const byItem = new Map<number, CateringMenuItemRow['variants']>();
  for (const v of vRows) {
    const k = Number(v.menu_item_id);
    if (!byItem.has(k)) byItem.set(k, []);
    const meats = meatsByVariant.get(Number(v.variant_id)) ?? [];
    byItem.get(k)!.push({
      categoryId: Number(v.category_id), categoryName: v.category_name, rate: num(v.rate),
      // Kept in step with the split table: the primary is simply the largest
      // share, so callers that only understand one meat still get the main one.
      meatTypeId: meats.length ? meats[0].meatTypeId : (v.meat_type_id === null ? null : Number(v.meat_type_id)),
      meatTypeName: meats.length ? meats[0].meatName : (v.meat_name ?? null),
      meatRate: meats.length ? meats[0].meatRate
        : (v.meat_rate === null || v.meat_rate === undefined ? null : num(v.meat_rate)),
      meats,
    });
  }

  return rows.map((r: any) => ({
    id: Number(r.id), name: r.name, unit: r.unit,
    defaultRate: num(r.default_rate), sortOrder: Number(r.sort_order ?? 0),
    isActive: r.is_active ? 1 : 0, usedCount: Number(r.used_count ?? 0),
    variants: byItem.get(Number(r.id)) ?? [],
  }));
}

/** Meat types and their current rates. */
export async function getCateringMeatTypes(activeOnly = false): Promise<CateringMeatTypeRow[]> {
  const rows = await query<any>(
    `SELECT m.*, (SELECT COUNT(*) FROM catering_menu_item_categories v WHERE v.meat_type_id = m.id) AS used_count
       FROM catering_meat_types m
      ${activeOnly ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.is_active DESC, m.sort_order, m.name`,
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, unit: r.unit, rate: num(r.rate),
    sortOrder: Number(r.sort_order ?? 0), isActive: r.is_active ? 1 : 0,
    usedCount: Number(r.used_count ?? 0),
  }));
}

/** Managed categories — BEEF, CHICKEN, BAR B Q … */
export async function getCateringCategories(activeOnly = false): Promise<CateringCategoryRow[]> {
  const rows = await query<any>(
    `SELECT c.*, (SELECT COUNT(*) FROM catering_menu_item_categories v WHERE v.category_id = c.id) AS item_count
       FROM catering_categories c
      ${activeOnly ? 'WHERE c.is_active = 1' : ''}
      ORDER BY c.is_active DESC, c.sort_order, c.name`,
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, sortOrder: Number(r.sort_order ?? 0),
    isActive: r.is_active ? 1 : 0, itemCount: Number(r.item_count ?? 0),
  }));
}

// ── Quotations ─────────────────────────────────────────

const Q_SELECT = `
  SELECT q.*, u.name AS created_by_name
    FROM catering_quotations q
    LEFT JOIN users u ON u.id = q.created_by`;

function mapQuotation(r: any): CateringQuotationRow {
  const grand = num(r.grand_total);
  const paid = num(r.paid_amount);
  return {
    id: Number(r.id),
    quotaNo: r.quota_no,
    docType: (r.doc_type ?? 'QUOTATION') as CateringDocType,
    sourceQuotationId: r.source_quotation_id === null || r.source_quotation_id === undefined
      ? null : Number(r.source_quotation_id),
    customerId: r.customer_id === null ? null : Number(r.customer_id),
    customerName: r.customer_name ?? '',
    contactNo: r.contact_no ?? '',
    placeOfFunction: r.place_of_function ?? '',
    quotationDate: r.quotation_date,
    deliveryDate: r.delivery_date ?? null,
    persons: Number(r.persons ?? 0),
    itemsTotal: num(r.items_total),
    meatTotal: num(r.meat_total),
    grandTotal: grand,
    advanceAmount: num(r.advance_amount),
    paidAmount: paid,
    status: r.status,
    note: r.note ?? null,
    createdBy: r.created_by === null ? null : Number(r.created_by),
    createdByName: r.created_by_name ?? null,
    createdAt: r.created_at,
    balance: grand - paid,
  };
}

export async function getCateringQuotations(opts: {
  status?: CateringStatus | 'ALL';
  /** Omitted lists both. The screens always pass one. */
  docType?: CateringDocType;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<CateringQuotationRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.docType) { where.push('q.doc_type = ?'); params.push(opts.docType); }
  if (opts.status && opts.status !== 'ALL') { where.push('q.status = ?'); params.push(opts.status); }
  if (opts.from) { where.push('q.delivery_date >= ?'); params.push(opts.from); }
  if (opts.to) { where.push('q.delivery_date <= ?'); params.push(opts.to); }
  if (opts.search) {
    where.push('(q.quota_no LIKE ? OR q.customer_name LIKE ? OR q.contact_no LIKE ? OR q.place_of_function LIKE ?)');
    const like = `%${opts.search}%`;
    params.push(like, like, like, like);
  }
  // LIMIT will not bind through mysql2's binary protocol, so it is inlined
  // after being coerced to a safe integer.
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(opts.limit ?? 200)) || 200));
  const rows = await query<any>(
    `${Q_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY q.quotation_date DESC, q.id DESC LIMIT ${limit}`,
    params,
  );
  return rows.map(mapQuotation);
}

export async function getCateringQuotation(id: number): Promise<CateringQuotationRow | null> {
  const row = await queryOne<any>(`${Q_SELECT} WHERE q.id = ?`, [id]);
  if (!row) return null;
  const q = mapQuotation(row);
  q.lines = await getCateringLines(id);
  return q;
}

export async function getCateringLines(quotationId: number): Promise<CateringLineRow[]> {
  const rows = await query<any>(
    `SELECT * FROM catering_quotation_items
      WHERE quotation_id = ?
      ORDER BY FIELD(section,'DISH','CHARGE','MEAT'), sort_order, id`,
    [quotationId],
  );
  return rows.map((r) => ({
    id: Number(r.id), quotationId: Number(r.quotation_id), section: r.section,
    menuItemId: r.menu_item_id === null ? null : Number(r.menu_item_id),
    description: r.description, category: r.category ?? '',
    categoryId: r.category_id === null || r.category_id === undefined ? null : Number(r.category_id),
    meatTypeId: r.meat_type_id === null || r.meat_type_id === undefined ? null : Number(r.meat_type_id),
    qty: num(r.qty), unit: r.unit, rate: num(r.rate), amount: num(r.amount),
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

export async function getCateringPayments(quotationId: number): Promise<CateringPaymentRow[]> {
  const rows = await query<any>(
    `SELECT p.*, u.name AS received_by_name
       FROM catering_payments p LEFT JOIN users u ON u.id = p.received_by
      WHERE p.quotation_id = ? ORDER BY p.payment_date DESC, p.id DESC`,
    [quotationId],
  );
  return rows.map((r) => ({
    id: Number(r.id), quotationId: Number(r.quotation_id), amount: num(r.amount),
    paymentDate: r.payment_date, method: r.method,
    receivedBy: r.received_by === null ? null : Number(r.received_by),
    receivedByName: r.received_by_name ?? null, note: r.note ?? null,
  }));
}

// ── Financials ─────────────────────────────────────────

export interface CateringSummary {
  quotations: number;
  confirmed: number;
  revenue: number;
  received: number;
  outstanding: number;
  persons: number;
  /** Value of quotations not yet confirmed — excluded from revenue. */
  pipeline: number;
  pipelineCount: number;
  avgPerOrder: number;
}

export async function getCateringSummary(from: string, to: string): Promise<CateringSummary> {
  const r = await queryOne<any>(
    `SELECT
       COUNT(*)                                                                  AS quotations,
       COUNT(CASE WHEN status IN (${BILLABLE_SQL}) THEN 1 END)                    AS confirmed,
       COALESCE(SUM(CASE WHEN status IN (${BILLABLE_SQL}) THEN grand_total END),0) AS revenue,
       COALESCE(SUM(CASE WHEN status IN (${BILLABLE_SQL}) THEN paid_amount END),0) AS received,
       COALESCE(SUM(CASE WHEN status IN (${BILLABLE_SQL}) THEN persons END),0)     AS persons,
       COUNT(CASE WHEN status = 'QUOTATION' THEN 1 END)                           AS pipeline_count,
       COALESCE(SUM(CASE WHEN status = 'QUOTATION' THEN grand_total END),0)       AS pipeline
     FROM catering_quotations
     WHERE delivery_date BETWEEN ? AND ?`,
    [from, to],
  );
  const confirmed = Number(r?.confirmed ?? 0);
  const revenue = num(r?.revenue);
  const received = num(r?.received);
  return {
    quotations: Number(r?.quotations ?? 0),
    confirmed,
    revenue,
    received,
    outstanding: revenue - received,
    persons: Number(r?.persons ?? 0),
    pipeline: num(r?.pipeline),
    pipelineCount: Number(r?.pipeline_count ?? 0),
    avgPerOrder: confirmed > 0 ? Math.round(revenue / confirmed) : 0,
  };
}

/** Month-by-month catering trend, oldest first. */
export async function getCateringTrend(year: number, month: number, months = 6) {
  const out: { label: string; revenue: number; received: number; orders: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const { from, to } = monthRange(y, m);
    const s = await getCateringSummary(from, to);
    out.push({ label: monthLabel(y, m), revenue: s.revenue, received: s.received, orders: s.confirmed });
  }
  return out;
}

/** Which dishes actually earn — the catering equivalent of a sales mix. */
export async function getCateringDishMix(from: string, to: string, limit = 15) {
  const n = Math.max(1, Math.min(100, Math.trunc(limit) || 15));
  const rows = await query<any>(
    `SELECT i.description, i.category, SUM(i.qty) AS qty, SUM(i.amount) AS revenue,
            COUNT(DISTINCT q.id) AS orders
       FROM catering_quotation_items i
       JOIN catering_quotations q ON q.id = i.quotation_id
      WHERE q.status IN (${BILLABLE_SQL}) AND q.delivery_date BETWEEN ? AND ?
        AND i.section = 'DISH'
      GROUP BY i.description, i.category
      ORDER BY revenue DESC
      LIMIT ${n}`,
    [from, to],
  );
  return rows.map((r) => ({
    description: r.description as string,
    category: (r.category ?? '') as string,
    qty: num(r.qty),
    revenue: num(r.revenue),
    orders: Number(r.orders ?? 0),
  }));
}

/** Quotations with money still owed. */
export async function getCateringOutstanding(limit = 10): Promise<CateringQuotationRow[]> {
  const n = Math.max(1, Math.min(100, Math.trunc(limit) || 10));
  const rows = await query<any>(
    `${Q_SELECT} WHERE q.status IN (${BILLABLE_SQL}) AND q.grand_total > q.paid_amount
     ORDER BY (q.grand_total - q.paid_amount) DESC LIMIT ${n}`,
  );
  return rows.map(mapQuotation);
}

/** Next few deliveries — what the kitchen has to cook. */
export async function getCateringUpcoming(limit = 8): Promise<CateringQuotationRow[]> {
  const n = Math.max(1, Math.min(50, Math.trunc(limit) || 8));
  const rows = await query<any>(
    `${Q_SELECT} WHERE q.status IN (${BILLABLE_SQL}) AND q.delivery_date >= CURDATE()
     ORDER BY q.delivery_date ASC LIMIT ${n}`,
  );
  return rows.map(mapQuotation);
}

// ── Vendors ────────────────────────────────────────────

export async function getCateringVendors(activeOnly = false): Promise<CateringVendorRow[]> {
  const rows = await query<any>(
    `SELECT v.*, (SELECT COUNT(*) FROM catering_payables p WHERE p.vendor_id = v.id) AS bill_count
       FROM catering_vendors v
      ${activeOnly ? 'WHERE v.is_active = 1' : ''}
      ORDER BY v.is_active DESC, v.name`,
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, category: r.category ?? '', phone: r.phone ?? '',
    note: r.note ?? '', isActive: (Number(r.is_active) ? 1 : 0) as 0 | 1,
    billCount: Number(r.bill_count ?? 0),
  }));
}

// ── Payables ───────────────────────────────────────────

/**
 * The event a record belongs to.
 *
 * An invoice copied from a quotation is a separate row, but both describe one
 * event. Bills are filed against the ORIGINAL quotation's id so that a bill
 * entered while quoting and one entered after invoicing land on the same
 * ledger instead of splitting it.
 */
export async function eventRootId(quotationId: number): Promise<number> {
  const row = await queryOne<{ source_quotation_id: number | null }>(
    `SELECT source_quotation_id FROM catering_quotations WHERE id = ?`, [quotationId],
  );
  return row?.source_quotation_id ? Number(row.source_quotation_id) : quotationId;
}

export async function getEventPayables(eventId: number): Promise<CateringPayableRow[]> {
  const rows = await query<any>(
    `SELECT p.*, COALESCE(v.name, '') AS vendor_name
       FROM catering_payables p
       LEFT JOIN catering_vendors v ON v.id = p.vendor_id
      WHERE p.event_id = ?
      ORDER BY p.id`,
    [eventId],
  );
  return rows.map((r) => ({
    id: Number(r.id), eventId: Number(r.event_id),
    vendorId: r.vendor_id === null ? null : Number(r.vendor_id),
    vendorName: r.vendor_name ?? '', description: r.description ?? '',
    amount: num(r.amount), paidAmount: num(r.paid_amount),
    dueDate: r.due_date ?? null, note: r.note ?? '',
  }));
}

// ── Event ledger ───────────────────────────────────────

/**
 * Revenue against vendor cost, per event.
 *
 * One row per EVENT, not per document: an event that has been invoiced is
 * counted once, at the invoice's figure, with the quotation folded into it.
 * Revenue falls back to the quotation while an event is still in progress, so
 * a working profit is visible before the invoice is raised.
 *
 * Cancelled events are excluded: they earned nothing and their bills, if any,
 * are a different conversation.
 */
export async function getEventLedger(opts: { from?: string; to?: string } = {}): Promise<CateringEventLedger[]> {
  const where: string[] = ["q.doc_type = 'QUOTATION'", "q.status <> 'CANCELLED'"];
  const params: unknown[] = [];
  if (opts.from) { where.push('q.quotation_date >= ?'); params.push(opts.from); }
  if (opts.to) { where.push('q.quotation_date <= ?'); params.push(opts.to); }

  const rows = await query<any>(
    `SELECT q.id, q.quota_no, q.customer_name, q.delivery_date, q.status,
            q.grand_total AS quote_total,
            inv.id           AS invoice_id,
            inv.quota_no     AS invoice_no,
            inv.grand_total  AS invoice_total,
            COALESCE((SELECT SUM(p.amount)      FROM catering_payables p WHERE p.event_id = q.id), 0) AS payable_total,
            COALESCE((SELECT SUM(p.paid_amount) FROM catering_payables p WHERE p.event_id = q.id), 0) AS payable_paid,
            COALESCE((SELECT SUM(pay.amount) FROM catering_payments pay
                       WHERE pay.quotation_id = q.id
                          OR pay.quotation_id = inv.id), 0) AS received
       FROM catering_quotations q
       LEFT JOIN catering_quotations inv
              ON inv.source_quotation_id = q.id AND inv.doc_type = 'INVOICE'
      WHERE ${where.join(' AND ')}
      ORDER BY q.quotation_date DESC, q.id DESC`,
    params,
  );

  return rows.map((r) => {
    const invoiced = r.invoice_id !== null && r.invoice_id !== undefined;
    const revenue = invoiced ? num(r.invoice_total) : num(r.quote_total);
    const payableTotal = num(r.payable_total);
    return {
      eventId: Number(r.id),
      quotaNo: r.quota_no,
      invoiceNo: invoiced ? r.invoice_no : null,
      customerName: r.customer_name ?? '',
      eventDate: r.delivery_date ?? null,
      status: r.status as CateringStatus,
      invoiced,
      revenue,
      received: num(r.received),
      payableTotal,
      payablePaid: num(r.payable_paid),
      profit: revenue - payableTotal,
    };
  });
}

// ── Bill listings across events ────────────────────────

const BILL_SELECT = `
  SELECT p.*, COALESCE(v.name, '') AS vendor_name,
         q.quota_no, q.customer_name, q.delivery_date
    FROM catering_payables p
    LEFT JOIN catering_vendors v ON v.id = p.vendor_id
    JOIN catering_quotations q ON q.id = p.event_id`;

function mapBill(r: any): CateringBillRow {
  const amount = num(r.amount);
  const paid = num(r.paid_amount);
  return {
    id: Number(r.id),
    eventId: Number(r.event_id),
    quotaNo: r.quota_no,
    customerName: r.customer_name ?? '',
    eventDate: r.delivery_date ?? null,
    vendorId: r.vendor_id === null ? null : Number(r.vendor_id),
    vendorName: r.vendor_name ?? '',
    description: r.description ?? '',
    amount,
    paidAmount: paid,
    outstanding: Math.max(0, amount - paid),
    // A zero-amount bill is a placeholder, not something that has been settled.
    settled: amount > 0 && paid >= amount - 0.01,
    dueDate: r.due_date ?? null,
    note: r.note ?? '',
  };
}

/**
 * Every vendor bill, newest first.
 *
 * The paid/unpaid split is done in SQL rather than by filtering in the page,
 * so the totals shown above the table always describe the rows underneath it.
 */
export async function getCateringBills(opts: {
  filter?: BillFilter;
  vendorId?: number;
  search?: string;
} = {}): Promise<CateringBillRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.vendorId) { where.push('p.vendor_id = ?'); params.push(opts.vendorId); }
  if (opts.filter === 'PAID') where.push('p.amount > 0 AND p.paid_amount >= p.amount - 0.01');
  if (opts.filter === 'UNPAID') where.push('(p.amount <= 0 OR p.paid_amount < p.amount - 0.01)');
  if (opts.search) {
    where.push('(v.name LIKE ? OR p.description LIKE ? OR q.quota_no LIKE ? OR q.customer_name LIKE ?)');
    const like = `%${opts.search}%`;
    params.push(like, like, like, like);
  }

  const rows = await query<any>(
    `${BILL_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY p.id DESC`,
    params,
  );
  return rows.map(mapBill);
}

/** One vendor, plus every bill ever raised against them. */
export async function getVendorWithBills(vendorId: number): Promise<
  { vendor: CateringVendorRow; bills: CateringBillRow[] } | null
> {
  const v = await queryOne<any>(
    `SELECT * FROM catering_vendors WHERE id = ?`, [vendorId],
  );
  if (!v) return null;
  const bills = await getCateringBills({ vendorId });
  return {
    vendor: {
      id: Number(v.id), name: v.name, category: v.category ?? '', phone: v.phone ?? '',
      note: v.note ?? '', isActive: (Number(v.is_active) ? 1 : 0) as 0 | 1,
      billCount: bills.length,
    },
    bills,
  };
}

// ── Printed report ─────────────────────────────────────

export interface CateringReportRow {
  sNo: number;
  eventId: number;
  date: string;
  customer: string;
  /** The invoice number once raised, otherwise the quotation's. */
  docNo: string;
  invoiced: boolean;
  /** Dishes and charges. The catering answer to the ballroom's hall charge. */
  items: number;
  /** Raw meat billed to the customer. */
  meat: number;
  total: number;
  vendor: number;
  received: number;
  profit: number;
  /** Every distinct method used, e.g. "CASH" or "CASH, BANK". */
  paymentType: string;
}

export interface CateringReport {
  label: string;
  generated: string;
  rows: CateringReportRow[];
  totals: {
    items: number; meat: number; total: number;
    vendor: number; received: number; profit: number;
  };
  /** How the money actually came in, across the period. */
  byMethod: { method: string; amount: number }[];
}

/**
 * One row per EVENT for a period, in the shape the ballroom's monthly sale
 * page uses: the three revenue columns, then what it cost and what it made.
 *
 * Revenue is the invoice where one has been raised and the quotation before
 * that, matching the event ledger, so the two screens can never disagree.
 * Cancelled events are left out; they earned nothing.
 */
export async function getCateringReport(from: string, to: string, label: string): Promise<CateringReport> {
  const rows = await query<any>(
    `SELECT q.id, q.quota_no, q.customer_name, q.delivery_date, q.quotation_date,
            q.items_total AS q_items, q.meat_total AS q_meat, q.grand_total AS q_total,
            inv.id AS invoice_id, inv.quota_no AS invoice_no,
            inv.items_total AS i_items, inv.meat_total AS i_meat, inv.grand_total AS i_total,
            COALESCE((SELECT SUM(p.amount) FROM catering_payables p WHERE p.event_id = q.id), 0) AS vendor_total,
            COALESCE((SELECT SUM(pay.amount) FROM catering_payments pay
                       WHERE pay.quotation_id = q.id OR pay.quotation_id = inv.id), 0) AS received,
            (SELECT GROUP_CONCAT(DISTINCT pay.method ORDER BY pay.method SEPARATOR ', ')
               FROM catering_payments pay
              WHERE pay.quotation_id = q.id OR pay.quotation_id = inv.id) AS methods
       FROM catering_quotations q
       LEFT JOIN catering_quotations inv
              ON inv.source_quotation_id = q.id AND inv.doc_type = 'INVOICE'
      WHERE q.doc_type = 'QUOTATION'
        AND q.status <> 'CANCELLED'
        AND COALESCE(q.delivery_date, q.quotation_date) BETWEEN ? AND ?
      ORDER BY COALESCE(q.delivery_date, q.quotation_date), q.id`,
    [from, to],
  );

  const out: CateringReportRow[] = rows.map((r, i) => {
    const invoiced = r.invoice_id !== null && r.invoice_id !== undefined;
    const items = invoiced ? num(r.i_items) : num(r.q_items);
    const meat = invoiced ? num(r.i_meat) : num(r.q_meat);
    const total = invoiced ? num(r.i_total) : num(r.q_total);
    const vendor = num(r.vendor_total);
    return {
      sNo: i + 1,
      eventId: Number(r.id),
      date: r.delivery_date ?? r.quotation_date,
      customer: r.customer_name ?? '',
      docNo: invoiced ? r.invoice_no : r.quota_no,
      invoiced,
      items, meat, total, vendor,
      received: num(r.received),
      profit: total - vendor,
      paymentType: r.methods ?? '',
    };
  });

  const totals = out.reduce(
    (a, r) => ({
      items: a.items + r.items, meat: a.meat + r.meat, total: a.total + r.total,
      vendor: a.vendor + r.vendor, received: a.received + r.received, profit: a.profit + r.profit,
    }),
    { items: 0, meat: 0, total: 0, vendor: 0, received: 0, profit: 0 },
  );

  const methodRows = await query<any>(
    `SELECT pay.method, SUM(pay.amount) AS amount
       FROM catering_payments pay
       JOIN catering_quotations d ON d.id = pay.quotation_id
      WHERE pay.payment_date BETWEEN ? AND ?
      GROUP BY pay.method
      ORDER BY amount DESC`,
    [from, to],
  );

  return {
    label,
    generated: new Date().toISOString().slice(0, 10),
    rows: out,
    totals,
    byMethod: methodRows.map((m) => ({ method: m.method ?? 'CASH', amount: num(m.amount) })),
  };
}

// ── Quotation templates ────────────────────────────────

/** Lines belonging to a template, in the order they will land on the slip. */
export async function getTemplateLines(templateId: number): Promise<CateringLineRow[]> {
  const rows = await query<any>(
    `SELECT * FROM catering_template_items
      WHERE template_id = ?
      ORDER BY FIELD(section,'DISH','CHARGE','MEAT'), sort_order, id`,
    [templateId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    // The line's owner is a template, but every consumer of CateringLineRow
    // only ever reads this to key a list, so the template id serves.
    quotationId: Number(r.template_id),
    section: r.section,
    menuItemId: r.menu_item_id === null ? null : Number(r.menu_item_id),
    description: r.description,
    category: r.category ?? '',
    categoryId: r.category_id === null || r.category_id === undefined ? null : Number(r.category_id),
    meatTypeId: r.meat_type_id === null || r.meat_type_id === undefined ? null : Number(r.meat_type_id),
    qty: num(r.qty), unit: r.unit, rate: num(r.rate), amount: num(r.amount),
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

export async function getCateringTemplates(activeOnly = false): Promise<CateringTemplateRow[]> {
  const rows = await query<any>(
    `SELECT t.*, u.name AS created_by_name,
            (SELECT COUNT(*) FROM catering_template_items i WHERE i.template_id = t.id) AS line_count,
            COALESCE((SELECT SUM(i.amount) FROM catering_template_items i WHERE i.template_id = t.id), 0) AS value
       FROM catering_templates t
       LEFT JOIN users u ON u.id = t.created_by
      ${activeOnly ? 'WHERE t.is_active = 1' : ''}
      ORDER BY t.is_active DESC, t.name`,
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, description: r.description ?? '',
    persons: Number(r.persons ?? 0), note: r.note ?? '',
    isActive: (Number(r.is_active) ? 1 : 0) as 0 | 1,
    createdByName: r.created_by_name ?? null,
    lineCount: Number(r.line_count ?? 0),
    value: num(r.value),
  }));
}

export async function getCateringTemplate(id: number): Promise<CateringTemplateRow | null> {
  const r = await queryOne<any>(
    `SELECT t.*, u.name AS created_by_name FROM catering_templates t
      LEFT JOIN users u ON u.id = t.created_by WHERE t.id = ?`, [id],
  );
  if (!r) return null;
  const lines = await getTemplateLines(id);
  return {
    id: Number(r.id), name: r.name, description: r.description ?? '',
    persons: Number(r.persons ?? 0), note: r.note ?? '',
    isActive: (Number(r.is_active) ? 1 : 0) as 0 | 1,
    createdByName: r.created_by_name ?? null,
    lines,
    lineCount: lines.length,
    value: lines.reduce((s, l) => s + l.amount, 0),
  };
}
