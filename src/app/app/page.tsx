import { requireUser, can } from '@/lib/session';
import {
  getDefaultPeriod, getMonthlyFinancials, getTrend, getUpcomingEvents, getOutstandingBalances,
} from '@/lib/data';
import { buildMonthlySale } from '@/lib/accounting';
import { fmtMoney, fmtDate, monthLabelFull } from '@/lib/format';
import { Card, SectionTitle, Badge, FadeUp } from '@/components/ui';
import { StatTile } from '@/components/stat-tile';
import { RevenueTrend, ExpenseDonut, BookingsBar, DonutLegend } from '@/components/charts';
import { CalendarDays, TrendingUp, Wallet, HandCoins, Receipt, PiggyBank } from 'lucide-react';
import Link from 'next/link';

export default async function Dashboard() {
  const user = await requireUser();
  const showProfit = can(user.permissions, 'profit.view');
  const { year, month } = await getDefaultPeriod();

  const fin = await getMonthlyFinancials(year, month);
  const ms = buildMonthlySale({
    settled: fin.settled, newBookings: fin.newBookings,
    expenseLines: fin.expenseLines, disbursements: fin.disbursements,
    attribution: fin.attribution,
  });
  const [trend, upcoming, outstanding] = await Promise.all([
    getTrend(year, month, 6), getUpcomingEvents(6), getOutstandingBalances(8),
  ]);

  const floatOutstanding = fin.disbursements.reduce(
    (s, d) => s + (d.amount_disbursed - d.expenses_recorded - d.amount_returned), 0);
  const totalExpenses = ms.pnl.expenses;
  const donutData = fin.expenseLines.filter((l) => l.total > 0).map((l) => ({ name: l.name, value: l.total }));

  return (
    <div className="space-y-6">
      <FadeUp className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">
            Good day, <span className="text-gold-gradient">{user.name?.split(' ')[0]}</span>
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">
            {user.role === 'MANAGER' ? 'Operations overview' : 'Owner overview'} · {monthLabelFull(year, month)}
          </p>
        </div>
        <Badge tone="gold">{monthLabelFull(year, month)}</Badge>
      </FadeUp>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Sale" value={ms.pnl.totalSale} icon={<Receipt className="h-5 w-5" />} delay={0.02} sub={`${ms.saleRows.length} settled events`} />
        <StatTile label="Advance Booking" value={ms.newBookingTotal} icon={<CalendarDays className="h-5 w-5" />} tone="plain" delay={0.06} sub={`${ms.newBookingRows.length} new bookings`} />
        <StatTile label="Total Expenses" value={totalExpenses} icon={<Wallet className="h-5 w-5" />} tone="red" delay={0.1} sub="From petty cash" />
        {showProfit ? (
          <StatTile label="Net Profit" value={ms.pnl.totalNetProfit} icon={<TrendingUp className="h-5 w-5" />} tone="green" delay={0.14} sub="Incl. Naseem return" />
        ) : (
          <StatTile label="Bookings" value={fin.settled.length + fin.newBookings.length} format="int" icon={<CalendarDays className="h-5 w-5" />} tone="plain" delay={0.14} sub="This month" />
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeUp delay={0.1} className="lg:col-span-2">
          <Card className="p-5 h-full">
            <SectionTitle sub="Settled sale vs recorded expenses">Revenue Trend</SectionTitle>
            <RevenueTrend data={trend} />
          </Card>
        </FadeUp>
        <FadeUp delay={0.16}>
          <Card className="p-5 h-full">
            <SectionTitle sub="This month by head">Expense Breakdown</SectionTitle>
            <ExpenseDonut data={donutData} />
            <div className="mt-3"><DonutLegend data={donutData} /></div>
          </Card>
        </FadeUp>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeUp delay={0.12}>
          <Card className="p-5 h-full">
            <SectionTitle sub="Events per month">Bookings</SectionTitle>
            <BookingsBar data={trend.map((t) => ({ label: t.label, count: t.count }))} />
          </Card>
        </FadeUp>

        {/* Upcoming events */}
        <FadeUp delay={0.16}>
          <Card className="p-5 h-full">
            <SectionTitle sub="Next events" right={<Link href="/app/calendar" className="text-xs text-gold hover:underline">Calendar</Link>}>Upcoming</SectionTitle>
            <ul className="space-y-2.5">
              {upcoming.length === 0 && <li className="text-sm text-[rgb(var(--text-dim))]">No upcoming events.</li>}
              {upcoming.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-2 border-b border-[rgb(var(--border)/0.3)] pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[rgb(var(--text))]">{e.party_name}</div>
                    <div className="text-xs text-[rgb(var(--text-dim))]">{fmtDate(e.event_date)} · {e.shift} · {e.hall}</div>
                  </div>
                  <Badge tone={e.payment_status === 'SETTLED' ? 'green' : e.payment_status === 'PARTIAL' ? 'amber' : 'muted'}>{e.payment_status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </FadeUp>

        {/* Outstanding balances + float */}
        <FadeUp delay={0.2}>
          <Card className="p-5 h-full">
            <SectionTitle sub="Balance due">Outstanding</SectionTitle>
            {showProfit && (
              <div className="mb-3 flex items-center justify-between rounded-xl bg-[rgb(var(--gold)/0.1)] px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-gold"><HandCoins className="h-4 w-4" /> Float with Naseem</span>
                <span className="tnum font-semibold text-gold">{fmtMoney(floatOutstanding)}</span>
              </div>
            )}
            <ul className="space-y-2">
              {outstanding.length === 0 && <li className="text-sm text-[rgb(var(--text-dim))]">All settled 🎉</li>}
              {outstanding.slice(0, 6).map((o: any) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-[rgb(var(--text-muted))]">{o.party_name}</span>
                  <span className="tnum text-negative">{fmtMoney(o.balance_due)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </FadeUp>
      </div>
    </div>
  );
}
