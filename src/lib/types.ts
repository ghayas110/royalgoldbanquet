// ── Roles & permissions ────────────────────────────────
export type Role = 'OWNER' | 'MANAGER' | 'VIEWER';

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
  | 'employees.manage';

export const ALL_PERMISSIONS: Permission[] = [
  'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.delete',
  'payments.record', 'pettycash.view', 'pettycash.edit', 'pettycash.lock',
  'float.view', 'float.disburse', 'float.reconcile', 'income.view',
  'income.adjust', 'sale.view', 'reports.generate', 'profit.view',
  'users.manage', 'settings.manage', 'leads.view',
  'halls.manage', 'rules.manage', 'attendance.view', 'attendance.mark', 'employees.manage',
];

export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  OWNER: [...ALL_PERMISSIONS],
  MANAGER: [
    'bookings.view', 'bookings.create', 'bookings.edit', 'payments.record',
    'pettycash.view', 'pettycash.edit', 'float.view', 'sale.view',
    'leads.view', 'attendance.view', 'attendance.mark', 'employees.manage',
    'halls.manage', 'rules.manage',
  ],
  VIEWER: ['bookings.view', 'leads.view'],
};

// ── DB row shapes ──────────────────────────────────────
export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  permissions: string | null; // JSON array override, null = use role defaults
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
