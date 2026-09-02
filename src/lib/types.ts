// ── Roles & permissions ────────────────────────────────
export type Role =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'SUPERVISOR'
  | 'RECEPTIONIST'
  | 'VIEWER'
  // Not a rank in the ballroom hierarchy — a different business entirely.
  | 'CATERING';

/** Ordered most- to least-privileged — drives sort order and the role picker. */
export const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTANT', 'SUPERVISOR', 'RECEPTIONIST', 'VIEWER', 'CATERING'];

export const ROLE_META: Record<Role, { label: string; hint: string }> = {
  SUPER_ADMIN:  { label: 'Super Admin',  hint: 'Everything the Owner sees, plus the Live Cooking figures' },
  OWNER:        { label: 'Owner',        hint: 'Full banquet access, including danger zone' },
  MANAGER:      { label: 'Manager',      hint: 'Runs operations day to day' },
  ACCOUNTANT:   { label: 'Accountant',   hint: 'Money: petty cash, income, salaries, reports' },
  SUPERVISOR:   { label: 'Supervisor',   hint: 'Floor & staff: bookings, attendance, reviews' },
  RECEPTIONIST: { label: 'Receptionist', hint: 'Front desk: enquiries, bookings, payments' },
  VIEWER:       { label: 'Viewer',       hint: 'Read only' },
  CATERING:     { label: 'Catering',     hint: 'The catering business only — no ballroom access' },
};

/**
 * Granular capabilities. Roles map to a default set, but users can be
 * granted/revoked individual permissions (client wants per-user access).
 */
export type Permission =
  | 'bookings.view'
  | 'bookings.create'
  | 'bookings.edit'
  | 'bookings.delete'
  | 'payments.record'
  | 'pettycash.view'
  | 'pettycash.edit'
  | 'pettycash.lock'
  | 'float.view'
  | 'float.disburse'
  | 'float.reconcile'
  | 'income.view'
  | 'income.adjust'
  | 'sale.view'
  | 'reports.generate'
  | 'profit.view'
  | 'users.manage'
  | 'settings.manage'
  | 'leads.view'
  | 'halls.manage'
  | 'rules.manage'
  | 'attendance.view'
  | 'attendance.mark'
  | 'employees.manage'
  | 'reviews.manage'
  | 'stock.view'
  | 'stock.manage'
  // Live Cooking — an ordinary banquet service whose FIGURES are restricted.
  // Held by SUPER_ADMIN only by default; see LIVE_COOKING_PERMISSIONS below.
  | 'livecooking.view'
  // Catering — a separate business line with its own portal at /catering.
  | 'catering.view'
  | 'catering.manage'
  | 'catering.reports';

export const ALL_PERMISSIONS: Permission[] = [
  'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.delete',
  'payments.record', 'pettycash.view', 'pettycash.edit', 'pettycash.lock',
  'float.view', 'float.disburse', 'float.reconcile', 'income.view',
  'income.adjust', 'sale.view', 'reports.generate', 'profit.view',
  'users.manage', 'settings.manage', 'leads.view',
  'halls.manage', 'rules.manage', 'attendance.view', 'attendance.mark', 'employees.manage',
  'reviews.manage', 'stock.view', 'stock.manage',
  'livecooking.view',
  'catering.view', 'catering.manage', 'catering.reports',
];

/**
 * The Live Cooking slice of the permission set.
 *
 * Deliberately carved OUT of the Owner's implicit "role === OWNER means yes"
 * shortcut (see `effectiveCan` in permissions.ts). The Live Cooking service
 * itself is a normal banquet line that anyone booking an event can add — it is
 * only the SEPARATE breakdown of what that service earns that is restricted.
 * A Super Admin can still grant this to an individual user from the access
 * editor.
 */
export const LIVE_COOKING_PERMISSIONS: Permission[] = ['livecooking.view'];

/**
 * The catering slice. Catering is run independently of the halls — different
 * customers, different books, its own staff — so it is carved out of the
 * Owner's implicit grant just as Live Cooking is. Only a Super Admin (who sees
 * both businesses) and the Catering role hold these by default.
 */
/**
 * A standing condition printed on every catering quotation. Flat and ordered —
 * unlike the ballroom, catering has no per-quotation rule lines, because the
 * conditions are the same on every slip.
 */
/**
 * A quotation is an estimate given before the booking. An invoice is what is
 * billed after the event. They are separate records with separate line items:
 * an invoice is copied from a quotation and then diverges as final quantities
 * settle, and editing one must never reach back into the other.
 */
export type CateringDocType = 'QUOTATION' | 'INVOICE';

export const CATERING_DOC_META: Record<CateringDocType, { label: string; noun: string }> = {
  QUOTATION: { label: 'Quotation', noun: 'quotation' },
  INVOICE: { label: 'Invoice', noun: 'invoice' },
};

/** Someone catering buys from: butcher, decorator, crockery hire, transport. */
export interface CateringVendorRow {
  id: number;
  name: string;
  category: string;
  phone: string;
  note: string;
  isActive: 0 | 1;
  /** Bills recorded against this vendor. Blocks a careless delete. */
  billCount?: number;
}

/** One vendor bill against one event. */
export interface CateringPayableRow {
  id: number;
  eventId: number;
  vendorId: number | null;
  vendorName: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  note: string;
}

/**
 * A saved set of quotation lines.
 *
 * Not a document: no customer, no dates, no money. Applying one copies its
 * lines onto a new quotation, which then goes its own way.
 */
export interface CateringTemplateRow {
  id: number;
  name: string;
  description: string;
  persons: number;
  note: string;
  isActive: 0 | 1;
  createdByName?: string | null;
  /** Filled by the detail read; the list leaves it undefined. */
  lines?: CateringLineRow[];
  /** Summary for the list, so it can show size without loading every line. */
  lineCount?: number;
  value?: number;
}

/**
 * A vendor bill with the event it belongs to attached.
 *
 * The plain `CateringPayableRow` is enough inside one event's ledger, where
 * the event is already the context. These listings cross events, so each row
 * has to carry its own.
 */
export interface CateringBillRow {
  id: number;
  eventId: number;
  quotaNo: string;
  customerName: string;
  eventDate: string | null;
  vendorId: number | null;
  vendorName: string;
  description: string;
  amount: number;
  paidAmount: number;
  /** amount - paidAmount, never below zero. */
  outstanding: number;
  settled: boolean;
  dueDate: string | null;
  note: string;
}

/** Filter for the bill listings. */
export type BillFilter = 'ALL' | 'UNPAID' | 'PAID';

/**
 * What one event earned, once its vendors are paid.
 *
 * `revenue` is the invoice when one has been raised, and the quotation's
 * figure before that, so an event in progress still shows a working profit
 * rather than nothing at all.
 */
export interface CateringEventLedger {
  eventId: number;
  quotaNo: string;
  invoiceNo: string | null;
  customerName: string;
  eventDate: string | null;
  status: CateringStatus;
  /** True once an invoice exists, so the figure is final rather than an estimate. */
  invoiced: boolean;
  revenue: number;
  received: number;
  payableTotal: number;
  payablePaid: number;
  profit: number;
}

export interface CateringRuleRow {
  id: number;
  text: string;
  sortOrder: number;
  isActive: 0 | 1;
}

export const CATERING_PERMISSIONS: Permission[] = [
  'catering.view', 'catering.manage', 'catering.reports',
];

/** Everything the ballroom side covers — the Owner's default ceiling. */
export const BANQUET_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !LIVE_COOKING_PERMISSIONS.includes(p) && !CATERING_PERMISSIONS.includes(p),
);

export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  /** Ranks above Owner: the whole banquet app plus the Live Cooking figures. */
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  OWNER: [...BANQUET_PERMISSIONS],
  MANAGER: [
    'bookings.view', 'bookings.create', 'bookings.edit', 'payments.record',
    'pettycash.view', 'pettycash.edit', 'float.view', 'sale.view',
    'leads.view', 'attendance.view', 'attendance.mark', 'employees.manage',
    'halls.manage', 'rules.manage', 'reviews.manage',
    'stock.view', 'stock.manage',
  ],
  /** Books the money in and out, but cannot touch bookings or staff records. */
  ACCOUNTANT: [
    'bookings.view', 'payments.record',
    'pettycash.view', 'pettycash.edit', 'pettycash.lock',
    'float.view', 'float.disburse', 'float.reconcile',
    'income.view', 'income.adjust', 'sale.view',
    'reports.generate', 'profit.view', 'stock.view',
  ],
  /** Runs the floor and the staff — deliberately no financial visibility. */
  SUPERVISOR: [
    'bookings.view', 'bookings.create', 'bookings.edit', 'payments.record',
    'leads.view', 'attendance.view', 'attendance.mark', 'employees.manage',
    'reviews.manage', 'halls.manage', 'stock.view', 'stock.manage',
  ],
  /** Front desk: takes enquiries and payments, sees nothing behind the counter. */
  RECEPTIONIST: [
    'bookings.view', 'bookings.create', 'payments.record', 'leads.view',
  ],
  VIEWER: ['bookings.view', 'leads.view'],
  /** The catering business and nothing else. */
  CATERING: [...CATERING_PERMISSIONS],
};

// ── DB row shapes ──────────────────────────────────────
export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  permissions: string | null; // JSON array override, null = use role defaults
  /** Staff record this login belongs to; null = login only, not on the payroll. */
  employee_id: number | null;
  is_active: 0 | 1;
  created_at: string;
}

export interface BookingRow {
  id: number;
  slip_no: string;
  party_id: number;
  hall_id: number;
  booking_date: string;
  event_date: string;
  shift: 'LUNCH' | 'DINNER';
  guest_count: number;
  balance_amount: number;
  banquet_amount: number;
  total_amount: number;
  advance_amount: number;
  paid_amount: number;
  status: 'ENQUIRY' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  payment_status: 'PENDING' | 'PARTIAL' | 'SETTLED';
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceItemRow {
  id: number;
  booking_id: number;
  label: string;
  qty: number;
  rate: number;
  subtotal: number;
}

export interface PaymentRow {
  id: number;
  booking_id: number;
  amount: number;
  payment_date: string;
  method: string;
  received_by: number | null;
  note: string | null;
}

export interface ExpenseHeadRow {
  id: number;
  name: string;
  sort_order: number;
  has_qty_note: 0 | 1;
  is_active: 0 | 1;
}

export interface PettyCashEntryRow {
  id: number;
  entry_date: string;
  expense_head_id: number;
  amount: number;
  qty_note: string | null;
  booking_id: number | null;
  disbursement_id: number | null;
  entered_by: number;
  created_at: string;
}

export interface DisbursementRow {
  id: number;
  slip_no: string | null;
  booking_id: number | null;
  disbursed_by: number;
  disbursed_to: number;
  amount_disbursed: number;
  date_disbursed: string;
  amount_returned: number;
  date_returned: string | null;
  status: 'OPEN' | 'RECONCILED' | 'DISPUTED';
  note: string | null;
}

export interface LeadRow {
  id: number;
  name: string;
  phone: string;
  event_date: string | null;
  message: string | null;
  source: string;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED';
  created_at: string;
}

export type SaleAttribution = 'EVENT_MONTH' | 'SETTLEMENT_MONTH';

// ── Live Cooking ───────────────────────────────────────
/**
 * How a booking service line is classified.
 * 'LIVE_COOKING' is stamped on save for lines labelled with
 * LIVE_COOKING_SERVICE (see service-presets.ts).
 */
export type ServiceKind = 'BANQUET' | 'LIVE_COOKING';

/** One Live Cooking line, with the booking it was sold on. */
export interface LiveCookingLineRow {
  id: number;
  bookingId: number;
  slipNo: string;
  partyName: string;
  phone: string | null;
  hall: string;
  eventDate: string;
  shift: 'LUNCH' | 'DINNER';
  bookingStatus: 'ENQUIRY' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  guestCount: number;
  label: string;
  qty: number;
  rate: number;
  subtotal: number;
}

export interface LiveCookingSummary {
  /** Number of bookings that included the Live Cooking service. */
  bookings: number;
  /** Total units sold (usually guests catered for). */
  qty: number;
  revenue: number;
  guests: number;
  /** revenue ÷ bookings, 0 when there are none. */
  avgPerBooking: number;
  /** Live Cooking revenue as a share of all banquet-service revenue. */
  sharePct: number;
  /** Total banquet-service revenue in the period, for context. */
  allServicesRevenue: number;
}

// ── Catering ───────────────────────────────────────────
/** Which band of the quotation slip a line belongs to. */
export type CateringSection = 'DISH' | 'CHARGE' | 'MEAT';
export type CateringUnit = 'KG' | 'GRAM' | 'LITRE' | 'ML' | 'PCS' | 'PLATE';

/**
 * What a unit measures, and how many BASE units one of it is worth.
 *
 * A rate is always quoted per base unit — per KG, per LITRE, per piece. A line
 * may be entered in a smaller unit, so 500 GRAM of a dish rated at 800/KG bills
 * as 500 × 0.001 × 800 = 400. Keeping the factor here rather than in the
 * database means the arithmetic is in one place and unit-testable.
 */
export const UNIT_META: Record<CateringUnit, { label: string; measure: 'WEIGHT' | 'VOLUME' | 'COUNT'; base: CateringUnit; factor: number }> = {
  KG:    { label: 'kg',     measure: 'WEIGHT', base: 'KG',    factor: 1 },
  GRAM:  { label: 'g',      measure: 'WEIGHT', base: 'KG',    factor: 0.001 },
  LITRE: { label: 'litre',  measure: 'VOLUME', base: 'LITRE', factor: 1 },
  ML:    { label: 'ml',     measure: 'VOLUME', base: 'LITRE', factor: 0.001 },
  PCS:   { label: 'pcs',    measure: 'COUNT',  base: 'PCS',   factor: 1 },
  // Much of the menu is sold by the head rather than by weight. A plate is a
  // count like a piece, so it needs its own base: a dish priced per plate must
  // not offer "pcs" as an interchangeable unit, because they are not the same
  // thing to a customer reading the slip.
  PLATE: { label: 'plate',  measure: 'COUNT',  base: 'PLATE', factor: 1 },
};

/** The units a dish priced in `base` may be ordered in. */
export function unitsFor(base: CateringUnit): CateringUnit[] {
  const meta = UNIT_META[base];
  // Counts do not convert into one another: 3 plates is not 3 pieces. Weight
  // and volume still offer their whole family, so 500 g of a per-kg dish works.
  if (meta.measure === 'COUNT') return [base];
  return (Object.keys(UNIT_META) as CateringUnit[]).filter((u) => UNIT_META[u].measure === meta.measure);
}

/** Quantity expressed in the base unit the rate is quoted in. */
export function toBaseQty(qty: number, unit: CateringUnit): number {
  return (Number(qty) || 0) * UNIT_META[unit].factor;
}

/**
 * What a line is worth. The single definition of catering line arithmetic —
 * the editor, the server action and the slip all call this, so a rounding
 * change can never leave the printed slip disagreeing with the stored total.
 */
export function cateringLineAmount(qty: number, unit: CateringUnit, rate: number): number {
  return Math.round(toBaseQty(qty, unit) * (Number(rate) || 0) * 100) / 100;
}
export type CateringStatus = 'QUOTATION' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export const CATERING_STATUS_META: Record<CateringStatus, { label: string; tone: 'gold' | 'green' | 'amber' | 'muted' | 'red' }> = {
  QUOTATION: { label: 'Quotation', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'gold' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
};

/** Statuses that count as real business. A quotation is not yet money. */
export const CATERING_BILLABLE: CateringStatus[] = ['CONFIRMED', 'COMPLETED'];

export interface CateringCustomerRow {
  id: number;
  name: string;
  phone: string;
  phone2: string;
  address: string;
  note: string;
  /** How many quotations this customer has — blocks a careless delete. */
  quotationCount?: number;
}

export interface CateringCategoryRow {
  id: number;
  name: string;
  sortOrder: number;
  isActive: 0 | 1;
  /** How many dishes use it — blocks a careless delete. */
  itemCount?: number;
}

/** A raw meat with its current rate — the rates that move week to week. */
/**
 * One meat a dish variant uses, and how much of the dish it accounts for.
 *
 * `share` is a percentage of the dish quantity, so a mixed karahi at 50/50
 * bills 10 kg of chicken and 10 kg of beef against 20 kg of karahi. A dish
 * with a single meat is simply one row at 100.
 */
export interface VariantMeatRow {
  meatTypeId: number;
  meatName: string;
  meatRate: number;
  share: number;
}

export interface CateringMeatTypeRow {
  id: number;
  name: string;
  unit: CateringUnit;
  rate: number;
  sortOrder: number;
  isActive: 0 | 1;
  usedCount?: number;
}

/**
 * One priced variant of a dish: QORMA + BEEF at 1,200/kg.
 *
 * `meatTypeId` is what makes the quotation pull a matching meat line — QORMA
 * under CHICKEN supplies chicken, under BEEF supplies beef.
 */
export interface CateringVariantRow {
  categoryId: number;
  categoryName: string;
  rate: number;
  meatTypeId: number | null;
  meatTypeName: string | null;
  meatRate: number | null;  /**
   * Every meat this variant draws on, with its share. A single-meat dish is
   * one entry at 100. `meatTypeId` above is kept as the primary for existing
   * callers and mirrors the first entry.
   */
  meats?: VariantMeatRow[];
}

export interface CateringMenuItemRow {
  id: number;
  name: string;
  /** The unit the rate is quoted in — KG, LITRE or PCS. */
  unit: CateringUnit;
  /** Used when a dish carries no category variants. */
  defaultRate: number;
  sortOrder: number;
  isActive: 0 | 1;
  usedCount?: number;
  variants: CateringVariantRow[];
}

export interface CateringLineRow {
  id: number;
  quotationId: number;
  section: CateringSection;
  menuItemId: number | null;
  description: string;
  category: string;
  categoryId: number | null;
  meatTypeId: number | null;
  qty: number;
  unit: CateringUnit;
  rate: number;
  amount: number;
  sortOrder: number;
}

export interface CateringQuotationRow {
  id: number;
  quotaNo: string;
  /** Quotation or invoice. Separate records; see CATERING_DOC_META. */
  docType: CateringDocType;
  /** For an invoice, the quotation it was copied from. Null on a quotation. */
  sourceQuotationId: number | null;
  customerId: number | null;
  customerName: string;
  contactNo: string;
  placeOfFunction: string;
  quotationDate: string;
  /**
   * Shown as "Event date" everywhere. The column stays `delivery_date`: it is
   * referenced across queries, the WhatsApp message and the printed slip, and
   * renaming a column to change a label is churn with a migration attached.
   */
  deliveryDate: string | null;
  persons: number;
  /** DISH + CHARGE lines — the first TOTAL on the slip. */
  itemsTotal: number;
  /** MEAT lines, added underneath to reach the grand total. */
  meatTotal: number;
  grandTotal: number;
  advanceAmount: number;
  paidAmount: number;
  status: CateringStatus;
  note: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  /** grandTotal - paidAmount. */
  balance: number;
  lines?: CateringLineRow[];
}

export interface CateringPaymentRow {
  id: number;
  quotationId: number;
  amount: number;
  paymentDate: string;
  method: string;
  receivedBy: number | null;
  receivedByName: string | null;
  note: string | null;
}

/** The catering arm's own trading identity, printed on its slip. */
export interface CateringProfile {
  name: string;
  person: string;
  phone: string;
  address: string;
  terms: string;
  note: string;
  /** Printed in the slip header beside the status, not in the conditions. */
  taxNote: string;
  quotaPrefix: string;
}

export const CATERING_PROFILE_DEFAULTS: CateringProfile = {
  name: 'Skylight Catering Service',
  person: '',
  phone: '',
  address: '',
  terms: 'Terms of Payment: 75% Advance & Balance After Program.',
  note: 'Please note that prices quoted are based on prevailing price of meat which may change at the time of program. The revised rates will be applicable in billing if prices of meat increase.',
  // Empty by default: the tax line prints only if someone deliberately sets
  // one in Catering -> Settings.
  taxNote: '',
  quotaPrefix: 'SC',
};
