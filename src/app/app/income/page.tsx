import { requirePermission, can } from '@/lib/session';
import { getDefaultPeriod, getMonthlyFinancials, getStockProfit } from '@/lib/data';
import { buildIncomeStatement } from '@/lib/accounting';
import { fmtMoney, fmtDate, monthLabelFull, resolvePeriod } from '@/lib/format';
import { Card, FadeUp } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { BrandLockup } from '@/components/brand';

export const metadata = { title: 'Income Statement — Skylight Ballroom & Catering' };

export default async function IncomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('income.view');
  const showProfit = can(user.permissions, 'profit.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());

  const fin = await getMonthlyFinancials(year, month);
  const stock = await getStockProfit(fin.from, fin.to);
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
    balanceAmount, banquetAmount, advanceBookingSale,
    expenseLines: fin.expenseLines, disbursements: fin.disbursements,
    alreadyPaidAgainstPC, dateFrom: fin.from, dateTo: fin.to,
  });

  const activeLines = is.lines.filter((l) => l.total !== 0 || l.amount !== 0);

  return (
    <div className="space-y-6">
      <FadeUp className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">Income Statement</h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">Derived from petty cash — never hand-entered · {monthLabelFull(year, month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker year={year} month={month} />
          <Link href={`/print/income?y=${year}&m=${month}`} className="no-print inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--gold)/0.1)]"><Printer className="h-4 w-4" /> Print statement</Link>
        </div>
      </FadeUp>

      <div className="print-page">
        <Card className="overflow-hidden">
          {/* Header block */}
          <div className="border-b border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface-2)/0.4)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <BrandLockup />
              <div className="text-right text-sm text-[rgb(var(--text-dim))]">
                <div className="font-display text-lg text-gold">Income Statement</div>
                <div>{fmtDate(is.header.dateFrom)} — {fmtDate(is.header.dateTo)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <HeaderStat label="Balance Amount" value={is.header.balanceAmount} />
              <HeaderStat label="Banquet Amount" value={is.header.banquetAmount} />
              <HeaderStat label="Advance Booking Sale" value={is.header.advanceBookingSale} />
              <HeaderStat label="Total" value={is.header.total} gold />
            </div>
          </div>

          {/* Stock sold through bookings: what it was billed at, less what it
              cost. Shown only when the month's events actually drew on stock,
              so a venue that resells nothing sees no empty panel. */}
          {showProfit && stock.rows.length > 0 && (
            <div className="border-b border-[rgb(var(--border)/0.5)] p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display text-lg text-gold">Stock Profit</div>
                <div className="text-xs text-[rgb(var(--text-dim))]">Items issued from stock against this month&apos;s events</div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <HeaderStat label="Billed to customers" value={stock.revenue} />
                <HeaderStat label="Stock cost" value={stock.cost} />
                <HeaderStat label="Profit on stock" value={stock.profit} gold />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[rgb(var(--border)/0.4)] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 pr-3 text-right font-medium">Qty</th>
                      <th className="py-2 pr-3 text-right font-medium">Billed</th>
                      <th className="py-2 pr-3 text-right font-medium">Cost</th>
                      <th className="py-2 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.rows.map((r) => (
                      <tr key={r.name} className="border-b border-[rgb(var(--border)/0.2)] last:border-0">
                        <td className="py-2 pr-3 text-[rgb(var(--text))]">{r.name}</td>
                        <td className="py-2 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{r.qty}</td>
                        <td className="py-2 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(r.revenue, false)}</td>
                        <td className="py-2 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(r.cost, false)}</td>
                        <td className={`py-2 text-right tnum ${r.profit >= 0 ? 'text-positive' : 'text-negative'}`}>{fmtMoney(r.profit, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expense body */}
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-dim))]">Expenses by head</div>
            <div className="overflow-x-auto">
              <table className="print-report-table w-full min-w-[700px] text-sm">
                <tbody>
                  {activeLines.map((l) => (
                    <tr key={l.head_id} className="border-b border-[rgb(var(--border)/0.2)] last:border-0">
                      <td className="py-2 pr-4 text-[rgb(var(--text-muted))]">
                        {l.name}
                        {l.qty_note && <span className="ml-2 text-xs text-[rgb(var(--text-dim))]">({l.qty_note})</span>}
                        {l.adjustment !== 0 && <span className="ml-2 text-xs text-warn">adj {fmtMoney(l.adjustment)}</span>}
                      </td>
                      <td className="py-2 text-right tnum text-[rgb(var(--text))]">{fmtMoney(l.total, false)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[rgb(var(--gold)/0.12)] font-semibold text-gold">
                    <td className="py-2.5 pr-4 pl-2">TOTAL EXPENSES</td>
                    <td className="py-2.5 pr-2 text-right tnum">{fmtMoney(is.totalExpenses, false)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer calc block — exact order & labels */}
          <div className="border-t border-[rgb(var(--border)/0.5)] p-5">
            <div className="mx-auto max-w-md space-y-1">
              <FRow label="ALREADY PAID AGAINST P/C" value={is.footer.alreadyPaidAgainstPC} />
              <FRow label="PAYABLE" value={is.footer.payable} />
              <FRow label="SALE" value={is.footer.sale} strong />
              <FRow label="EXPENSES" value={is.footer.expenses} negative />
              <FRow label="TOTAL" value={is.footer.total} strong />
              {showProfit ? (
                <>
                  <FRow label="NASEEM RETURN" value={is.footer.naseemReturn} gold hint="float held" />
                  <FRow label="NASEEM RETURN" value={is.footer.naseemReturn2} gold hint="returned" />
                  <div className="!mt-3 border-t border-[rgb(var(--gold)/0.4)] pt-2">
                    <FRow label="TOTAL NET PROFIT" value={is.footer.totalNetProfit} big />
                  </div>
                </>
              ) : (
                <div className="!mt-3 rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2 text-center text-xs text-[rgb(var(--text-dim))]">Net profit is visible to owners only.</div>
              )}
            </div>

            {/* Owner signature line */}
            <div className="print-signature-block no-print mt-10 flex justify-end">
              <div className="print-signature-line text-center">
                <div className="w-56 border-t border-[rgb(var(--border))]" />
                <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">Owner signature</div>
              </div>
            </div>
            {/* Real print signature block */}
            <div className="print-only print-signature-block" style={{ marginTop: '40px', padding: '0 40px', justifyContent: 'flex-end' }}>
              <div className="print-signature-line">Owner signature</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function HeaderStat({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div className={`print-report-kpi rounded-xl border p-3 ${gold ? 'print-report-kpi-gold border-[rgb(var(--gold)/0.4)] bg-[rgb(var(--gold)/0.1)]' : 'border-[rgb(var(--border)/0.5)]'}`}>
      <div className="print-report-kpi-label text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
      <div className={`print-report-kpi-value mt-1 tnum font-display text-lg ${gold ? 'text-gold' : 'text-[rgb(var(--text))]'}`}>{fmtMoney(value)}</div>
    </div>
  );
}

function FRow({ label, value, strong, big, gold, negative, hint }: { label: string; value: number; strong?: boolean; big?: boolean; gold?: boolean; negative?: boolean; hint?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-lg px-3 py-1.5 ${big ? 'bg-[rgb(var(--gold)/0.14)]' : ''}`}>
      <span className={`text-xs uppercase tracking-wider ${big ? 'font-display text-sm normal-case tracking-normal text-gold' : 'text-[rgb(var(--text-muted))]'}`}>
        {label}{hint && <span className="ml-1 normal-case text-[10px] text-[rgb(var(--text-dim))]">· {hint}</span>}
      </span>
      <span className={`tnum ${big ? 'font-display text-lg text-gold' : gold ? 'text-gold' : negative ? 'text-negative' : strong ? 'font-semibold text-[rgb(var(--text))]' : 'text-[rgb(var(--text))]'}`}>{fmtMoney(value)}</span>
    </div>
  );
}
