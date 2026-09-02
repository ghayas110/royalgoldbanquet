import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import {
  getLiveCookingSummary, getLiveCookingLines, getLiveCookingTrend, getServiceMix,
} from '@/lib/live-cooking';
import { getDefaultPeriod } from '@/lib/data';
import { monthRange, monthLabelFull, fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Badge, EmptyState, TableScroll } from '@/components/ui';
import { StatTile } from '@/components/stat-tile';
import { PeriodPicker } from '@/components/period-picker';
import { RevenueTrend } from '@/components/charts';
import { LIVE_COOKING_SERVICE } from '@/lib/service-presets';
import {
  ChefHat, CircleDollarSign, Users, ShieldAlert, Percent, BookMarked, Utensils,
} from 'lucide-react';

export const metadata = { title: 'Live Cooking — Skylight Ballroom & Catering' };
export const dynamic = 'force-dynamic';

/**
 * The Live Cooking service, reported on its own.
 *
 * The service itself is billed as a normal banquet line, so this money is
 * already counted in the booking total and on the Income Statement — nothing
 * here is a second set of books. What is restricted is the BREAKDOWN: only a
 * Super Admin holds `livecooking.view`, so only a Super Admin can see what
 * this one service earns and which bookings bought it.
 */
export default async function LiveCookingPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const user = await requirePermission('livecooking.view');
  const sp = await searchParams;
  const def = await getDefaultPeriod();
  const year = Number(sp.y) || def.year;
  const month = Number(sp.m) || def.month;
  const { from, to } = monthRange(year, month);

  const [summary, lines, trend, mix] = await Promise.all([
    getLiveCookingSummary(from, to),
    getLiveCookingLines(from, to),
    getLiveCookingTrend(year, month, 6),
    getServiceMix(from, to),
  ]);

  const topRevenue = mix[0]?.revenue ?? 0;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Super Admin only"
        sub={`What the ${LIVE_COOKING_SERVICE} service earned in ${monthLabelFull(year, month)}.`}
        right={<PeriodPicker year={year} month={month} />}
      >
        Live Cooking
      </SectionTitle>

      <Card className="flex items-start gap-3 border-[rgb(var(--gold)/0.35)] bg-[rgb(var(--gold)/0.06)] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <p className="text-sm text-[rgb(var(--text-muted))]">
          <strong className="text-[rgb(var(--text))]">{LIVE_COOKING_SERVICE}</strong> is booked like any other
          banquet service, so this money is already inside the booking totals and the Income Statement.
          This page is the separate breakdown of that one service, and only a Super Admin can open it.
          Signed in as <strong className="text-gold">{user.name ?? user.email}</strong>.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live Cooking revenue" value={summary.revenue} icon={<CircleDollarSign className="h-5 w-5" />} delay={0} sub={`${summary.sharePct}% of all service revenue`} />
        <StatTile label="Bookings with it" value={summary.bookings} format="int" tone="plain" icon={<BookMarked className="h-5 w-5" />} delay={0.05} sub={`of ${monthLabelFull(year, month)}`} />
        <StatTile label="Average per booking" value={summary.avgPerBooking} tone="green" icon={<Utensils className="h-5 w-5" />} delay={0.1} sub={`${summary.qty.toLocaleString()} units sold`} />
        <StatTile label="Guests catered" value={summary.guests} format="int" tone="plain" icon={<Users className="h-5 w-5" />} delay={0.15} sub="Across those bookings" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Live Cooking vs all services — last 6 months</div>
          {trend.some((t) => t.revenue > 0 || t.allServices > 0) ? (
            <RevenueTrend data={trend.map((t) => ({ label: t.label, sale: t.revenue, expenses: t.allServices }))} />
          ) : (
            <EmptyState icon={<ChefHat className="h-6 w-6" />} title="No history yet" sub="Bookings that include Live Cooking will chart here." />
          )}
          <p className="mt-3 text-xs text-[rgb(var(--text-dim))]">
            Gold is Live Cooking; the second line is total banquet-service revenue for the same month.
          </p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-1 font-display text-lg text-[rgb(var(--text))]">Share of service revenue</div>
          <div className="mb-4 text-xs text-[rgb(var(--text-dim))]">{monthLabelFull(year, month)}</div>
          <div className="flex items-baseline gap-1 font-display text-4xl text-gold">
            {summary.sharePct}<Percent className="h-6 w-6" />
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
            <div className="h-full rounded-full bg-[rgb(var(--gold)/0.8)]" style={{ width: `${Math.min(100, summary.sharePct)}%` }} />
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Live Cooking</span><span className="tnum text-gold">{fmtMoney(summary.revenue)}</span></div>
            <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">All services</span><span className="tnum text-[rgb(var(--text-muted))]">{fmtMoney(summary.allServicesRevenue)}</span></div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">Bookings that took Live Cooking</div>
        {lines.length === 0 ? (
          <EmptyState
            icon={<ChefHat className="h-6 w-6" />}
            title="No Live Cooking sold this month"
            sub={`Add "${LIVE_COOKING_SERVICE}" to a booking's services and it will appear here.`}
          />
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Slip</th>
                  <th className="py-2 pr-3 font-medium">Party</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 pr-3 text-right font-medium">Rate</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-[rgb(var(--border)/0.3)] last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link href={`/app/bookings/${l.bookingId}`} className="tnum text-gold hover:underline">{l.slipNo}</Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="text-[rgb(var(--text))]">{l.partyName}</div>
                      <div className="text-xs text-[rgb(var(--text-dim))]">{l.hall} · {l.guestCount || '—'} guests</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="text-[rgb(var(--text-muted))]">{fmtDate(l.eventDate)}</div>
                      <div className="text-xs text-[rgb(var(--text-dim))]">{l.shift.toLowerCase()}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{l.qty.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-dim))]">{fmtMoney(l.rate)}</td>
                    <td className="py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 font-display text-lg text-[rgb(var(--text))]">How it compares with the other services</div>
        {mix.length === 0 ? (
          <EmptyState icon={<Utensils className="h-6 w-6" />} title="No services billed this month" />
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Service</th>
                  <th className="py-2 pr-3 text-right font-medium">Bookings</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mix.map((m) => (
                  <tr
                    key={`${m.label}-${m.kind}`}
                    className={`border-b border-[rgb(var(--border)/0.3)] last:border-0 ${m.kind === 'LIVE_COOKING' ? 'bg-[rgb(var(--gold)/0.06)]' : ''}`}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[rgb(var(--text))]">{m.label}</span>
                        {/* Says why the row is highlighted. It used to repeat the
                            service name, which stuttered once the service itself
                            was renamed to plain "Live Cooking". */}
                        {m.kind === 'LIVE_COOKING' && <Badge tone="gold">Tracked separately</Badge>}
                      </div>
                      <div className="mt-1 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                        <div
                          className={`h-full rounded-full ${m.kind === 'LIVE_COOKING' ? 'bg-gold' : 'bg-[rgb(var(--gold)/0.35)]'}`}
                          style={{ width: `${topRevenue > 0 ? (m.revenue / topRevenue) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{m.bookings}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-dim))]">{m.qty.toLocaleString()}</td>
                    <td className="py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(m.revenue)}</td>
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
