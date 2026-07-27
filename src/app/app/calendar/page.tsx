import { requirePermission } from '@/lib/session';
import { getDefaultPeriod, getCalendarBookings } from '@/lib/data';
import { resolvePeriod, fmtDate, monthLabelFull, monthRange } from '@/lib/format';
import { Card, FadeUp, Badge } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import Link from 'next/link';

export const metadata = { title: 'Calendar — Royal Gold Banquet' };
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('bookings.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());
  const bookings = await getCalendarBookings(year, month);
  const { days } = monthRange(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const byDay: Record<number, any[]> = {};
  for (const b of bookings) {
    const d = Number(String(b.event_date).slice(8, 10));
    (byDay[d] ??= []).push(b);
  }

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
      <FadeUp className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">Calendar</h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">{monthLabelFull(year, month)} · {bookings.length} events</p>
        </div>
        <PeriodPicker year={year} month={month} />
      </FadeUp>

      <FadeUp delay={0.05}>
        <Card className="p-3 md:p-5">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {WD.map((d) => <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-[rgb(var(--text-dim))]">{d}</div>)}
            {cells.map((day, i) => (
              <div key={i} className={`min-h-[84px] rounded-xl border p-1.5 md:min-h-[110px] ${day ? 'border-[rgb(var(--border)/0.4)]' : 'border-transparent'}`}>
                {day && (
                  <>
                    <div className="mb-1 text-right text-xs text-[rgb(var(--text-dim))]">{day}</div>
                    <div className="space-y-1">
                      {(byDay[day] ?? []).map((b: any) => (
                        <Link key={b.id} href={`/app/bookings/${b.id}`} className={`block truncate rounded-md px-1.5 py-1 text-[10px] md:text-xs ${b.shift === 'DINNER' ? 'bg-[rgb(var(--gold)/0.16)] text-gold' : 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text-muted))]'}`}>
                          <span className="font-medium">{b.shift === 'DINNER' ? '🌙' : '☀'} {b.party_name}</span>
                          <span className="hidden md:inline text-[rgb(var(--text-dim))]"> · {b.hall}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-[rgb(var(--text-dim))]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-[rgb(var(--gold)/0.5)]" /> Dinner</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-[rgb(var(--surface-2))]" /> Lunch</span>
          </div>
        </Card>
      </FadeUp>
    </div>
  );
}
