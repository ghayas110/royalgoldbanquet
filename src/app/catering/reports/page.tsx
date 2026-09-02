import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import {
  getCateringSummary, getCateringTrend, getCateringDishMix, getCateringQuotations,
} from '@/lib/catering';
import { getDefaultPeriod } from '@/lib/data';
import { monthRange, monthLabelFull, fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Badge, EmptyState, TableScroll } from '@/components/ui';
import { StatTile } from '@/components/stat-tile';
import { PeriodPicker } from '@/components/period-picker';
import { RevenueTrend } from '@/components/charts';
import { CATERING_STATUS_META } from '@/lib/types';
import { Printer, CircleDollarSign, TrendingUp, Users, FileText } from 'lucide-react';

export const metadata = { title: 'Reports — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringReportsPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  await requirePermission('catering.reports');
  const sp = await searchParams;
  const def = await getDefaultPeriod();
  const year = Number(sp.y) || def.year;
  const month = Number(sp.m) || def.month;
  const { from, to } = monthRange(year, month);

  const [summary, trend, mix, delivered] = await Promise.all([
    getCateringSummary(from, to),
    getCateringTrend(year, month, 12),
    getCateringDishMix(from, to, 20),
    getCateringQuotations({ from, to, status: 'ALL', limit: 200 }),
  ]);

  const billable = delivered.filter((q) => q.status === 'CONFIRMED' || q.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub={`Everything delivered in ${monthLabelFull(year, month)}. Separate from the ballroom books.`}
        right={(
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/print/catering-report?year=${year}&month=${month}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm hover:bg-[rgb(var(--gold)/0.1)]"
            >
              <Printer className="h-4 w-4" /> Print report
            </Link>
            <PeriodPicker year={year} month={month} />
          </div>
        )}
      >
        Reports
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={summary.revenue} icon={<CircleDollarSign className="h-5 w-5" />} delay={0} sub={`${summary.confirmed} orders`} />
        <StatTile label="Received" value={summary.received} tone="green" icon={<TrendingUp className="h-5 w-5" />} delay={0.05} />
        <StatTile label="Outstanding" value={summary.outstanding} tone={summary.outstanding > 0 ? 'red' : 'green'} icon={<FileText className="h-5 w-5" />} delay={0.1} />
        <StatTile label="Persons" value={summary.persons} format="int" tone="plain" icon={<Users className="h-5 w-5" />} delay={0.15} sub={`${fmtMoney(summary.avgPerOrder)} average`} />
      </div>

      <Card className="p-5">
        <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Revenue vs received — last 12 months</div>
        {trend.some((t) => t.revenue > 0) ? (
          <RevenueTrend data={trend.map((t) => ({ label: t.label, sale: t.revenue, expenses: t.received }))} />
        ) : (
          <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No catering history yet" />
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Dish revenue</div>
        {mix.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Nothing confirmed this month" />
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Dish</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 text-right font-medium">Orders</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mix.map((m) => (
                  <tr key={`${m.description}-${m.category}`} className="border-b border-[rgb(var(--border)/0.3)] last:border-0">
                    <td className="py-2.5 pr-3 text-[rgb(var(--text))]">{m.description}</td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-dim))]">{m.category || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{m.orders}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{m.qty.toLocaleString()}</td>
                    <td className="py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(m.revenue, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Orders delivered</div>
        {billable.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Nothing delivered this month" />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Quota no</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 text-right font-medium">Received</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {billable.map((q) => (
                  <tr key={q.id} className="border-b border-[rgb(var(--border)/0.3)] last:border-0">
                    <td className="py-2.5 pr-3"><Link href={`/catering/quotations/${q.id}`} className="tnum text-gold hover:underline">{q.quotaNo}</Link></td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text))]">{q.customerName || '—'}</td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-muted))]">{q.deliveryDate ? fmtDate(q.deliveryDate) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text))]">{fmtMoney(q.grandTotal, false)}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-positive">{fmtMoney(q.paidAmount, false)}</td>
                    <td className="py-2.5"><Badge tone={CATERING_STATUS_META[q.status].tone}>{CATERING_STATUS_META[q.status].label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
