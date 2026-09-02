/**
 * Lightweight zero-dependency unit tests for the accounting engine.
 * Run: npm test
 */
import {
  money, sum, reconcileDisbursement, totalNaseemReturn, buildExpenseLines,
  totalExpenses, buildProfitLoss, buildIncomeStatement, buildMonthlySale,
} from '../src/lib/accounting/index';
import type { DisbursementInput } from '../src/lib/accounting/types';

let passed = 0, failed = 0;
function eq(actual: number, expected: number, label: string) {
  if (money(actual) === money(expected)) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} — expected ${expected}, got ${actual}`); }
}

console.log('\nmoney()/sum()');
eq(money(0.1 + 0.2), 0.3, 'no float dust');
eq(sum([100.5, 200.25, 99.25]), 400, 'sum rounds');

console.log('\nFloat reconciliation');
const d: DisbursementInput = { id: 1, slip_no: 'X', amount_disbursed: 20000, expenses_recorded: 10500, amount_returned: 0, status: 'OPEN' };
eq(reconcileDisbursement(d).outstanding, 9500, 'outstanding = 20000 - 10500 - 0');
// Brief example: disbursed 20000, recorded 10500 → Naseem Return 9500
eq(totalNaseemReturn([d]), 9500, 'Naseem Return = disbursed - recorded (brief example)');

const d2: DisbursementInput = { id: 2, slip_no: 'Y', amount_disbursed: 20000, expenses_recorded: 10500, amount_returned: 9500, status: 'RECONCILED' };
eq(reconcileDisbursement(d2).outstanding, 0, 'fully reconciled → 0 outstanding');
eq(totalNaseemReturn([d2]), 9500, 'Naseem Return unchanged once returned');

console.log('\nExpense lines + adjustments');
const lines = buildExpenseLines(
  [{ head_id: 1, name: 'Salary', amount: 185000 }, { head_id: 2, name: 'Petrol', amount: 42000 }],
  { 2: 1000 }, // owner adjusts petrol +1000
);
eq(totalExpenses(lines), 228000, 'total expenses incl adjustment');
eq(lines[1].total, 43000, 'adjusted line total');

console.log('\nProfit & Loss — Naseem Return is a recovery, not an expense');
const pnl = buildProfitLoss({
  balanceAmount: 350000, banquetAmount: 150000, advanceBookingAmount: 200000,
  expenses: 400000, disbursements: [d],
});
eq(pnl.totalSale, 700000, 'total sale');
eq(pnl.total, 300000, 'total = sale - expenses');
eq(pnl.totalNetProfit, 309500, 'net profit = (sale - expenses) + naseem return');
// Prove it is ADDED not subtracted:
const pnlNoFloat = buildProfitLoss({ balanceAmount: 350000, banquetAmount: 150000, advanceBookingAmount: 200000, expenses: 400000, disbursements: [] });
eq(pnl.totalNetProfit - pnlNoFloat.totalNetProfit, 9500, 'float adds exactly the recovery');

console.log('\nIncome Statement footer');
const is = buildIncomeStatement({
  balanceAmount: 350000, banquetAmount: 150000, advanceBookingSale: 200000,
  expenseLines: lines, disbursements: [d], alreadyPaidAgainstPC: 100000,
  dateFrom: '2026-06-01', dateTo: '2026-06-30',
});
eq(is.header.total, 700000, 'header total = sum of three');
eq(is.footer.payable, 128000, 'payable = expenses - already paid');
eq(is.footer.naseemReturn, 9500, 'footer naseem return');
eq(is.footer.totalNetProfit, money(700000 - 228000 + 9500), 'footer net profit');

console.log('\nMonthly Sale assembly');
const ms = buildMonthlySale({
  settled: [
    { id: 1, slip_no: 'SKY-1', party_name: 'A', event_date: '2026-06-03', settlement_date: '2026-06-03', balance_amount: 350000, banquet_amount: 150000 },
    { id: 2, slip_no: 'SKY-2', party_name: 'B', event_date: '2026-06-07', settlement_date: '2026-06-07', balance_amount: 400000, banquet_amount: 160000 },
  ],
  newBookings: [{ id: 3, slip_no: 'SKY-3', party_name: 'C', booking_date: '2026-06-04', event_date: '2026-08-15', advance_amount: 180000 }],
  expenseLines: lines, disbursements: [d],
});
eq(ms.saleTotals.balance, 750000, 'sale balance total');
eq(ms.saleTotals.total, 1060000, 'sale grand total');
eq(ms.newBookingTotal, 180000, 'new booking advance total');
eq(ms.pnl.totalSale, 1240000, 'pnl total sale includes advances');

console.log('\nAttendance rule — 1 absent = 1 day, 3 lates = 1 day');
import { summarizeAttendance, salaryDeduction } from '../src/lib/attendance-calc';
const a1 = summarizeAttendance({ present: 20, absent: 2, late: 3, leave: 1 });
eq(a1.lateAsAbsent, 1, '3 lates → 1 absent day');
eq(a1.effectiveAbsentDays, 3, 'effective absent = 2 + floor(3/3)');
eq(a1.lateRemainder, 0, 'no leftover lates');
const a2 = summarizeAttendance({ present: 22, absent: 0, late: 7, leave: 0 });
eq(a2.lateAsAbsent, 2, '7 lates → 2 absent days');
eq(a2.effectiveAbsentDays, 2, '0 absent + floor(7/3)');
eq(a2.lateRemainder, 1, '1 leftover late (not yet converted)');
eq(salaryDeduction(30000, 30, 3), 3000, 'salary deduction = perDay * effAbsent');

console.log(`\n${failed === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
