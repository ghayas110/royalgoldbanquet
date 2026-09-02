/**
 * SKYLIGHT BALLROOM — Accounting engine.
 *
 * ALL derived financial figures are computed here, in pure functions.
 * Never compute money in a component. Never let a human type a derived
 * number twice: petty cash → income statement → report is one flow.
 *
 * KEY RULE: "Naseem Return" (manager float held back) is a PROFIT RECOVERY.
 * It is ADDED BACK to net profit — it is never an expense line.
 */

import type {
  SettledBookingInput, NewBookingInput, ExpenseHeadTotal,
  DisbursementInput, MonthlySaleResult, ProfitLossBlock,
  IncomeStatementResult, FloatReconciliation,
} from './types';

/** Round to 2 decimals, avoiding float dust (e.g. 0.1+0.2). */
export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sum(nums: number[]): number {
  return money(nums.reduce((a, b) => a + b, 0));
}

// ── Float / Naseem Return reconciliation ───────────────

/**
 * Outstanding held by the manager for a single disbursement.
 * outstanding = disbursed − recorded − returned
 */
export function reconcileDisbursement(d: DisbursementInput): FloatReconciliation {
  const outstanding = money(d.amount_disbursed - d.expenses_recorded - d.amount_returned);
  return {
    id: d.id,
    slip_no: d.slip_no,
    amountDisbursed: money(d.amount_disbursed),
    expensesRecorded: money(d.expenses_recorded),
    amountReturned: money(d.amount_returned),
    outstanding,
    status: d.status,
  };
}

/**
 * Total "Naseem Return" for the period = the amount of float that is
 * accounted for outside of recorded expenses, i.e. what the manager
 * hands (or must hand) back. This is: disbursed − expenses_recorded.
 * (Whether physically returned yet or still outstanding, it is money
 * that was NOT an expense, so it is recovered to profit.)
 */
export function totalNaseemReturn(disbursements: DisbursementInput[]): number {
  return sum(disbursements.map((d) => d.amount_disbursed - d.expenses_recorded));
}

/** Amount actually handed back in cash (the second reconciliation line). */
export function totalManagerReturned(disbursements: DisbursementInput[]): number {
  return sum(disbursements.map((d) => d.amount_returned));
}

// ── Expense head aggregation ───────────────────────────

/**
 * Combine raw petty-cash sums with owner adjustments into line totals.
 * `adjustments` maps head_id → adjustment amount (may be negative).
 */
export function buildExpenseLines(
  heads: Array<{ head_id: number; name: string; amount: number; qty_note?: string | null }>,
  adjustments: Record<number, number> = {},
): ExpenseHeadTotal[] {
  return heads.map((h) => {
    const adjustment = money(adjustments[h.head_id] ?? 0);
    return {
      head_id: h.head_id,
      name: h.name,
      amount: money(h.amount),
      adjustment,
      qty_note: h.qty_note ?? null,
      total: money(h.amount + adjustment),
    };
  });
}

export function totalExpenses(lines: ExpenseHeadTotal[]): number {
  return sum(lines.map((l) => l.total));
}

// ── Monthly Sale (Image 2) ─────────────────────────────

export function buildMonthlySale(params: {
  settled: SettledBookingInput[];
  newBookings: NewBookingInput[];
  expenseLines: ExpenseHeadTotal[];
  disbursements: DisbursementInput[];
  attribution?: 'EVENT_MONTH' | 'SETTLEMENT_MONTH';
}): MonthlySaleResult {
  const { settled, newBookings, expenseLines, disbursements, attribution = 'EVENT_MONTH' } = params;

  const saleRows = settled.map((b, i) => ({
    sNo: i + 1,
    date: attribution === 'SETTLEMENT_MONTH' ? b.settlement_date : b.event_date,
    party: b.party_name,
    slip: b.slip_no,
    balance: money(b.balance_amount),
    banquet: money(b.banquet_amount),
    total: money(b.balance_amount + b.banquet_amount),
  }));

  const saleTotals = {
    balance: sum(saleRows.map((r) => r.balance)),
    banquet: sum(saleRows.map((r) => r.banquet)),
    total: sum(saleRows.map((r) => r.total)),
  };

  /**
   * Advances taken this month for events NOT already counted as sale.
   *
   * A booking taken and settled inside the same month appears in both lists:
   * its value is in the Monthly Sale table above as balance + banquet, and its
   * advance is here. Adding both to the income statement counted the same
   * money twice — one 128,000 event reported 256,000.
   *
   * This line exists to capture cash in for events whose sale has not been
   * recognised yet, so anything already in `settled` is excluded. It stays out
   * of the table as well as the total: listing an event that has already
   * happened under "advances received" would be wrong on its own terms.
   */
  const settledIds = new Set(settled.map((b) => b.id));
  const newBookingRows = newBookings
    .filter((b) => !settledIds.has(b.id))
    .map((b, i) => ({
      sNo: i + 1,
      date: b.booking_date,
      party: b.party_name,
      slip: b.slip_no,
      eventDate: b.event_date,
      advance: money(b.advance_amount),
    }));
  const newBookingTotal = sum(newBookingRows.map((r) => r.advance));

  const expenses = totalExpenses(expenseLines);
  const pnl = buildProfitLoss({
    balanceAmount: saleTotals.balance,
    banquetAmount: saleTotals.banquet,
    advanceBookingAmount: newBookingTotal,
    expenses,
    disbursements,
  });

  return { saleRows, saleTotals, newBookingRows, newBookingTotal, pnl };
}

// ── Profit & Loss block (Image 2 Section C) ────────────

export function buildProfitLoss(params: {
  balanceAmount: number;
  banquetAmount: number;
  advanceBookingAmount: number;
  expenses: number;
  disbursements: DisbursementInput[];
}): ProfitLossBlock {
  const { balanceAmount, banquetAmount, advanceBookingAmount, expenses, disbursements } = params;
  const totalSale = money(balanceAmount + banquetAmount + advanceBookingAmount);
  const total = money(totalSale - expenses);

  const naseemReturn = totalNaseemReturn(disbursements);   // profit recovery, ADDED
  const managerReturn = totalManagerReturned(disbursements); // cash physically returned

  // Net profit = (sale − expenses) + float recovered back to owner.
  // Naseem Return is added, never subtracted, and never an expense line.
  const totalNetProfit = money(total + naseemReturn);

  return {
    balanceAmount: money(balanceAmount),
    banquetAmount: money(banquetAmount),
    advanceBookingAmount: money(advanceBookingAmount),
    totalSale,
    expenses: money(expenses),
    total,
    naseemReturn,
    managerReturn,
    totalNetProfit,
  };
}

// ── Income Statement (Image 3) ─────────────────────────

export function buildIncomeStatement(params: {
  balanceAmount: number;
  banquetAmount: number;
  advanceBookingSale: number;
  expenseLines: ExpenseHeadTotal[];
  disbursements: DisbursementInput[];
  alreadyPaidAgainstPC?: number;
  dateFrom: string;
  dateTo: string;
}): IncomeStatementResult {
  const {
    balanceAmount, banquetAmount, advanceBookingSale, expenseLines,
    disbursements, alreadyPaidAgainstPC = 0, dateFrom, dateTo,
  } = params;

  const total = money(balanceAmount + banquetAmount + advanceBookingSale);
  const expenses = totalExpenses(expenseLines);

  const naseemReturn = totalNaseemReturn(disbursements);    // held back / recovered
  const naseemReturn2 = totalManagerReturned(disbursements); // physically returned
  const sale = total;

  // PAYABLE = expenses that still need to be settled from the owner's side
  //           (expenses recorded − already paid against petty cash float).
  const payable = money(expenses - alreadyPaidAgainstPC);

  // TOTAL (footer) = SALE − EXPENSES, then Naseem Return recovers profit.
  const footerTotal = money(sale - expenses);
  const totalNetProfit = money(footerTotal + naseemReturn);

  return {
    header: {
      balanceAmount: money(balanceAmount),
      banquetAmount: money(banquetAmount),
      advanceBookingSale: money(advanceBookingSale),
      total,
      dateFrom,
      dateTo,
    },
    lines: expenseLines,
    totalExpenses: money(expenses),
    footer: {
      alreadyPaidAgainstPC: money(alreadyPaidAgainstPC),
      payable,
      sale,
      expenses: money(expenses),
      total: footerTotal,
      naseemReturn,
      naseemReturn2,
      totalNetProfit,
    },
  };
}

export * from './types';
