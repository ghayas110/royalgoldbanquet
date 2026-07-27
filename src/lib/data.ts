import { query, queryOne, toInt } from './db';
import { monthRange } from './format';
import type {
  SettledBookingInput, NewBookingInput, ExpenseHeadTotal, DisbursementInput,
} from './accounting/types';
import { buildExpenseLines } from './accounting';
import type { SaleAttribution } from './types';

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM settings WHERE \`key\` = ?`, [key]);
  return row?.value ?? fallback;
}

export async function getSaleAttribution(): Promise<SaleAttribution> {
  const v = await getSetting('sale_attribution', 'EVENT_MONTH');
  return v === 'SETTLEMENT_MONTH' ? 'SETTLEMENT_MONTH' : 'EVENT_MONTH';
}

/** Settled bookings whose EVENT date falls in the period (Section A). */
export async function getSettledBookings(from: string, to: string): Promise<SettledBookingInput[]> {
  const rows = await query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.event_date,
            COALESCE((SELECT MAX(payment_date) FROM payments py WHERE py.booking_id = b.id), b.event_date) AS settlement_date,
            b.balance_amount, b.banquet_amount
       FROM bookings b JOIN parties p ON p.id = b.party_id
      WHERE b.payment_status = 'SETTLED'
        AND b.event_date BETWEEN ? AND ?
      ORDER BY b.event_date, b.id`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id, slip_no: r.slip_no, party_name: r.party_name,
    event_date: r.event_date, settlement_date: r.settlement_date,
    balance_amount: Number(r.balance_amount), banquet_amount: Number(r.banquet_amount),
  }));
}

/** Bookings CREATED in the period, for future events (Section B). */
export async function getNewBookings(from: string, to: string): Promise<NewBookingInput[]> {
  const rows = await query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.booking_date, b.event_date, b.advance_amount
       FROM bookings b JOIN parties p ON p.id = b.party_id
      WHERE b.booking_date BETWEEN ? AND ?
      ORDER BY b.booking_date, b.id`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id, slip_no: r.slip_no, party_name: r.party_name,
    booking_date: r.booking_date, event_date: r.event_date,
    advance_amount: Number(r.advance_amount),
  }));
}

/** Advances received in the period (payments dated in-period against advances). */
export async function getAdvancesInPeriod(from: string, to: string): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount),0) total FROM payments
      WHERE payment_date BETWEEN ? AND ? AND note LIKE 'Advance%'`,
    [from, to],
  );
  return Number(row?.total ?? 0);
}

/** Petty-cash column totals per expense head + owner adjustments → lines. */
export async function getExpenseLines(from: string, to: string, year: number, month: number): Promise<ExpenseHeadTotal[]> {
  const heads = await query<any>(
    `SELECT h.id AS head_id, h.name,
            COALESCE(SUM(e.amount),0) AS amount,
            MAX(e.qty_note) AS qty_note
       FROM expense_heads h
       LEFT JOIN petty_cash_entries e
         ON e.expense_head_id = h.id AND e.entry_date BETWEEN ? AND ?
      WHERE h.is_active = 1
      GROUP BY h.id, h.name, h.sort_order
      ORDER BY h.sort_order`,
    [from, to],
  );
  const adjRows = await query<any>(
    `SELECT expense_head_id, SUM(adjustment_amount) adj FROM income_adjustments
      WHERE year = ? AND month = ? GROUP BY expense_head_id`,
    [year, month],
  );
  const adjustments: Record<number, number> = {};
  for (const a of adjRows) adjustments[a.expense_head_id] = Number(a.adj);

  return buildExpenseLines(
    heads.map((h) => ({ head_id: h.head_id, name: h.name, amount: Number(h.amount), qty_note: h.qty_note })),
    adjustments,
  );
}

/** Disbursements with derived expenses_recorded (tagged petty cash). */
export async function getDisbursements(from: string, to: string): Promise<DisbursementInput[]> {
  const rows = await query<any>(
    `SELECT d.id, d.slip_no, d.amount_disbursed, d.amount_returned, d.status,
            COALESCE((SELECT SUM(e.amount) FROM petty_cash_entries e WHERE e.disbursement_id = d.id),0) AS expenses_recorded
       FROM manager_disbursements d
      WHERE d.date_disbursed BETWEEN ? AND ?
      ORDER BY d.date_disbursed`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id, slip_no: r.slip_no,
    amount_disbursed: Number(r.amount_disbursed),
    expenses_recorded: Number(r.expenses_recorded),
    amount_returned: Number(r.amount_returned),
    status: r.status,
  }));
}

export async function getHalls() {
  return query<any>(`SELECT id, name, capacity, base_charge, description FROM halls WHERE is_active = 1 ORDER BY name`);
}

export async function getAllHalls() {
  return query<any>(
    `SELECT h.id, h.name, h.capacity, h.base_charge, h.description, h.is_active,
            (SELECT COUNT(*) FROM bookings b WHERE b.hall_id = h.id) AS booking_count
       FROM halls h ORDER BY h.is_active DESC, h.name`,
  );
}

export async function getRules(activeOnly = false) {
  return query<any>(`SELECT * FROM rules ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY sort_order, id`);
}

export async function getEmployees(activeOnly = true) {
  return query<any>(`SELECT * FROM employees ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY is_active DESC, name`);
}

/** Full employee ledger: profile, loans, salary history, attendance summary. */
export async function getEmployeeLedger(id: number, year: number, month: number) {
  const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [id]);
  if (!emp) return null;

  const loans = await query<any>(
    `SELECT l.*, COALESCE((SELECT SUM(amount) FROM loan_repayments r WHERE r.loan_id = l.id),0) AS repaid
       FROM employee_loans l WHERE l.employee_id = ? ORDER BY l.date_taken DESC, l.id DESC`,
    [id],
  );
  const salaries = await query<any>(`SELECT * FROM salary_payments WHERE employee_id = ? ORDER BY year DESC, month DESC`, [id]);

  const { from, to } = monthRange(year, month);
  const att = await query<any>(
    `SELECT status, COUNT(*) c FROM attendance WHERE employee_id = ? AND att_date BETWEEN ? AND ? GROUP BY status`,
    [id, from, to],
  );
  const counts = { present: 0, absent: 0, late: 0, leave: 0 };
  for (const a of att) {
    const k = String(a.status).toLowerCase() as keyof typeof counts;
    if (k in counts) counts[k] = Number(a.c);
  }

  const totalLoan = loans.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const totalRepaid = loans.reduce((s: number, l: any) => s + Number(l.repaid), 0);
  const totalDisbursed = salaries.reduce((s: number, x: any) => s + Number(x.net_paid), 0);

  return {
    employee: {
      id: emp.id, name: emp.name, phone: emp.phone, designation: emp.designation,
      monthlySalary: Number(emp.monthly_salary), joinedDate: emp.joined_date, isActive: emp.is_active === 1,
    },
    loans: loans.map((l: any) => ({
      id: l.id, amount: Number(l.amount), repaid: Number(l.repaid),
      outstanding: Number(l.amount) - Number(l.repaid), dateTaken: l.date_taken, note: l.note, settled: l.is_settled === 1,
    })),
    salaries: salaries.map((s: any) => ({
      id: s.id, year: s.year, month: s.month, baseSalary: Number(s.base_salary), absentDays: Number(s.absent_days),
      absenceDeduction: Number(s.absence_deduction), loanDeduction: Number(s.loan_deduction),
      otherDeduction: Number(s.other_deduction), netPaid: Number(s.net_paid), paidDate: s.paid_date, note: s.note,
    })),
    attendance: counts,
    totals: { totalLoan, totalRepaid, outstandingLoan: totalLoan - totalRepaid, totalDisbursed },
  };
}

/** Attendance matrix for a month: employees + status cells keyed emp|day. */
export async function getAttendanceMatrix(year: number, month: number) {
  const { from, to, days } = monthRange(year, month);
  const employees = await query<any>(`SELECT id, name, designation, monthly_salary FROM employees WHERE is_active = 1 ORDER BY name`);
  const rows = await query<any>(
    `SELECT employee_id, att_date, status FROM attendance WHERE att_date BETWEEN ? AND ?`,
    [from, to],
  );
  const cells: Record<string, string> = {};
  for (const r of rows) {
    const day = Number(String(r.att_date).slice(8, 10));
    cells[`${r.employee_id}|${day}`] = r.status;
  }
  return { days, employees, cells };
}

export async function getBookings(opts: { limit?: number; status?: string } = {}) {
  const where = opts.status && opts.status !== 'ALL' ? `WHERE b.status = ${'\'' + opts.status.replace(/[^A-Z]/g, '') + '\''}` : '';
  return query<any>(
    `SELECT b.id, b.slip_no, p.party_name, p.phone, b.event_date, b.booking_date, b.shift,
            h.name AS hall, b.guest_count, b.balance_amount, b.banquet_amount, b.total_amount,
            b.paid_amount, (b.total_amount - b.paid_amount) AS balance_due, b.status, b.payment_status
       FROM bookings b JOIN parties p ON p.id=b.party_id JOIN halls h ON h.id=b.hall_id
       ${where}
      ORDER BY b.event_date DESC LIMIT ${toInt(opts.limit, 100)}`,
  );
}

/** Compact booking list for search-select pickers (float disbursement, etc.). */
export async function getBookingOptions() {
  return query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.booking_date, b.event_date, b.total_amount, b.paid_amount
       FROM bookings b JOIN parties p ON p.id = b.party_id
      WHERE b.status != 'CANCELLED'
      ORDER BY b.booking_date DESC LIMIT 300`,
  );
}

export async function getBooking(id: number) {
  const b = await queryOne<any>(
    `SELECT b.*, p.party_name, p.bride_name, p.groom_name, p.phone, p.address, h.name AS hall, h.capacity
       FROM bookings b JOIN parties p ON p.id=b.party_id JOIN halls h ON h.id=b.hall_id WHERE b.id = ?`,
    [id],
  );
  if (!b) return null;
  const items = await query<any>(`SELECT * FROM booking_service_items WHERE booking_id = ? ORDER BY id`, [id]);
  const payments = await query<any>(`SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_date, id`, [id]);
  return { booking: b, items, payments };
}

/** Booked hall/date/shift slots for the availability calendar. */
export async function getCalendarBookings(year: number, month: number, publicView = false) {
  const { from, to } = monthRange(year, month);
  return query<any>(
    `SELECT b.id, b.event_date, b.shift, h.name AS hall, b.hall_id,
            ${publicView ? `'Booked' AS party_name` : `p.party_name`}, b.status, b.payment_status
       FROM bookings b JOIN halls h ON h.id=b.hall_id JOIN parties p ON p.id=b.party_id
      WHERE b.event_date BETWEEN ? AND ? AND b.status != 'CANCELLED'
      ORDER BY b.event_date, b.shift`,
    [from, to],
  );
}

/** Full manager float ledger with derived expenses_recorded + outstanding. */
export async function getFloatLedger() {
  const rows = await query<any>(
    `SELECT d.*, ub.name AS disbursed_by_name, um.name AS disbursed_to_name, p.party_name,
            COALESCE((SELECT SUM(e.amount) FROM petty_cash_entries e WHERE e.disbursement_id = d.id),0) AS expenses_recorded
       FROM manager_disbursements d
       LEFT JOIN users ub ON ub.id = d.disbursed_by
       LEFT JOIN users um ON um.id = d.disbursed_to
       LEFT JOIN bookings b ON b.id = d.booking_id
       LEFT JOIN parties p ON p.id = b.party_id
      ORDER BY d.date_disbursed DESC, d.id DESC`,
  );
  return rows.map((r) => {
    const recorded = Number(r.expenses_recorded);
    const outstanding = Number(r.amount_disbursed) - recorded - Number(r.amount_returned);
    return {
      id: r.id, slip_no: r.slip_no, party_name: r.party_name,
      disbursed_by_name: r.disbursed_by_name, disbursed_to_name: r.disbursed_to_name,
      amount_disbursed: Number(r.amount_disbursed), expenses_recorded: recorded,
      amount_returned: Number(r.amount_returned), outstanding,
      date_disbursed: r.date_disbursed, date_returned: r.date_returned, status: r.status, note: r.note,
    };
  });
}

/** Managers for the disburse dropdown. */
export async function getManagers() {
  return query<any>(`SELECT id, name, role FROM users WHERE is_active = 1 AND role IN ('MANAGER','OWNER') ORDER BY name`);
}

/** Petty cash for a month: active heads + all entries (with head name) for calendar/day views. */
export async function getPettyCashData(year: number, month: number) {
  const { from, to, days } = monthRange(year, month);
  const heads = await query<any>(`SELECT id, name, has_qty_note FROM expense_heads WHERE is_active = 1 ORDER BY sort_order, name`);
  const entries = await query<any>(
    `SELECT e.id, e.entry_date, e.expense_head_id, h.name AS head_name, e.amount, e.qty_note
       FROM petty_cash_entries e JOIN expense_heads h ON h.id = e.expense_head_id
      WHERE e.entry_date BETWEEN ? AND ?
      ORDER BY e.id`,
    [from, to],
  );
  const locked = !!(await queryOne(`SELECT id FROM monthly_locks WHERE year = ? AND month = ?`, [year, month]));
  return {
    days,
    heads: heads.map((h) => ({ id: h.id, name: h.name, hasQtyNote: h.has_qty_note === 1 })),
    entries: entries.map((e) => ({
      id: e.id, day: Number(String(e.entry_date).slice(8, 10)), headId: e.expense_head_id,
      headName: e.head_name, amount: Number(e.amount), qtyNote: e.qty_note,
    })),
    locked,
  };
}

/** All expense categories with usage counts (for the Categories manager). */
export async function getExpenseCategories() {
  return query<any>(
    `SELECT h.id, h.name, h.has_qty_note, h.is_active,
            (SELECT COUNT(*) FROM petty_cash_entries e WHERE e.expense_head_id = h.id) AS usage_count
       FROM expense_heads h ORDER BY h.is_active DESC, h.sort_order, h.name`,
  );
}

/** Load the petty-cash matrix for a month: heads (cols) + entries keyed date|head. */
export async function getPettyCashMatrix(year: number, month: number) {
  const { from, to, days } = monthRange(year, month);
  const heads = await query<any>(
    `SELECT id, name, has_qty_note FROM expense_heads WHERE is_active = 1 ORDER BY sort_order`,
  );
  const entries = await query<any>(
    `SELECT entry_date, expense_head_id, amount, qty_note FROM petty_cash_entries
      WHERE entry_date BETWEEN ? AND ?`,
    [from, to],
  );
  const cells: Record<string, { amount: number; qty_note: string | null }> = {};
  for (const e of entries) {
    const day = Number(String(e.entry_date).slice(8, 10));
    cells[`${day}|${e.expense_head_id}`] = { amount: Number(e.amount), qty_note: e.qty_note };
  }
  const locked = !!(await queryOne(`SELECT id FROM monthly_locks WHERE year = ? AND month = ?`, [year, month]));
  return {
    days,
    heads: heads.map((h) => ({ id: h.id, name: h.name, hasQtyNote: h.has_qty_note === 1 })),
    cells,
    locked,
  };
}

/** The most recent month that has any booking activity (defaults dashboards). */
export async function getDefaultPeriod(): Promise<{ year: number; month: number }> {
  // Latest month that has SETTLED event activity — the operating month,
  // not a far-future event date attached to a brand-new advance booking.
  const row = await queryOne<{ y: number; m: number }>(
    `SELECT YEAR(event_date) y, MONTH(event_date) m FROM bookings
      WHERE payment_status = 'SETTLED'
      ORDER BY event_date DESC LIMIT 1`,
  );
  if (row?.y) return { year: row.y, month: row.m };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Sale vs expense trend over the last N months ending at year/month. */
export async function getTrend(year: number, month: number, months = 6) {
  const out: { label: string; sale: number; expenses: number; count: number }[] = [];
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = months - 1; i >= 0; i--) {
    let y = year, m = month - i;
    while (m <= 0) { m += 12; y -= 1; }
    const { from, to } = monthRange(y, m);
    const [saleRow, expRow, cntRow] = await Promise.all([
      queryOne<any>(`SELECT COALESCE(SUM(balance_amount+banquet_amount),0) s FROM bookings WHERE payment_status='SETTLED' AND event_date BETWEEN ? AND ?`, [from, to]),
      queryOne<any>(`SELECT COALESCE(SUM(amount),0) e FROM petty_cash_entries WHERE entry_date BETWEEN ? AND ?`, [from, to]),
      queryOne<any>(`SELECT COUNT(*) c FROM bookings WHERE event_date BETWEEN ? AND ?`, [from, to]),
    ]);
    out.push({ label: `${M[m - 1]}`, sale: Number(saleRow?.s ?? 0), expenses: Number(expRow?.e ?? 0), count: Number(cntRow?.c ?? 0) });
  }
  return out;
}

export async function getUpcomingEvents(limit = 6) {
  return query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.event_date, b.shift, h.name AS hall,
            b.total_amount, b.paid_amount, (b.total_amount - b.paid_amount) AS balance_due, b.payment_status
       FROM bookings b JOIN parties p ON p.id=b.party_id JOIN halls h ON h.id=b.hall_id
      WHERE b.event_date >= CURDATE() AND b.status != 'CANCELLED'
      ORDER BY b.event_date ASC LIMIT ${toInt(limit, 6)}`,
  );
}

export async function getOutstandingBalances(limit = 8) {
  return query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.event_date, b.total_amount, b.paid_amount,
            (b.total_amount - b.paid_amount) AS balance_due, b.payment_status
       FROM bookings b JOIN parties p ON p.id=b.party_id
      WHERE b.payment_status != 'SETTLED' AND b.status != 'CANCELLED'
      ORDER BY b.event_date ASC LIMIT ${toInt(limit, 8)}`,
  );
}

/** Everything needed to render a month's financials, in one call. */
export async function getMonthlyFinancials(year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [settled, newBookings, expenseLines, disbursements, advances, attribution] = await Promise.all([
    getSettledBookings(from, to),
    getNewBookings(from, to),
    getExpenseLines(from, to, year, month),
    getDisbursements(from, to),
    getAdvancesInPeriod(from, to),
    getSaleAttribution(),
  ]);
  return { from, to, settled, newBookings, expenseLines, disbursements, advances, attribution };
}
