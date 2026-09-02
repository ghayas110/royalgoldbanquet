import { query, queryOne, toInt } from './db';
import { monthRange } from './format';
import type {
  SettledBookingInput, NewBookingInput, ExpenseHeadTotal, DisbursementInput,
} from './accounting/types';
import { buildExpenseLines } from './accounting';
import type { SaleAttribution } from './types';
import { BRAND_DEFAULTS, brandKey, normaliseBrand, type BrandInfo } from './brand-info';
import {
  REVIEW_CATEGORIES, isRating, starsFor,
  type Rating, type ReviewCategoryKey, type ReviewRow,
} from './reviews';

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM settings WHERE \`key\` = ?`, [key]);
  return row?.value ?? fallback;
}

/**
 * The enquiry slip's "Please Note" points, in order.
 *
 * Stored as one line per point under `enquiry.note` so Settings can offer a
 * plain textarea. Seeded by migration 007; empty means the client cleared it,
 * and the slip then prints no note block at all.
 */
export async function getEnquiryNote(): Promise<string[]> {
  const raw = await getSetting('enquiry.note', '');
  return raw.split('\n').map((l) => l.trim()).filter(Boolean);
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
        AND b.status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
      ORDER BY b.event_date, b.id`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id, slip_no: r.slip_no, party_name: r.party_name,
    event_date: r.event_date, settlement_date: r.settlement_date,
    balance_amount: Number(r.balance_amount), banquet_amount: Number(r.banquet_amount),
  }));
}

/**
 * Bookings CREATED in the period, for future events (Section B).
 *
 * Status filter is load-bearing: this feeds `advanceBookingAmount` in the P&L,
 * so without it a CANCELLED or RETURNED booking's advance still counted as
 * profit — money that was handed back to the customer. Enquiries are excluded
 * too; a quotation is not a sale.
 */
export async function getNewBookings(from: string, to: string): Promise<NewBookingInput[]> {
  const rows = await query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.booking_date, b.event_date, b.advance_amount
       FROM bookings b JOIN parties p ON p.id = b.party_id
      WHERE b.booking_date BETWEEN ? AND ?
        AND b.status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
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

/**
 * Plain-English dashboard figures for a month. Deliberately separate from the
 * accounting module: that recognises revenue only when a booking SETTLES,
 * which is right for the Income Statement but made every dashboard tile read
 * zero for a business whose events are booked and part-paid but not yet held.
 *
 * - bookedSale  : full contracted value of the bookings TAKEN this month
 * - received    : money actually taken this month (every payment, not just
 *                 rows whose note happens to start with "Advance")
 * - balanceDue  : still to collect on those bookings
 * Enquiries and cancellations are excluded — neither is real business.
 *
 * Sale is keyed on `booking_date`, not `event_date`: a banquet sells the event
 * the day it is booked, months before it happens. Keying on the event date
 * showed Rs 0 sale in a month where several bookings were sold, because their
 * events fall later in the year — and it left "sale" and "received" describing
 * different sets of bookings, so they could never reconcile.
 */
export async function getBookingSummary(from?: string, to?: string): Promise<{
  bookedSale: number; eventCount: number; received: number; balanceDue: number; newBookingCount: number;
}> {
  const hasRange = Boolean(from && to);
  const [events, money, created] = await Promise.all([
    queryOne<any>(
      `SELECT COALESCE(SUM(total_amount),0) AS sale,
              COALESCE(SUM(total_amount - paid_amount),0) AS due,
              COUNT(*) AS n
         FROM bookings
        WHERE status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
          ${hasRange ? 'AND booking_date BETWEEN ? AND ?' : ''}`,
      hasRange ? [from, to] : [],
    ),
    queryOne<any>(
      `SELECT COALESCE(SUM(py.amount),0) AS received
         FROM payments py JOIN bookings b ON b.id = py.booking_id
        WHERE b.status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
          ${hasRange ? 'AND py.payment_date BETWEEN ? AND ?' : ''}`,
      hasRange ? [from, to] : [],
    ),
    // Events actually taking place this period / overall — shown as context, not as sale.
    queryOne<any>(
      `SELECT COUNT(*) AS n FROM bookings
        WHERE status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
          ${hasRange ? 'AND event_date BETWEEN ? AND ?' : ''}`,
      hasRange ? [from, to] : [],
    ),
  ]);
  return {
    bookedSale: Number(events?.sale ?? 0),      // value of bookings taken
    balanceDue: Number(events?.due ?? 0),       // outstanding on those bookings
    newBookingCount: Number(events?.n ?? 0),    // how many were taken
    received: Number(money?.received ?? 0),     // cash in period / all-time
    eventCount: Number(created?.n ?? 0),        // events in period / all-time
  };
}

/**
 * Salary sheet for a month, laid out to mirror the owner's paper sheet:
 * NAME | POSITION | BASIC | WORK DAYS | ATTEND | ABSENT | ADV DED | LOAN DED |
 * ABSENT DED | NET SALARY | EXTRA PAY | PAYABLE
 *
 * Rows come from `salary_payments` when a salary has been disbursed for the
 * month; otherwise the employee still appears with their basic salary and live
 * attendance, so the sheet can be printed BEFORE payroll is run (which is how
 * the paper sheet is used — filled in, then signed off).
 */
export async function getSalarySheet(year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const rows = await query<any>(
    `SELECT e.id, e.name, e.designation, e.monthly_salary, e.loan_opening_balance,
            (SELECT u.role FROM users u WHERE u.employee_id = e.id AND u.is_active = 1 LIMIT 1) AS user_role,
            sp.base_salary, sp.work_days, sp.attend_days, sp.absent_days,
            sp.absence_deduction, sp.advance_deduction, sp.loan_deduction,
            sp.other_deduction, sp.extra_pay, sp.net_paid,
            (SELECT COUNT(*) FROM attendance a
              WHERE a.employee_id = e.id AND a.att_date BETWEEN ? AND ?) AS marked_days,
            (SELECT COUNT(*) FROM attendance a
              WHERE a.employee_id = e.id AND a.att_date BETWEEN ? AND ?
                AND a.status = 'PRESENT') AS present_days,
            (SELECT COUNT(*) FROM attendance a
              WHERE a.employee_id = e.id AND a.att_date BETWEEN ? AND ?
                AND a.status = 'ABSENT') AS absent_marked
       FROM employees e
       LEFT JOIN salary_payments sp
         ON sp.employee_id = e.id AND sp.year = ? AND sp.month = ?
      WHERE e.is_active = 1
      ORDER BY e.id`,
    [from, to, from, to, from, to, year, month],
  );

  return rows.map((r: any) => {
    const basic = Number(r.base_salary ?? r.monthly_salary ?? 0);
    const workDays = Number(r.work_days ?? r.marked_days ?? 0);
    const attend = Number(r.attend_days ?? r.present_days ?? 0);
    const absent = Number(r.absent_days ?? r.absent_marked ?? 0);
    const absenceDed = Number(r.absence_deduction ?? 0);
    const advDed = Number(r.advance_deduction ?? 0);
    const loanDed = Number(r.loan_deduction ?? 0);
    const extra = Number(r.extra_pay ?? 0);
    // NET SALARY = basic less absence; PAYABLE = net less advances/loans plus
    // any extra pay. Matches how the paper sheet's columns add up.
    const net = basic - absenceDed;
    const payable = net - advDed - loanDed + extra;
    return {
      id: r.id, name: r.name, position: r.designation ?? '',
      userRole: (r.user_role ?? null) as string | null,
      basic, workDays, attend, absent,
      advDeduction: advDed, loanDeduction: loanDed, absenceDeduction: absenceDed,
      net, extraPay: extra, payable,
      disbursed: r.net_paid != null,
    };
  });
}

/**
 * Staff loan ledger ("SKYLIGHT LOAN" block on the paper sheet): opening
 * balance carried over from the paper ledger plus each month's repayment,
 * across the 8 months ending at year/month.
 */
export async function getStaffLoanLedger(year: number, month: number, months = 8) {
  const cols: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    cols.push({
      key: `${y}-${String(m).padStart(2, '0')}`,
      label: d.toLocaleString('en-GB', { month: 'short' }),
      year: y, month: m,
    });
  }
  const first = cols[0], last = cols[cols.length - 1];
  const { from } = monthRange(first.year, first.month);
  const { to } = monthRange(last.year, last.month);

  const emps = await query<any>(
    `SELECT e.id, e.name, e.designation, e.loan_opening_balance,
            COALESCE((SELECT SUM(l.amount) FROM employee_loans l WHERE l.employee_id = e.id),0) AS loans_taken,
            COALESCE((SELECT SUM(rp.amount) FROM loan_repayments rp WHERE rp.employee_id = e.id),0) AS repaid_all
       FROM employees e
      WHERE e.is_active = 1
      ORDER BY e.id`,
  );
  const repayRows = await query<any>(
    `SELECT employee_id, DATE_FORMAT(repay_date,'%Y-%m') AS k, SUM(amount) AS amt
       FROM loan_repayments WHERE repay_date BETWEEN ? AND ?
      GROUP BY employee_id, k`,
    [from, to],
  );
  const byEmp: Record<number, Record<string, number>> = {};
  for (const r of repayRows) {
    (byEmp[r.employee_id] ??= {})[r.k] = Number(r.amt);
  }

  const ledger = emps.map((e: any) => {
    const opening = Number(e.loan_opening_balance ?? 0) + Number(e.loans_taken ?? 0);
    const cells = cols.map((c) => byEmp[e.id]?.[c.key] ?? 0);
    const total = Number(e.repaid_all ?? 0);
    return {
      id: e.id, name: e.name, position: e.designation ?? '',
      opening, cells, total, balance: opening - total,
    };
  // Only staff who actually have a loan belong on this block.
  }).filter((r) => r.opening > 0 || r.total > 0);

  return { columns: cols.map((c) => c.label), rows: ledger };
}

/** Returned bookings — who was refunded and how much (dashboard + reports). */
export async function getReturnedBookings(limit = 8) {
  return query<any>(
    `SELECT b.id, b.slip_no, p.party_name, b.event_date, b.refunded_amount, b.refunded_at
       FROM bookings b JOIN parties p ON p.id = b.party_id
      WHERE b.status = 'RETURNED'
      ORDER BY b.refunded_at DESC, b.id DESC
      LIMIT ${toInt(limit, 8)}`,
  );
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

/** All-time petty-cash totals per expense head + owner adjustments across all months. */
export async function getAllTimeExpenseLines(): Promise<ExpenseHeadTotal[]> {
  const heads = await query<any>(
    `SELECT h.id AS head_id, h.name,
            COALESCE(SUM(e.amount),0) AS amount,
            MAX(e.qty_note) AS qty_note
       FROM expense_heads h
       LEFT JOIN petty_cash_entries e ON e.expense_head_id = h.id
      WHERE h.is_active = 1
      GROUP BY h.id, h.name, h.sort_order
      ORDER BY h.sort_order`,
  );
  const adjRows = await query<any>(
    `SELECT expense_head_id, SUM(adjustment_amount) adj FROM income_adjustments
      GROUP BY expense_head_id`,
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

/**
 * An advance is part of a month's pay, not a separate arrangement — so the
 * salary history is grouped by month with the advances drawn from that month
 * listed inside it, and the month shows what is left to hand over.
 */
export interface SalaryMonth {
  year: number; month: number; base: number;
  advances: Array<{ id: number; date: string; amount: number; note: string | null; recovered: number }>;
  advanceTotal: number; absenceDeduction: number; loanDeduction: number; otherDeduction: number;
  netPaid: number; remaining: number; paid: boolean; paidDate: string | null; note: string | null;
}

function buildSalaryMonths(
  salaries: any[], advances: any[], monthlySalary: number, viewYear: number, viewMonth: number,
): SalaryMonth[] {
  const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
  const months = new Map<string, SalaryMonth>();

  const blank = (y: number, m: number): SalaryMonth => ({
    year: y, month: m, base: monthlySalary, advances: [], advanceTotal: 0,
    absenceDeduction: 0, loanDeduction: 0, otherDeduction: 0,
    netPaid: 0, remaining: 0, paid: false, paidDate: null, note: null,
  });
  const at = (y: number, m: number) => {
    const k = key(y, m);
    if (!months.has(k)) months.set(k, blank(y, m));
    return months.get(k)!;
  };

  // The month on screen always appears, even with nothing recorded yet.
  at(viewYear, viewMonth);

  for (const s of salaries) {
    const row = at(Number(s.year), Number(s.month));
    row.base = Number(s.base_salary);
    row.absenceDeduction = Number(s.absence_deduction);
    row.loanDeduction = Number(s.loan_deduction);
    row.otherDeduction = Number(s.other_deduction);
    row.netPaid = Number(s.net_paid);
    row.paid = true;
    row.paidDate = s.paid_date ? String(s.paid_date).slice(0, 10) : null;
    row.note = s.note ?? null;
  }

  // Advances belong to the month they were TAKEN in — that is the salary they
  // come out of, regardless of when the salary run happens to be processed.
  for (const a of advances) {
    const d = String(a.advance_date).slice(0, 10);
    const [y, m] = d.split('-').map(Number);
    const row = at(y, m);
    row.advances.push({
      id: a.id, date: d, amount: Number(a.amount), note: a.note ?? null, recovered: Number(a.recovered),
    });
    row.advanceTotal += Number(a.amount);
  }

  for (const row of months.values()) {
    row.advances.sort((x, y2) => x.date.localeCompare(y2.date));
    // A paid month states its own net. An unpaid one shows what is left after
    // the advances already handed over.
    row.remaining = row.paid
      ? 0
      : Math.max(0, row.base - row.advanceTotal - row.absenceDeduction - row.loanDeduction - row.otherDeduction);
  }

  return [...months.values()].sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

export async function getEmployeeLedger(id: number, year: number, month: number) {
  const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [id]);
  if (!emp) return null;

  const loans = await query<any>(
    `SELECT l.*, COALESCE((SELECT SUM(amount) FROM loan_repayments r WHERE r.loan_id = l.id),0) AS repaid
       FROM employee_loans l WHERE l.employee_id = ? ORDER BY l.date_taken DESC, l.id DESC`,
    [id],
  );
  const salaries = await query<any>(`SELECT * FROM salary_payments WHERE employee_id = ? ORDER BY year DESC, month DESC`, [id]);
  const advances = await query<any>(
    `SELECT id, amount, recovered, advance_date, note, is_settled, salary_payment_id
       FROM employee_advances WHERE employee_id = ? ORDER BY advance_date DESC, id DESC`,
    [id],
  );

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
    salaryMonths: buildSalaryMonths(salaries, advances, Number(emp.monthly_salary), year, month),
    advances: advances.map((a: any) => ({
      id: a.id,
      amount: Number(a.amount),
      recovered: Number(a.recovered),
      outstanding: Number(a.amount) - Number(a.recovered),
      advanceDate: a.advance_date,
      note: a.note,
      settled: a.is_settled === 1,
      salaryPaymentId: a.salary_payment_id ?? null,
    })),
    attendance: counts,
    totals: {
      totalLoan, totalRepaid, outstandingLoan: totalLoan - totalRepaid, totalDisbursed,
      // Advances still to come out of a future salary run.
      outstandingAdvance: advances.reduce(
        (sum: number, a: any) => sum + (Number(a.amount) - Number(a.recovered)), 0,
      ),
    },
  };
}

/** Attendance matrix for a month: employees + status cells keyed emp|day. */
export async function getAttendanceMatrix(year: number, month: number) {
  const { from, to, days } = monthRange(year, month);
  // The LEFT JOIN surfaces which rows belong to a portal user, so the sheet can
  // mark them — a manager on the payroll is both, and staff should see that.
  const employees = await query<any>(
    `SELECT e.id, e.name, e.designation, e.monthly_salary,
            u.role AS user_role, u.email AS user_email
       FROM employees e
       LEFT JOIN users u ON u.employee_id = e.id AND u.is_active = 1
      WHERE e.is_active = 1
      ORDER BY e.name`,
  );
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

/**
 * Booking list.
 * `kind`: ALL | BOOKINGS (everything except enquiries) | ENQUIRIES.
 * `search` matches slip no, party name, phone or hall.
 */
export async function getBookings(
  opts: {
    limit?: number;
    status?: string;
    kind?: 'ALL' | 'BOOKINGS' | 'ENQUIRIES' | 'RETURNED' | 'CANCELLED';
    search?: string;
    /** Event-date range, inclusive. Either end may be given on its own. */
    from?: string;
    to?: string;
  } = {},
) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts.status && opts.status !== 'ALL') {
    clauses.push(`b.status = ?`);
    params.push(opts.status.replace(/[^A-Z]/g, ''));
  }
  if (opts.kind === 'ENQUIRIES') clauses.push(`b.status = 'ENQUIRY'`);
  else if (opts.kind === 'RETURNED') clauses.push(`b.status = 'RETURNED'`);
  else if (opts.kind === 'CANCELLED') clauses.push(`b.status = 'CANCELLED'`);
  else if (opts.kind === 'BOOKINGS') clauses.push(`b.status NOT IN ('ENQUIRY','RETURNED','CANCELLED')`);

  // Event-date range. Open-ended on either side, so "everything from today"
  // and "everything up to year end" are both a single field.
  if (opts.from) { clauses.push(`b.event_date >= ?`); params.push(opts.from); }
  if (opts.to)   { clauses.push(`b.event_date <= ?`); params.push(opts.to); }

  const q = opts.search?.trim();
  if (q) {
    clauses.push(`(b.slip_no LIKE ? OR p.party_name LIKE ? OR p.phone LIKE ? OR h.name LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return query<any>(
    `SELECT b.id, b.slip_no, p.party_name, p.phone, p.phone2, b.event_date, b.booking_date, b.shift,
            h.name AS hall, b.guest_count, b.balance_amount, b.banquet_amount, b.total_amount,
            b.paid_amount, (b.total_amount - b.paid_amount) AS balance_due, b.status, b.payment_status
       FROM bookings b JOIN parties p ON p.id=b.party_id JOIN halls h ON h.id=b.hall_id
       ${where}
      ORDER BY b.event_date DESC LIMIT ${toInt(opts.limit, 100)}`,
    params,
  );
}

/** Ticker counts for the bookings page header. */
export async function getBookingCounts(): Promise<{ bookings: number; enquiries: number; upcoming: number; due: number; returned: number; returnedAmount: number; cancelled: number }> {
  const row = await queryOne<any>(
    `SELECT
       SUM(status NOT IN ('ENQUIRY','CANCELLED','RETURNED'))                   AS bookings,
       SUM(status = 'ENQUIRY')                                                 AS enquiries,
       SUM(status = 'RETURNED')                                                AS returned,
       SUM(status = 'CANCELLED')                                               AS cancelled,
       COALESCE(SUM(CASE WHEN status = 'RETURNED' THEN refunded_amount END),0) AS returnedAmount,
       SUM(status IN ('CONFIRMED','COMPLETED') AND event_date >= CURDATE())    AS upcoming,
       SUM(status <> 'ENQUIRY' AND status <> 'CANCELLED'
           AND (total_amount - paid_amount) > 0)                               AS due
     FROM bookings`,
  );
  return {
    bookings: Number(row?.bookings ?? 0),
    enquiries: Number(row?.enquiries ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    due: Number(row?.due ?? 0),
    returned: Number(row?.returned ?? 0),
    returnedAmount: Number(row?.returnedAmount ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
  };
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
    // LEFT JOIN on the user: `created_by` is nullable, and a staff member who
    // has since been deleted must not make the booking itself unreadable.
    `SELECT b.*, p.party_name, p.bride_name, p.groom_name, p.phone, p.phone2, p.address,
            h.name AS hall, h.capacity, u.name AS booked_by
       FROM bookings b
       JOIN parties p ON p.id = b.party_id
       JOIN halls h ON h.id = b.hall_id
       LEFT JOIN users u ON u.id = b.created_by
      WHERE b.id = ?`,
    [id],
  );
  if (!b) return null;
  const items = await query<any>(`SELECT * FROM booking_service_items WHERE booking_id = ? ORDER BY id`, [id]);
  const payments = await query<any>(`SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_date, id`, [id]);
  const rules = await query<any>(`SELECT text FROM booking_rules WHERE booking_id = ? ORDER BY sort_order, id`, [id]);
  const dateChanges = await query<any>(
    `SELECT seq, from_date, to_date, amount, reason FROM booking_date_changes
      WHERE booking_id = ? ORDER BY seq`, [id]);
  return {
    booking: b, items, payments,
    rules: rules.map((r: any) => r.text as string),
    dateChanges: dateChanges.map((d: any) => ({
      seq: Number(d.seq), from_date: d.from_date, to_date: d.to_date,
      amount: Number(d.amount), reason: d.reason as string | null,
    })),
  };
}

/** Booked hall/date/shift slots for the availability calendar. */
export async function getCalendarBookings(year: number, month: number, publicView = false) {
  const { from, to } = monthRange(year, month);
  if (publicView) {
    return query<any>(
      `SELECT b.id, b.id AS booking_id, DATE_FORMAT(b.event_date, '%Y-%m-%d') AS event_date,
              b.shift, h.name AS hall, b.hall_id, 'Booked' AS party_name, b.status, b.payment_status,
              'ACTIVE' AS entry_type
         FROM bookings b JOIN halls h ON h.id=b.hall_id JOIN parties p ON p.id=b.party_id
        WHERE b.event_date BETWEEN ? AND ? AND b.status NOT IN ('CANCELLED', 'RETURNED', 'ENQUIRY')
        ORDER BY b.event_date, b.shift`,
      [from, to],
    );
  }

  const activeAndCancelled = await query<any>(
    `SELECT b.id, b.id AS booking_id, DATE_FORMAT(b.event_date, '%Y-%m-%d') AS event_date,
            b.shift, h.name AS hall, b.hall_id, p.party_name, b.status, b.payment_status,
            b.date_change_count,
            CASE
              WHEN b.status IN ('CANCELLED', 'RETURNED') THEN 'CANCELLED'
              ELSE 'ACTIVE'
            END AS entry_type,
            NULL AS to_date, NULL AS from_date, NULL AS seq, NULL AS change_reason
       FROM bookings b
       JOIN halls h ON h.id=b.hall_id
       JOIN parties p ON p.id=b.party_id
      WHERE b.event_date BETWEEN ? AND ?
      ORDER BY b.event_date, b.shift`,
    [from, to],
  );

  const dateChanges = await query<any>(
    `SELECT CONCAT('change_', c.id) AS id, c.booking_id,
            DATE_FORMAT(c.from_date, '%Y-%m-%d') AS event_date, b.shift,
            h.name AS hall, b.hall_id, p.party_name, 'MOVED' AS status, b.payment_status,
            b.date_change_count,
            'CHANGED' AS entry_type,
            DATE_FORMAT(c.to_date, '%Y-%m-%d') AS to_date,
            DATE_FORMAT(c.from_date, '%Y-%m-%d') AS from_date,
            c.seq, c.reason AS change_reason
       FROM booking_date_changes c
       JOIN bookings b ON b.id = c.booking_id
       JOIN halls h ON h.id = b.hall_id
       JOIN parties p ON p.id = b.party_id
      WHERE c.from_date BETWEEN ? AND ?
      ORDER BY c.from_date, b.shift`,
    [from, to],
  );

  return [...activeAndCancelled, ...dateChanges];
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
  return query<any>(`SELECT id, name, role FROM users WHERE is_active = 1 AND role IN ('MANAGER','OWNER','SUPER_ADMIN') ORDER BY name`);
}

/** Petty cash for a month: active heads + all entries (with head name) for calendar/day views. */
export async function getPettyCashData(year: number, month: number) {
  const { from, to, days } = monthRange(year, month);
  const heads = await query<any>(`SELECT id, name, has_qty_note FROM expense_heads WHERE is_active = 1 ORDER BY sort_order, name`);
  const entries = await query<any>(
    `SELECT e.id, e.entry_date, e.expense_head_id, h.name AS head_name, e.amount, e.qty_note,
            e.attachment, e.attachment_kind
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
      attachment: e.attachment ?? null,
      attachmentKind: (e.attachment_kind ?? null) as 'IMAGE' | 'VIDEO' | null,
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
/**
 * The month the dashboard/reports open on: the most recent month that actually
 * has activity.
 *
 * This used to look only at SETTLED bookings. A banquet takes an advance and
 * collects the balance on the event day, so a live business can easily have NO
 * settled booking for weeks — the query returned nothing, it fell back to
 * today's month, and if no booking happened to be created this month every
 * tile read Rs 0 even with lakhs of advances banked.
 *
 * Activity now means a settled event, a booking being taken, OR a payment
 * received. booking_date/payment_date are "when it happened" dates, so this
 * still can't be dragged into the future by a far-off event date.
 */
export async function getDefaultPeriod(): Promise<{ year: number; month: number }> {
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
    const [saleRow, advRow, expRow, cntRow] = await Promise.all([
      queryOne<any>(`SELECT COALESCE(SUM(balance_amount+banquet_amount),0) s FROM bookings WHERE payment_status='SETTLED' AND status <> 'CANCELLED' AND event_date BETWEEN ? AND ?`, [from, to]),
      queryOne<any>(`SELECT COALESCE(SUM(advance_amount),0) a FROM bookings WHERE booking_date BETWEEN ? AND ? AND status NOT IN ('CANCELLED','RETURNED')`, [from, to]),
      queryOne<any>(`SELECT COALESCE(SUM(e.amount),0) e FROM petty_cash_entries e JOIN expense_heads h ON h.id = e.expense_head_id WHERE h.name NOT LIKE '%Refund%' AND e.entry_date BETWEEN ? AND ?`, [from, to]),
      queryOne<any>(`SELECT COUNT(*) c FROM bookings WHERE booking_date BETWEEN ? AND ? AND status NOT IN ('CANCELLED','RETURNED')`, [from, to]),
    ]);
    const sale = Number(saleRow?.s ?? 0) + Number(advRow?.a ?? 0);
    out.push({ label: `${M[m - 1]}`, sale, expenses: Number(expRow?.e ?? 0), count: Number(cntRow?.c ?? 0) });
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
/**
 * What the stock sold through bookings actually earned.
 *
 * A stock item carries a `unit_cost`; the booking charges the customer a
 * `rate`. Issue a carton that cost 1,000 on a line billed at 1,600 and the
 * event made 600 on it. Nothing was reporting that margin.
 *
 * Cost comes from the MOVEMENT where one was recorded, falling back to the
 * item's current cost for movements written before the cost was snapshotted.
 * Using the item's cost for everything would silently rewrite last month's
 * profit whenever a supplier put their price up.
 *
 * Scoped by event date, so it lines up with the settled sale it sits beside.
 */
export async function getStockProfit(from: string, to: string): Promise<{
  revenue: number; cost: number; profit: number;
  rows: { name: string; qty: number; revenue: number; cost: number; profit: number }[];
}> {
  const rows = await query<any>(
    `SELECT si.name,
            SUM(bsi.qty)                                        AS qty,
            SUM(bsi.qty * bsi.rate)                             AS revenue,
            SUM(bsi.qty * COALESCE(NULLIF(sm.unit_cost, 0), si.unit_cost)) AS cost
       FROM booking_service_items bsi
       JOIN bookings b     ON b.id  = bsi.booking_id
       JOIN stock_items si ON si.id = bsi.stock_item_id
       LEFT JOIN stock_movements sm
              ON sm.service_item_id = bsi.id AND sm.source = 'BOOKING'
      WHERE bsi.stock_item_id IS NOT NULL
        AND b.event_date BETWEEN ? AND ?
        AND b.status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
      GROUP BY si.id, si.name
      ORDER BY (SUM(bsi.qty * bsi.rate) - SUM(bsi.qty * COALESCE(NULLIF(sm.unit_cost, 0), si.unit_cost))) DESC`,
    [from, to],
  );

  const out = rows.map((r) => {
    const revenue = Number(r.revenue ?? 0);
    const cost = Number(r.cost ?? 0);
    return { name: r.name, qty: Number(r.qty ?? 0), revenue, cost, profit: revenue - cost };
  });

  return {
    revenue: out.reduce((s, r) => s + r.revenue, 0),
    cost: out.reduce((s, r) => s + r.cost, 0),
    profit: out.reduce((s, r) => s + r.profit, 0),
    rows: out,
  };
}

/**
 * Stock margin per item over ALL time, for the Stock screen.
 *
 * `getStockProfit` answers "what did this month's events earn"; this answers
 * "what has this item ever earned us", which is the question someone asks
 * while looking at the item list.
 */
export async function getStockProfitAllTime(): Promise<{
  revenue: number; cost: number; profit: number;
  rows: { name: string; qty: number; revenue: number; cost: number; profit: number; events: number }[];
}> {
  const rows = await query<any>(
    `SELECT si.name,
            SUM(bsi.qty)                                                   AS qty,
            COUNT(DISTINCT bsi.booking_id)                                 AS events,
            SUM(bsi.qty * bsi.rate)                                        AS revenue,
            SUM(bsi.qty * COALESCE(NULLIF(sm.unit_cost, 0), si.unit_cost)) AS cost
       FROM booking_service_items bsi
       JOIN bookings b     ON b.id  = bsi.booking_id
       JOIN stock_items si ON si.id = bsi.stock_item_id
       LEFT JOIN stock_movements sm
              ON sm.service_item_id = bsi.id AND sm.source = 'BOOKING'
      WHERE bsi.stock_item_id IS NOT NULL
        AND b.status NOT IN ('CANCELLED','ENQUIRY','RETURNED')
      GROUP BY si.id, si.name
      ORDER BY (SUM(bsi.qty * bsi.rate) - SUM(bsi.qty * COALESCE(NULLIF(sm.unit_cost, 0), si.unit_cost))) DESC`,
  );
  const out = rows.map((r) => {
    const revenue = Number(r.revenue ?? 0);
    const cost = Number(r.cost ?? 0);
    return { name: r.name, qty: Number(r.qty ?? 0), events: Number(r.events ?? 0), revenue, cost, profit: revenue - cost };
  });
  return {
    revenue: out.reduce((s, r) => s + r.revenue, 0),
    cost: out.reduce((s, r) => s + r.cost, 0),
    profit: out.reduce((s, r) => s + r.profit, 0),
    rows: out,
  };
}

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

// ── Comments Card (guest reviews) ──────────────────────

const REVIEW_SELECT = `
  SELECT r.*, b.slip_no, h.name AS hall
    FROM reviews r
    LEFT JOIN bookings b ON b.id = r.booking_id
    LEFT JOIN halls h    ON h.id = b.hall_id`;

function mapReview(r: any): ReviewRow {
  const ratings: Partial<Record<ReviewCategoryKey, Rating>> = {};
  for (const c of REVIEW_CATEGORIES) {
    const v = r[`r_${c.key}`];
    if (isRating(v)) ratings[c.key] = v;
  }
  return {
    id: r.id,
    bookingId: r.booking_id ?? null,
    slipNo: r.slip_no ?? null,
    token: r.token,
    guestName: r.guest_name ?? null,
    guestPhone: r.guest_phone ?? null,
    eventDate: r.event_date ?? null,
    hall: r.hall ?? null,
    ratings,
    comments: r.comments ?? null,
    submittedAt: r.submitted_at ?? null,
    isPublished: !!r.is_published,
    createdAt: r.created_at,
    stars: starsFor(ratings),
  };
}

/** Every card, newest first — the owner's review inbox. */
export async function getReviews(): Promise<ReviewRow[]> {
  const rows = await query<any>(
    `${REVIEW_SELECT} ORDER BY COALESCE(r.submitted_at, r.created_at) DESC, r.id DESC`,
  );
  return rows.map(mapReview);
}

export async function getReviewsForBooking(bookingId: number): Promise<ReviewRow[]> {
  const rows = await query<any>(
    `${REVIEW_SELECT} WHERE r.booking_id = ? ORDER BY r.id DESC`, [bookingId],
  );
  return rows.map(mapReview);
}

/** Looked up by the public form — no session, so the token is the only key. */
export async function getReviewByToken(token: string): Promise<ReviewRow | null> {
  const rows = await query<any>(`${REVIEW_SELECT} WHERE r.token = ? LIMIT 1`, [token]);
  return rows.length ? mapReview(rows[0]) : null;
}

export async function getReviewById(id: number): Promise<ReviewRow | null> {
  const rows = await query<any>(`${REVIEW_SELECT} WHERE r.id = ? LIMIT 1`, [id]);
  return rows.length ? mapReview(rows[0]) : null;
}

/**
 * Cards for the public landing page. Only submitted + published ones, and only
 * those with something to show — a card with no words reads as filler.
 */
export async function getPublishedReviews(limit = 9): Promise<ReviewRow[]> {
  const rows = await query<any>(
    `${REVIEW_SELECT}
      WHERE r.is_published = 1
        AND r.submitted_at IS NOT NULL
        AND r.comments IS NOT NULL AND TRIM(r.comments) <> ''
      ORDER BY r.submitted_at DESC
      LIMIT ${toInt(limit, 9)}`,
  );
  return rows.map(mapReview);
}

export async function getReviewStats(): Promise<{
  total: number; submitted: number; pending: number; published: number;
  excellent: number; good: number; poor: number; avgStars: number | null;
}> {
  const all = await getReviews();
  const done = all.filter((r) => r.submittedAt);
  const withStars = done.filter((r) => r.stars !== null);
  const count = (v: Rating) =>
    done.filter((r) => (r.ratings.overall ?? r.ratings.services) === v).length;
  return {
    total: all.length,
    submitted: done.length,
    pending: all.length - done.length,
    published: done.filter((r) => r.isPublished).length,
    excellent: count('EXCELLENT'),
    good: count('GOOD'),
    poor: count('POOR'),
    avgStars: withStars.length
      ? Math.round((withStars.reduce((s, r) => s + (r.stars ?? 0), 0) / withStars.length) * 10) / 10
      : null,
  };
}

// ── Stock, staff roles & per-event fees ────────────────

const SIGNED_QTY = `
  CASE m.kind
    WHEN 'PURCHASE'   THEN  m.qty
    WHEN 'RETURN'     THEN  m.qty
    WHEN 'ADJUSTMENT' THEN  m.qty
    ELSE -m.qty
  END`;

function mapStockItem(r: any): StockItemRow {
  const onHand = Number(r.opening_qty) + Number(r.net_moved);
  const committed = Number(r.committed);
  const available = onHand - committed;
  const reorderLevel = Number(r.reorder_level);
  const unitCost = Number(r.unit_cost);
  return {
    id: r.id,
    name: r.name,
    serviceLabel: r.service_label ?? null,
    categoryId: r.category_id ?? null,
    category: r.category ?? null,
    kind: r.kind,
    unit: r.unit,
    openingQty: Number(r.opening_qty),
    reorderLevel,
    unitCost,
    notes: r.notes ?? null,
    active: r.is_active === 1,
    onHand,
    committed,
    available,
    outNow: Number(r.issued) - Number(r.returned),
    brokenLost: Number(r.broken_lost),
    purchased: Number(r.purchased),
    movementCount: Number(r.movement_count),
    value: onHand * unitCost,
    // Measured against AVAILABLE, not on-hand: the question a reorder alert
    // answers is "will I have enough for what is already booked", and stock
    // promised to next week's wedding is not stock you can spend twice.
    // A reorder level of 0 means "not tracked" — without this every
    // zero-level item would sit permanently in the low-stock list.
    low: reorderLevel > 0 && available <= reorderLevel,
  };
}

export async function getStockItems(includeArchived = true): Promise<StockItemRow[]> {
  const rows = await query<any>(
    `SELECT i.id, i.name, i.service_label, i.category_id, c.name AS category, i.kind, i.unit,
            i.opening_qty, i.reorder_level, i.unit_cost, i.notes, i.is_active,
            COALESCE(SUM(CASE WHEN m.moved_on <= CURDATE() THEN ${SIGNED_QTY} ELSE 0 END), 0) AS net_moved,
            COALESCE(SUM(CASE WHEN m.kind = 'ISSUE' AND m.moved_on > CURDATE() THEN m.qty ELSE 0 END), 0) AS committed,
            COALESCE(SUM(CASE WHEN m.kind = 'ISSUE'  THEN m.qty ELSE 0 END), 0)     AS issued,
            COALESCE(SUM(CASE WHEN m.kind = 'RETURN' THEN m.qty ELSE 0 END), 0)     AS returned,
            COALESCE(SUM(CASE WHEN m.kind IN ('BREAKAGE','LOSS') THEN m.qty ELSE 0 END), 0) AS broken_lost,
            COALESCE(SUM(CASE WHEN m.kind = 'PURCHASE' THEN m.qty ELSE 0 END), 0)   AS purchased,
            COUNT(m.id) AS movement_count
       FROM stock_items i
       LEFT JOIN stock_categories c ON c.id = i.category_id
       LEFT JOIN stock_movements m  ON m.item_id = i.id
      ${includeArchived ? '' : 'WHERE i.is_active = 1'}
      GROUP BY i.id, i.name, i.service_label, i.category_id, c.name, i.kind, i.unit,
               i.opening_qty, i.reorder_level, i.unit_cost, i.notes, i.is_active
      ORDER BY i.is_active DESC, c.sort_order, c.name, i.name`,
  );
  return rows.map(mapStockItem);
}

export async function getStockCategories() {
  return query<any>(
    `SELECT c.id, c.name, c.sort_order, c.is_active,
            (SELECT COUNT(*) FROM stock_items i WHERE i.category_id = c.id) AS item_count
       FROM stock_categories c
      ORDER BY c.sort_order, c.name`,
  );
}

export async function getStockMovements(limit = 100, itemId?: number): Promise<StockMovementRow[]> {
  const rows = await query<any>(
    `SELECT m.id, m.item_id, i.name AS item_name, i.unit, m.kind, m.qty, ${SIGNED_QTY} AS signed_qty,
            m.unit_cost, m.booking_id, m.source, b.slip_no, p.party_name,
            m.moved_on, m.note, u.name AS by_name
       FROM stock_movements m
       JOIN stock_items i ON i.id = m.item_id
       LEFT JOIN bookings b ON b.id = m.booking_id
       LEFT JOIN parties  p ON p.id = b.party_id
       LEFT JOIN users    u ON u.id = m.created_by
      ${itemId ? 'WHERE m.item_id = ?' : ''}
      ORDER BY m.moved_on DESC, m.id DESC
      LIMIT ${toInt(limit, 100)}`,
    itemId ? [itemId] : [],
  );
  return rows.map((r: any) => ({
    id: r.id,
    itemId: r.item_id,
    itemName: r.item_name,
    unit: r.unit,
    kind: r.kind,
    qty: Number(r.qty),
    signedQty: Number(r.signed_qty),
    unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
    bookingId: r.booking_id ?? null,
    source: r.source ?? 'MANUAL',
    slipNo: r.slip_no ?? null,
    partyName: r.party_name ?? null,
    movedOn: r.moved_on,
    note: r.note ?? null,
    byName: r.by_name ?? null,
  }));
}

/** Headline figures for the stock page tiles. */
export async function getStockSummary(items: StockItemRow[]) {
  const active = items.filter((i) => i.active);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const breakage = await queryOne<{ qty: number; value: number }>(
    `SELECT COALESCE(SUM(m.qty), 0) AS qty,
            COALESCE(SUM(m.qty * i.unit_cost), 0) AS value
       FROM stock_movements m
       JOIN stock_items i ON i.id = m.item_id
      WHERE m.kind IN ('BREAKAGE','LOSS') AND m.moved_on >= ?`,
    [monthStart],
  );

  return {
    itemCount: active.length,
    lowCount: active.filter((i) => i.low).length,
    negativeCount: active.filter((i) => i.onHand < 0).length,
    totalValue: active.reduce((s, i) => s + i.value, 0),
    outNow: active.reduce((s, i) => s + Math.max(0, i.outNow), 0),
    committed: active.reduce((s, i) => s + i.committed, 0),
    breakageQtyThisMonth: Number(breakage?.qty ?? 0),
    breakageValueThisMonth: Number(breakage?.value ?? 0),
  };
}

/** Bookings offered when linking a movement to an event. */
export async function getStockBookingOptions(limit = 60) {
  return query<any>(
    `SELECT b.id, b.slip_no, b.event_date, p.party_name
       FROM bookings b
       JOIN parties p ON p.id = b.party_id
      WHERE b.status <> 'CANCELLED'
      ORDER BY b.event_date DESC
      LIMIT ${toInt(limit, 60)}`,
  );
}

/** Active stock items, shaped for the booking form's "deduct from stock" picker. */
export async function getStockPickerOptions() {
  const items = await getStockItems(false);
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    serviceLabel: i.serviceLabel,
    onHand: i.onHand,
    available: i.available,
  }));
}
export interface StockItemRow {
  id: number;
  name: string;
  /** Banquet service name this item is billed as — drives the booking-form match. */
  serviceLabel: string | null;
  categoryId: number | null;
  category: string | null;
  kind: 'DURABLE' | 'CONSUMABLE';
  unit: string;
  openingQty: number;
  reorderLevel: number;
  unitCost: number;
  notes: string | null;
  active: boolean;
  /** opening + net of every movement dated today or earlier. */
  onHand: number;
  /** Issues dated in the future — already promised to booked events. */
  committed: number;
  /** onHand − committed: what is genuinely free to promise to someone else. */
  available: number;
  /** Durables currently out at an event: issued minus returned. */
  outNow: number;
  brokenLost: number;
  purchased: number;
  movementCount: number;
  value: number;
  low: boolean;
}

export interface StockMovementRow {
  id: number;
  itemId: number;
  itemName: string;
  unit: string;
  kind: 'PURCHASE' | 'ISSUE' | 'RETURN' | 'BREAKAGE' | 'LOSS' | 'ADJUSTMENT';
  qty: number;
  signedQty: number;
  unitCost: number | null;
  bookingId: number | null;
  /** BOOKING rows are owned by a booking's service line and are read-only here. */
  source: 'MANUAL' | 'BOOKING';
  slipNo: string | null;
  partyName: string | null;
  movedOn: string;
  note: string | null;
  byName: string | null;
}

// ── Business profile ───────────────────────────────────

/**
 * The editable business profile, with the build-time defaults filling any gap.
 *
 * Reads one row per field from `settings`, so a half-filled profile still
 * renders — an empty value falls back rather than printing a blank on a slip.
 */
export async function getBrand(): Promise<BrandInfo> {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT \`key\`, value FROM settings WHERE \`key\` LIKE 'brand.%'`,
    );
    const saved = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...BRAND_DEFAULTS };
    for (const field of Object.keys(BRAND_DEFAULTS) as (keyof BrandInfo)[]) {
      const v = saved.get(brandKey(field));
      if (v != null && v.trim() !== '') out[field] = v;
    }
    return normaliseBrand(out);
  } catch {
    // A missing settings table must never take the website down.
    return BRAND_DEFAULTS;
  }
}
