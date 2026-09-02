import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { getEventLedger } from '@/lib/catering';
import { Card, SectionTitle, Badge, EmptyState, TableScroll } from '@/components/ui';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Scale } from 'lucide-react';

export const metadata = { title: 'Event Ledger — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringLedgerPage() {
  await requirePermission('catering.reports');
  const events = await getEventLedger();

  const totals = events.reduce(
    (a, e) => ({
      revenue: a.revenue + e.revenue,
      cost: a.cost + e.payableTotal,
      profit: a.profit + e.profit,
      outstanding: a.outstanding + (e.payableTotal - e.payablePaid),
    }),
    { revenue: 0, cost: 0, profit: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub="What each event earned once its vendors are paid. Revenue is the invoice where one has been raised, otherwise the quotation."
      >
        Event Ledger
      </SectionTitle>

      {events.length === 0 ? (
        <Card className="p-5">
          <EmptyState icon={<Scale className="h-8 w-8" />} title="No events yet" sub="Quotations appear here as soon as they are raised." />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['Revenue', totals.revenue, 'text-[rgb(var(--text))]'],
              ['Vendor cost', totals.cost, 'text-[rgb(var(--text))]'],
              ['Profit', totals.profit, totals.profit >= 0 ? 'text-positive' : 'text-negative'],
              ['Still owed to vendors', totals.outstanding, totals.outstanding > 0 ? 'text-negative' : 'text-positive'],
            ] as const).map(([label, value, tone]) => (
              <Card key={label} className="p-5">
                <div className="text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
                <div className={`mt-1 font-display text-2xl tnum ${tone}`}>{fmtMoney(value)}</div>
              </Card>
            ))}
          </div>

          <Card className="p-0">
            <TableScroll>
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2))] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Event</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium">Vendor cost</th>
                    <th className="px-4 py-2.5 text-right font-medium">Unpaid</th>
                    <th className="px-4 py-2.5 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const unpaid = e.payableTotal - e.payablePaid;
                    return (
                      <tr key={e.eventId} className="border-b border-[rgb(var(--border)/0.2)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                        <td className="px-4 py-2.5">
                          <Link href={`/catering/ledger/${e.eventId}`} className="text-[rgb(var(--text))] hover:text-gold">
                            {e.customerName || 'Unnamed'}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[rgb(var(--text-dim))]">
                            <span>{e.quotaNo}</span>
                            {e.invoiceNo
                              ? <Badge tone="green">{e.invoiceNo}</Badge>
                              : <Badge tone="muted">Not invoiced</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{e.eventDate ? fmtDate(e.eventDate) : '—'}</td>
                        <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(e.revenue, false)}</td>
                        <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(e.payableTotal, false)}</td>
                        <td className={`px-4 py-2.5 text-right tnum ${unpaid > 0 ? 'text-negative' : 'text-[rgb(var(--text-dim))]'}`}>
                          {unpaid > 0 ? fmtMoney(unpaid, false) : '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-right tnum ${e.profit >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {fmtMoney(e.profit, false)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </Card>

          <p className="text-xs text-[rgb(var(--text-dim))]">
            Profit is revenue less every vendor bill on the event, whether or not it has been paid yet.
            The unpaid column is what is still owed out of that.
          </p>
        </>
      )}
    </div>
  );
}
