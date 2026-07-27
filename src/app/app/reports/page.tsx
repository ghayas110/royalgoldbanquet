import { requirePermission, can } from '@/lib/session';
import { getDefaultPeriod, getMonthlyFinancials, getFloatLedger, getPettyCashMatrix } from '@/lib/data';
import { buildMonthlySale, buildIncomeStatement } from '@/lib/accounting';
import { fmtMoney, fmtDate, monthLabelFull, resolvePeriod, MONTHS } from '@/lib/format';
import { Card, FadeUp } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { BrandLockup, RoyalGoldLogo } from '@/components/brand';
import { BRAND } from '@/lib/brand-info';

export const metadata = { title: 'Monthly Report — Royal Gold Banquet' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('reports.generate');
  const showProfit = can(user.permissions, 'profit.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());

  const fin = await getMonthlyFinancials(year, month);
  const ms = buildMonthlySale({ settled: fin.settled, newBookings: fin.newBookings, expenseLines: fin.expenseLines, disbursements: fin.disbursements, attribution: fin.attribution });
  const is = buildIncomeStatement({
    balanceAmount: ms.saleTotals.balance, banquetAmount: ms.saleTotals.banquet, advanceBookingSale: ms.newBookingTotal,
    expenseLines: fin.expenseLines, disbursements: fin.disbursements,
    alreadyPaidAgainstPC: fin.disbursements.reduce((s, d) => s + d.expenses_recorded, 0),
    dateFrom: fin.from, dateTo: fin.to,
  });
  const [ledger, matrix] = await Promise.all([getFloatLedger(), getPettyCashMatrix(year, month)]);
  const periodLedger = ledger.filter((r) => String(r.date_disbursed).slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`);

  const activeLines = is.lines.filter((l) => l.total !== 0);
  const label = monthLabelFull(year, month);

  return (
    <div className="space-y-6">
      <FadeUp className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">Monthly Report</h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">Consolidated print pack · {label}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker year={year} month={month} />
          <Link href={`/print/report?y=${year}&m=${month}`} className="no-print inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--gold)/0.1)]"><Printer className="h-4 w-4" /> Generate PDF (Print)</Link>
        </div>
      </FadeUp>

      {/* Page 1 — Cover */}
      <div className="print-page">
        <Card className="overflow-hidden text-center">
          <div className="print-band" style={{ padding: '22px 16px' }}>
            <RoyalGoldLogo size="lg" />
          </div>
          <div className="p-8">
            <div className="text-xs uppercase tracking-[0.35em] text-[rgb(var(--text-dim))]">Monthly Report</div>
            <h2 className="mt-2 font-display text-4xl text-gold-gradient">{label}</h2>
            <div className="mt-2 text-sm text-[rgb(var(--text-dim))]">Generated {fmtDate(new Date())} · Prepared for Owner</div>
            <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
              <Tile label="Total Sale" value={ms.pnl.totalSale} />
              <Tile label="Total Expenses" value={is.totalExpenses} />
              {showProfit ? <Tile label="Net Profit" value={ms.pnl.totalNetProfit} gold /> : <Tile label="Advance" value={ms.newBookingTotal} />}
              <Tile label="Bookings" value={fin.settled.length + fin.newBookings.length} count />
            </div>
            <div className="mt-10 text-xs text-[rgb(var(--text-dim))]">
              {BRAND.address} · Ph {BRAND.phone} · fb/{BRAND.facebook}
            </div>
          </div>
        </Card>
      </div>

      {/* Page 2 — Monthly Sale */}
      <div className="print-page">
        <Card className="p-5">
          <PageHead label={label} title="Monthly Sale" />
          <MiniTable
            head={['S.No', 'Date', 'Party', 'Slip', 'Balance', 'Banquet', 'Total']}
            rows={ms.saleRows.map((r) => [String(r.sNo), fmtDate(r.date), r.party, r.slip, fmtMoney(r.balance, false), fmtMoney(r.banquet, false), fmtMoney(r.total, false)])}
            foot={['TOTAL', '', '', '', fmtMoney(ms.saleTotals.balance, false), fmtMoney(ms.saleTotals.banquet, false), fmtMoney(ms.saleTotals.total, false)]}
            rightCols={[4, 5, 6]}
          />
          <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-gold">New Booking</div>
          <MiniTable
            head={['S.No', 'Date', 'Party', 'Slip', 'Event', 'Advance']}
            rows={ms.newBookingRows.map((r) => [String(r.sNo), fmtDate(r.date), r.party, r.slip, fmtDate(r.eventDate), fmtMoney(r.advance, false)])}
            foot={['TOTAL', '', '', '', '', fmtMoney(ms.newBookingTotal, false)]}
            rightCols={[5]}
          />
        </Card>
      </div>

      {/* Page 3 — Income Statement */}
      <div className="print-page">
        <Card className="p-5">
          <PageHead label={label} title="Income Statement" />
          <div className="mb-4 grid grid-cols-4 gap-2 text-sm">
            <Tile label="Balance" value={is.header.balanceAmount} small />
            <Tile label="Banquet" value={is.header.banquetAmount} small />
            <Tile label="Advance" value={is.header.advanceBookingSale} small />
            <Tile label="Total" value={is.header.total} small gold />
          </div>
          <MiniTable
            head={['Expense head', 'Amount']}
            rows={activeLines.map((l) => [l.name + (l.qty_note ? ` (${l.qty_note})` : ''), fmtMoney(l.total, false)])}
            foot={['TOTAL EXPENSES', fmtMoney(is.totalExpenses, false)]}
            rightCols={[1]}
          />
          {showProfit && (
            <div className="mx-auto mt-4 max-w-xs space-y-1 text-sm">
              {[['SALE', is.footer.sale], ['EXPENSES', is.footer.expenses], ['TOTAL', is.footer.total], ['NASEEM RETURN', is.footer.naseemReturn], ['NASEEM RETURN', is.footer.naseemReturn2]].map(([l, v], i) => (
                <div key={i} className="flex justify-between"><span className="text-[rgb(var(--text-muted))]">{l as string}</span><span className="tnum">{fmtMoney(v as number)}</span></div>
              ))}
              <div className="flex justify-between border-t border-[rgb(var(--gold)/0.4)] pt-1 font-semibold text-gold"><span>TOTAL NET PROFIT</span><span className="tnum">{fmtMoney(is.footer.totalNetProfit)}</span></div>
            </div>
          )}
        </Card>
      </div>

      {/* Page 4 — Petty Cash (column summary) */}
      <div className="print-page">
        <Card className="p-5">
          <PageHead label={label} title="Petty Cash — Column Summary" />
          <MiniTable
            head={['Expense head', 'Month total']}
            rows={matrix.heads.map((h) => {
              let s = 0; for (let d = 1; d <= matrix.days; d++) s += matrix.cells[`${d}|${h.id}`]?.amount ?? 0;
              return [h.name, fmtMoney(s, false)];
            }).filter((r) => r[1] !== '0')}
            foot={['GRAND TOTAL', fmtMoney(is.totalExpenses, false)]}
            rightCols={[1]}
          />
          <p className="mt-3 text-xs text-[rgb(var(--text-dim))]">Full daily matrix (1–{matrix.days}) is available on the Petty Cash screen and prints in landscape.</p>
        </Card>
      </div>

      {/* Page 5 — Manager Reconciliation */}
      <div className="print-page">
        <Card className="p-5">
          <PageHead label={label} title="Manager Reconciliation" />
          <MiniTable
            head={['Slip', 'Disbursed', 'Recorded', 'Returned', 'Outstanding', 'Status']}
            rows={periodLedger.map((r) => [r.slip_no ?? 'General', fmtMoney(r.amount_disbursed, false), fmtMoney(r.expenses_recorded, false), fmtMoney(r.amount_returned, false), fmtMoney(r.outstanding, false), r.status])}
            foot={['TOTAL', fmtMoney(periodLedger.reduce((s, r) => s + r.amount_disbursed, 0), false), fmtMoney(periodLedger.reduce((s, r) => s + r.expenses_recorded, 0), false), fmtMoney(periodLedger.reduce((s, r) => s + r.amount_returned, 0), false), fmtMoney(periodLedger.reduce((s, r) => s + r.outstanding, 0), false), '']}
            rightCols={[1, 2, 3, 4]}
          />
          <div className="mt-16 flex justify-between px-8 text-xs text-[rgb(var(--text-dim))]">
            <div className="text-center"><div className="w-48 border-t border-[rgb(var(--border))]" /><div className="mt-1">Manager (Naseem)</div></div>
            <div className="text-center"><div className="w-48 border-t border-[rgb(var(--border))]" /><div className="mt-1">Owner (Usama)</div></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PageHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-[rgb(var(--border)/0.5)] pb-3">
      <BrandLockup compact />
      <div className="text-right"><div className="font-display text-lg text-gold">{title}</div><div className="text-xs text-[rgb(var(--text-dim))]">{label}</div></div>
    </div>
  );
}

function Tile({ label, value, gold, small, count }: { label: string; value: number; gold?: boolean; small?: boolean; count?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${gold ? 'border-[rgb(var(--gold)/0.4)] bg-[rgb(var(--gold)/0.08)]' : 'border-[rgb(var(--border)/0.5)]'}`}>
      <div className="text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
      <div className={`mt-1 tnum font-display ${small ? 'text-base' : 'text-xl'} ${gold ? 'text-gold' : 'text-[rgb(var(--text))]'}`}>{count ? Math.round(value) : fmtMoney(value)}</div>
    </div>
  );
}

function MiniTable({ head, rows, foot, rightCols = [] }: { head: string[]; rows: string[][]; foot?: string[]; rightCols?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-[rgb(var(--border)/0.5)] text-left uppercase tracking-wider text-[rgb(var(--text-dim))]">{head.map((h, i) => <th key={i} className={`px-2 py-1.5 font-medium ${rightCols.includes(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => <tr key={ri} className="border-b border-[rgb(var(--border)/0.2)]">{r.map((c, ci) => <td key={ci} className={`px-2 py-1.5 ${rightCols.includes(ci) ? 'text-right tnum text-[rgb(var(--text))]' : 'text-[rgb(var(--text-muted))]'}`}>{c}</td>)}</tr>)}
        </tbody>
        {foot && <tfoot><tr className="bg-[rgb(var(--gold)/0.12)] font-semibold text-gold">{foot.map((c, ci) => <td key={ci} className={`px-2 py-2 ${rightCols.includes(ci) ? 'text-right tnum' : ''}`}>{c}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}
