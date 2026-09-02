import { requirePermission, hasPermission } from '@/lib/session';
import { getDefaultPeriod, getMonthlyFinancials, getBrand } from '@/lib/data';
import { buildIncomeStatement } from '@/lib/accounting';
import { resolvePeriod } from '@/lib/format';
import { PrintShell } from '@/components/print/print-shell';
import { IncomeDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Income Statement — Skylight Ballroom & Catering' };

export default async function IncomePrint({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('income.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());

  const [fin, brand] = await Promise.all([getMonthlyFinancials(year, month), getBrand()]);
  const balanceAmount = fin.settled.reduce((s, b) => s + b.balance_amount, 0);
  const banquetAmount = fin.settled.reduce((s, b) => s + b.banquet_amount, 0);
  // Excludes bookings already counted as settled sale in this period: their
  // value is in balance + banquet above, and adding the advance too counted
  // the same money twice. Mirrors the rule in `buildMonthlySale`.
  const settledIds = new Set(fin.settled.map((b) => b.id));
  const advanceBookingSale = fin.newBookings
    .filter((b) => !settledIds.has(b.id))
    .reduce((s, b) => s + b.advance_amount, 0);
  const alreadyPaidAgainstPC = fin.disbursements.reduce((s, d) => s + d.expenses_recorded, 0);

  const is = buildIncomeStatement({
    balanceAmount, banquetAmount, advanceBookingSale, expenseLines: fin.expenseLines,
    disbursements: fin.disbursements, alreadyPaidAgainstPC, dateFrom: fin.from, dateTo: fin.to,
  });

  return (
    <PrintShell backHref={`/app/income?y=${year}&m=${month}`}>
      <IncomeDoc brand={brand} d={{
        dateFrom: is.header.dateFrom, dateTo: is.header.dateTo,
        balanceAmount: is.header.balanceAmount, banquetAmount: is.header.banquetAmount,
        advanceBookingSale: is.header.advanceBookingSale, total: is.header.total,
        lines: is.lines.map((l) => ({ name: l.name, total: l.total, qty_note: l.qty_note })),
        totalExpenses: is.totalExpenses, showProfit: hasPermission(user, 'profit.view'),
        footer: { sale: is.footer.sale, expenses: is.footer.expenses, total: is.footer.total, naseemReturn: is.footer.naseemReturn, naseemReturn2: is.footer.naseemReturn2, totalNetProfit: is.footer.totalNetProfit },
      }} />
    </PrintShell>
  );
}
