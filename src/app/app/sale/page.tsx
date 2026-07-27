import { requirePermission, can } from '@/lib/session';
import { getDefaultPeriod, getMonthlyFinancials } from '@/lib/data';
import { buildMonthlySale } from '@/lib/accounting';
import { fmtMoney, fmtDate, monthLabelFull, resolvePeriod } from '@/lib/format';
import { Card, FadeUp } from '@/components/ui';
import { PeriodPicker, PrintButton } from '@/components/period-picker';
import { BrandLockup } from '@/components/brand';

export const metadata = { title: 'Monthly Sale — Royal Gold Banquet' };

export default async function SalePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('sale.view');
  const showProfit = can(user.permissions, 'profit.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());

  const fin = await getMonthlyFinancials(year, month);
  const ms = buildMonthlySale({
    settled: fin.settled, newBookings: fin.newBookings,
    expenseLines: fin.expenseLines, disbursements: fin.disbursements, attribution: fin.attribution,
  });

  return (
    <div className="space-y-6">
      <FadeUp className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">Monthly Sale</h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">Auto-computed from bookings · {monthLabelFull(year, month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker year={year} month={month} />
          <PrintButton label="Print sheet" />
        </div>
      </FadeUp>

      <div className="print-page space-y-5">
        {/* Print header */}
        <div className="print-only mb-4 flex items-center justify-between border-b pb-3">
          <BrandLockup />
          <div className="text-right">
            <div className="font-display text-lg">Monthly Sale</div>
            <div className="text-sm">{monthLabelFull(year, month)}</div>
          </div>
        </div>

        {/* Section A — Monthly Sale table */}
        <Card className="overflow-hidden">
          <div className="border-b border-[rgb(var(--border)/0.5)] px-5 py-3 font-display text-lg text-gold">Monthly Sale</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="px-4 py-2.5 font-medium">S.No</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Party Name</th>
                  <th className="px-4 py-2.5 font-medium">Slip #</th>
                  <th className="px-4 py-2.5 font-medium text-right">Balance Amount</th>
                  <th className="px-4 py-2.5 font-medium text-right">Banquet Amount</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ms.saleRows.map((r) => (
                  <tr key={r.slip} className="border-b border-[rgb(var(--border)/0.25)] last:border-0">
                    <td className="px-4 py-2.5 text-[rgb(var(--text-dim))]">{r.sNo}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text))]">{r.party}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-dim))]">{r.slip}</td>
                    <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(r.balance, false)}</td>
                    <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(r.banquet, false)}</td>
                    <td className="px-4 py-2.5 text-right tnum font-medium text-[rgb(var(--text))]">{fmtMoney(r.total, false)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[rgb(var(--gold)/0.12)] font-semibold text-gold">
                  <td className="px-4 py-3" colSpan={4}>TOTAL</td>
                  <td className="px-4 py-3 text-right tnum">{fmtMoney(ms.saleTotals.balance, false)}</td>
                  <td className="px-4 py-3 text-right tnum">{fmtMoney(ms.saleTotals.banquet, false)}</td>
                  <td className="px-4 py-3 text-right tnum">{fmtMoney(ms.saleTotals.total, false)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Section B — New Booking table */}
        <Card className="overflow-hidden">
          <div className="border-b border-[rgb(var(--border)/0.5)] px-5 py-3 font-display text-lg text-gold">New Booking</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="px-4 py-2.5 font-medium">S.No</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Party Name</th>
                  <th className="px-4 py-2.5 font-medium">Slip #</th>
                  <th className="px-4 py-2.5 font-medium">Event Date</th>
                  <th className="px-4 py-2.5 font-medium text-right">Advance Amount</th>
                </tr>
              </thead>
              <tbody>
                {ms.newBookingRows.map((r) => (
                  <tr key={r.slip} className="border-b border-[rgb(var(--border)/0.25)] last:border-0">
                    <td className="px-4 py-2.5 text-[rgb(var(--text-dim))]">{r.sNo}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text))]">{r.party}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-dim))]">{r.slip}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{fmtDate(r.eventDate)}</td>
                    <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(r.advance, false)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[rgb(var(--gold)/0.12)] font-semibold text-gold">
                  <td className="px-4 py-3" colSpan={5}>TOTAL AMOUNT</td>
                  <td className="px-4 py-3 text-right tnum">{fmtMoney(ms.newBookingTotal, false)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Section C — Profit & Loss */}
        <Card className="p-5">
          <div className="mb-3 font-display text-lg text-gold">Profit &amp; Loss Account</div>
          <div className="mx-auto max-w-md space-y-1.5 text-sm">
            <PL label="Balance Amount" value={ms.pnl.balanceAmount} />
            <PL label="Banquet Amount" value={ms.pnl.banquetAmount} />
            <PL label="Advance Booking Amount" value={ms.pnl.advanceBookingAmount} />
            <PL label="Total Sale" value={ms.pnl.totalSale} strong />
            <PL label="Expenses" value={-ms.pnl.expenses} negative />
            <PL label="Total" value={ms.pnl.total} strong />
            {showProfit ? (
              <>
                <PL label="Naseem Return" value={ms.pnl.naseemReturn} gold hint="profit recovery" />
                <PL label="Return" value={ms.pnl.managerReturn} muted />
                <div className="!mt-3 border-t border-[rgb(var(--gold)/0.4)] pt-2">
                  <PL label="TOTAL NET PROFIT" value={ms.pnl.totalNetProfit} big />
                </div>
              </>
            ) : (
              <div className="!mt-3 rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2 text-center text-xs text-[rgb(var(--text-dim))]">Net profit is visible to owners only.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PL({ label, value, strong, big, gold, negative, muted, hint }: { label: string; value: number; strong?: boolean; big?: boolean; gold?: boolean; negative?: boolean; muted?: boolean; hint?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-lg px-3 py-1.5 ${big ? 'bg-[rgb(var(--gold)/0.14)]' : strong ? 'bg-[rgb(var(--surface-2)/0.6)]' : ''}`}>
      <span className={`${big ? 'font-display text-base text-gold' : muted ? 'text-[rgb(var(--text-dim))]' : 'text-[rgb(var(--text-muted))]'}`}>
        {label} {hint && <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--text-dim))]">· {hint}</span>}
      </span>
      <span className={`tnum ${big ? 'font-display text-lg text-gold' : gold ? 'text-gold' : negative ? 'text-negative' : strong ? 'font-semibold text-[rgb(var(--text))]' : 'text-[rgb(var(--text))]'}`}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}
