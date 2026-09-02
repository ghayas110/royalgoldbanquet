import { requirePermission, hasPermission } from '@/lib/session';
import { getDefaultPeriod, getMonthlyFinancials, getFloatLedger, getPettyCashMatrix,
  getSalarySheet, getStaffLoanLedger, getBrand, getStockProfit } from '@/lib/data';
import { buildMonthlySale, buildIncomeStatement } from '@/lib/accounting';
import { resolvePeriod, monthLabelFull, fmtDate } from '@/lib/format';
import { PrintShell } from '@/components/print/print-shell';
import { ReportDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Monthly Report — Skylight Ballroom & Catering' };

export default async function ReportPrint({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('reports.generate');
  const showProfit = hasPermission(user, 'profit.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());

  const fin = await getMonthlyFinancials(year, month);
  const ms = buildMonthlySale({ settled: fin.settled, newBookings: fin.newBookings, expenseLines: fin.expenseLines, disbursements: fin.disbursements, attribution: fin.attribution });
  const is = buildIncomeStatement({
    balanceAmount: ms.saleTotals.balance, banquetAmount: ms.saleTotals.banquet, advanceBookingSale: ms.newBookingTotal,
    expenseLines: fin.expenseLines, disbursements: fin.disbursements,
    alreadyPaidAgainstPC: fin.disbursements.reduce((s, d) => s + d.expenses_recorded, 0), dateFrom: fin.from, dateTo: fin.to,
  });
  const [ledger, matrix, salaryRows, staffLoan, brand, stockProfit] = await Promise.all([
    getFloatLedger(), getPettyCashMatrix(year, month),
    getSalarySheet(year, month), getStaffLoanLedger(year, month, 8), getBrand(),
    getStockProfit(fin.from, fin.to),
  ]);
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const recon = ledger.filter((r) => String(r.date_disbursed).slice(0, 7) === key);

  // Flatten petty-cash cells to amount-only for the matrix
  const pettyCells: Record<string, number> = {};
  for (const [k, v] of Object.entries(matrix.cells)) pettyCells[k] = Number((v as { amount: number }).amount) || 0;

  return (
    <PrintShell backHref={`/app/reports?y=${year}&m=${month}`}>
      <ReportDoc brand={brand} r={{
        label: monthLabelFull(year, month), generated: fmtDate(new Date()), showProfit,
        salary: { label: monthLabelFull(year, month), rows: salaryRows, loan: staffLoan },
        kpis: { totalSale: ms.pnl.totalSale, totalExpenses: is.totalExpenses, netProfit: ms.pnl.totalNetProfit, bookings: fin.settled.length + fin.newBookings.length },
        petty: { days: matrix.days, heads: matrix.heads.map((h) => ({ id: h.id, name: h.name })), cells: pettyCells },
        income: {
          dateFrom: is.header.dateFrom, dateTo: is.header.dateTo,
          balanceAmount: is.header.balanceAmount, banquetAmount: is.header.banquetAmount,
          advanceBookingSale: is.header.advanceBookingSale, total: is.header.total,
          lines: is.lines.map((l) => ({ name: l.name, total: l.total, qty_note: l.qty_note })),
          totalExpenses: is.totalExpenses, showProfit,
          footer: { sale: is.footer.sale, expenses: is.footer.expenses, total: is.footer.total, naseemReturn: is.footer.naseemReturn, naseemReturn2: is.footer.naseemReturn2, totalNetProfit: is.footer.totalNetProfit },
        },
        // Only when the profit figures are visible to this user: the margin on
        // resold stock is a profit number like any other.
        stockProfit: showProfit ? stockProfit : undefined,
        saleRows: ms.saleRows, saleTotals: ms.saleTotals,
        newBookingRows: ms.newBookingRows, newBookingTotal: ms.newBookingTotal,
        pnl: { balanceAmount: ms.pnl.balanceAmount, banquetAmount: ms.pnl.banquetAmount, advanceBookingAmount: ms.pnl.advanceBookingAmount, totalSale: ms.pnl.totalSale, expenses: ms.pnl.expenses, total: ms.pnl.total, naseemReturn: ms.pnl.naseemReturn, totalNetProfit: ms.pnl.totalNetProfit },
        recon: recon.map((x) => ({ slip: x.slip_no ?? 'General', disbursed: x.amount_disbursed, recorded: x.expenses_recorded, returned: x.amount_returned, outstanding: x.outstanding, status: x.status })),
      }} />
    </PrintShell>
  );
}
