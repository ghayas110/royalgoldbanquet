/**
 * Pure data shapes for the accounting engine. No DB, no I/O here.
 * Everything that feeds these functions is plain numbers/rows so the
 * functions stay deterministic and unit-testable.
 */

export interface SettledBookingInput {
  id: number;
  slip_no: string;
  party_name: string;
  event_date: string;      // YYYY-MM-DD
  settlement_date: string; // YYYY-MM-DD (date of final payment)
  balance_amount: number;
  banquet_amount: number;
}

export interface NewBookingInput {
  id: number;
  slip_no: string;
  party_name: string;
  booking_date: string;
  event_date: string;
  advance_amount: number;
}

export interface ExpenseHeadTotal {
  head_id: number;
  name: string;
  amount: number;      // summed petty-cash for the period
  adjustment: number;  // owner manual adjustment (default 0)
  qty_note?: string | null;
  total: number;       // amount + adjustment
}

export interface DisbursementInput {
  id: number;
  slip_no: string | null;
  amount_disbursed: number;
  expenses_recorded: number; // SUM petty-cash tagged to this disbursement
  amount_returned: number;
  status: 'OPEN' | 'RECONCILED' | 'DISPUTED';
}

// ── Outputs ────────────────────────────────────────────

export interface MonthlySaleResult {
  // Section A — settled events in period
  saleRows: Array<{
    sNo: number; date: string; party: string; slip: string;
    balance: number; banquet: number; total: number;
  }>;
  saleTotals: { balance: number; banquet: number; total: number };
  // Section B — new bookings made in period
  newBookingRows: Array<{
    sNo: number; date: string; party: string; slip: string;
    eventDate: string; advance: number;
  }>;
  newBookingTotal: number;
  // Section C — P&L block
  pnl: ProfitLossBlock;
}

export interface ProfitLossBlock {
  balanceAmount: number;
  banquetAmount: number;
  advanceBookingAmount: number;
  totalSale: number;
  expenses: number;
  total: number;          // totalSale - expenses
  naseemReturn: number;   // profit recovery added back
  managerReturn: number;  // second reconciliation line
  totalNetProfit: number;
}

export interface IncomeStatementResult {
  header: {
    balanceAmount: number;
    banquetAmount: number;
    advanceBookingSale: number;
    total: number;
    dateFrom: string;
    dateTo: string;
  };
  lines: ExpenseHeadTotal[];
  totalExpenses: number;
  footer: {
    alreadyPaidAgainstPC: number;
    payable: number;
    sale: number;
    expenses: number;
    total: number;
    naseemReturn: number;    // manager float held back
    naseemReturn2: number;   // second reconciliation line
    totalNetProfit: number;
  };
}

export interface FloatReconciliation {
  id: number;
  slip_no: string | null;
  amountDisbursed: number;
  expensesRecorded: number;
  amountReturned: number;
  outstanding: number; // disbursed - recorded - returned
  status: 'OPEN' | 'RECONCILED' | 'DISPUTED';
}
