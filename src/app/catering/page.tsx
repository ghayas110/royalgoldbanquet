import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import {
  getCateringSummary, getCateringTrend, getCateringUpcoming,
  getCateringOutstanding, getCateringDishMix, getCateringProfile,
} from '@/lib/catering';
import { getDefaultPeriod } from '@/lib/data';
import { monthRange, monthLabelFull, fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Badge, EmptyState, TableScroll, Button } from '@/components/ui';
import { StatTile } from '@/components/stat-tile';
import { PeriodPicker } from '@/components/period-picker';
import { RevenueTrend } from '@/components/charts';
import { CATERING_STATUS_META } from '@/lib/types';
import { Plus, FileText, Users, CircleDollarSign, TrendingUp, CalendarClock, ChefHat } from 'lucide-react';

export const metadata = { title: 'Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringDashboard({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  await requirePermission('catering.view');
  const sp = await searchParams;
  const def = await getDefaultPeriod();
  const year = Number(sp.y) || def.year;
  const month = Number(sp.m) || def.month;
  const { from, to } = monthRange(year, month);

  const [profile, summary, trend, upcoming, outstanding, mix] = await Promise.all([
    getCateringProfile(),
    getCateringSummary(from, to),
    getCateringTrend(year, month, 6),
    getCateringUpcoming(6),
    getCateringOutstanding(6),
    getCateringDishMix(from, to, 8),
  ]);

  const topRevenue = mix[0]?.revenue ?? 0;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow={profile.name}
        sub={`Catering business for ${monthLabelFull(year, month)}, by event date.`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker year={year} month={month} />
            <Link href="/catering/quotations/new"><Button><Plus className="mr-1.5 h-4 w-4" /> New quotation</Button></Link>
          </div>
        }
      >
        Dashboard
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Confirmed revenue" value={summary.revenue} icon={<CircleDollarSign className="h-5 w-5" />} delay={0} sub={`${summary.confirmed} confirmed`} />
        <StatTile label="Received" value={summary.received} tone="green" icon={<TrendingUp className="h-5 w-5" />} delay={0.05} sub={`${fmtMoney(summary.outstanding)} outstanding`} />
        <StatTile label="Pipeline" value={summary.pipeline} tone="plain" icon={<FileText className="h-5 w-5" />} delay={0.1} sub={`${summary.pipelineCount} open quotations`} />
        <StatTile label="Persons catered" value={summary.persons} format="int" tone="plain" icon={<Users className="h-5 w-5" />} delay={0.15} sub={`${fmtMoney(summary.avgPerOrder)} average order`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Revenue vs received — last 6 months</div>
          {trend.some((t) => t.revenue > 0) ? (
            <RevenueTrend data={trend.map((t) => ({ label: t.label, sale: t.revenue, expenses: t.received }))} />
          ) : (
            <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No catering history yet" sub="Confirmed quotations will chart here." />
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Upcoming deliveries</div>
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nothing scheduled" />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border)/0.4)] pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/catering/quotations/${q.id}`} className="truncate text-sm font-medium text-[rgb(var(--text))] hover:text-gold">
                      {q.customerName || q.quotaNo}
                    </Link>
                    <div className="text-xs text-[rgb(var(--text-dim))]">
                      {q.deliveryDate ? fmtDate(q.deliveryDate) : '—'} · {q.persons || '—'} persons
                    </div>
                  </div>
                  <Badge tone={CATERING_STATUS_META[q.status].tone}>{fmtMoney(q.grandTotal, false)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Top dishes</div>
          {mix.length === 0 ? (
            <EmptyState icon={<ChefHat className="h-6 w-6" />} title="No confirmed dishes this month" />
          ) : (
            <TableScroll>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                    <th className="py-2 pr-3 font-medium">Dish</th>
                    <th className="py-2 pr-3 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {mix.map((m) => (
                    <tr key={`${m.description}-${m.category}`} className="border-b border-[rgb(var(--border)/0.3)] last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="text-[rgb(var(--text))]">{m.description}</div>
                        <div className="mt-1 h-1 w-full max-w-[150px] overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                          <div className="h-full rounded-full bg-[rgb(var(--gold)/0.7)]" style={{ width: `${topRevenue > 0 ? (m.revenue / topRevenue) * 100 : 0}%` }} />
                        </div>
                      </td>
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
          <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Outstanding</div>
          {outstanding.length === 0 ? (
            <EmptyState icon={<CircleDollarSign className="h-6 w-6" />} title="Everything is settled" />
          ) : (
            <ul className="space-y-3">
              {outstanding.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border)/0.4)] pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/catering/quotations/${q.id}`} className="truncate text-sm font-medium text-[rgb(var(--text))] hover:text-gold">
                      {q.customerName || '—'} <span className="text-xs text-[rgb(var(--text-dim))]">{q.quotaNo}</span>
                    </Link>
                    <div className="text-xs text-[rgb(var(--text-dim))]">{fmtMoney(q.paidAmount)} of {fmtMoney(q.grandTotal)} received</div>
                  </div>
                  <span className="tnum shrink-0 text-sm text-negative">{fmtMoney(q.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
