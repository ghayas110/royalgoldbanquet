'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Card, Badge, FadeUp, EmptyState, TableScroll } from '@/components/ui';
import { fmtMoney, fmtDate } from '@/lib/format';
import { searchBookings, type BookingListRow } from '@/lib/actions/bookings';
import { BookMarked, ArrowUpRight, Search, X, Loader2, CalendarRange } from 'lucide-react';
import { DateInput } from '@/components/date-input';

type Kind = 'ALL' | 'BOOKINGS' | 'ENQUIRIES' | 'RETURNED' | 'CANCELLED';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Event-date shortcuts. Each returns [from, to]; '' means that end is open,
 * so "Upcoming" is genuinely everything from today onwards rather than an
 * arbitrary window.
 */
const DATE_PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: 'upcoming', label: 'Upcoming', range: () => [iso(new Date()), ''] },
  { key: 'past', label: 'Past', range: () => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return ['', iso(d)];
    } },
  { key: 'thisMonth', label: 'This month', range: () => {
      const n = new Date();
      return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0))];
    } },
  { key: 'nextMonth', label: 'Next month', range: () => {
      const n = new Date();
      return [iso(new Date(n.getFullYear(), n.getMonth() + 1, 1)), iso(new Date(n.getFullYear(), n.getMonth() + 2, 0))];
    } },
  { key: 'thisYear', label: 'This year', range: () => {
      const y = new Date().getFullYear();
      return [`${y}-01-01`, `${y}-12-31`];
    } },
];

const statusTone: Record<string, 'gold' | 'green' | 'amber' | 'muted' | 'red'> = {
  ENQUIRY: 'amber', CONFIRMED: 'gold', COMPLETED: 'green', CANCELLED: 'red', RETURNED: 'muted',
};
const payTone: Record<string, 'green' | 'amber' | 'muted'> = { SETTLED: 'green', PARTIAL: 'amber', PENDING: 'muted' };

export function BookingsClient({
  initialRows, counts,
}: {
  initialRows: BookingListRow[];
  counts: { bookings: number; enquiries: number; upcoming: number; due: number; returned: number; returnedAmount: number; cancelled: number };
}) {
  const [kind, setKind] = useState<Kind>('ALL');
  const [term, setTerm] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Panel starts closed so the page looks unchanged until the filter is wanted.
  const [showDates, setShowDates] = useState(false);
  const [rows, setRows] = useState<BookingListRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [openDrop, setOpenDrop] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Guards against an earlier, slower request overwriting a newer one.
  const reqId = useRef(0);

  // Debounced search — waits 300ms after typing stops before hitting the server.
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchBookings({ q: term, kind, from, to });
        if (id === reqId.current) setRows(res);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, term ? 300 : 0);
    return () => clearTimeout(t);
  }, [term, kind, from, to]);

  // Close the suggestions dropdown on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenDrop(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const suggestions = useMemo(() => (term.trim() ? rows.slice(0, 6) : []), [rows, term]);

  const dateActive = Boolean(from || to);
  /** Which preset, if any, exactly matches the current range — for highlighting. */
  const activePreset = DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  })?.key;

  const clearDates = () => { setFrom(''); setTo(''); };

  // Compact form for the filter bar chip.
  const dateSummary = !dateActive
    ? 'Any date'
    : from && to ? `${fmtDate(from)} → ${fmtDate(to)}`
    : from ? `From ${fmtDate(from)}`
    : `Up to ${fmtDate(to)}`;

  // Sentence form for the empty state. Kept separate from `dateSummary`
  // because lower-casing that one to fit mid-sentence also mangles the month
  // ("01-jan-28").
  const dateSentence = from && to
    ? `between ${fmtDate(from)} and ${fmtDate(to)}`
    : from ? `on or after ${fmtDate(from)}`
    : `on or before ${fmtDate(to)}`;

  const tabs: { key: Kind; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.bookings + counts.enquiries + counts.returned + counts.cancelled },
    { key: 'BOOKINGS', label: 'Bookings', count: counts.bookings },
    { key: 'ENQUIRIES', label: 'Enquiries', count: counts.enquiries },
    { key: 'RETURNED', label: 'Returned', count: counts.returned },
    { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
  ];

  return (
    <div className="space-y-5">
      {/* Tickers */}
      <FadeUp className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ticker label="Total Bookings" value={counts.bookings} tone="gold" />
        <Ticker label="Total Enquiries" value={counts.enquiries} tone="amber" />
        <Ticker label="Returned Amount" value={counts.returnedAmount} money sub={`${counts.returned} returned`} />
        <Ticker label="With Balance Due" value={counts.due} tone={counts.due > 0 ? 'red' : 'green'} />
      </FadeUp>

      {/* Search + filter */}
      <FadeUp delay={0.04} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={boxRef} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-dim))]" />
          <input
            value={term}
            onChange={(e) => { setTerm(e.target.value); setOpenDrop(true); }}
            onFocus={() => setOpenDrop(true)}
            placeholder="Search slip #, party, phone or hall…"
            aria-label="Search bookings and enquiries"
            className="w-full rounded-xl border border-[rgb(var(--border)/0.7)] bg-[rgb(var(--surface-2))] py-2.5 pl-9 pr-16 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--gold)/0.6)]"
          />
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[rgb(var(--text-dim))]" />}
            {term && (
              <button onClick={() => { setTerm(''); setOpenDrop(false); }} aria-label="Clear search"
                className="rounded p-1 text-[rgb(var(--text-dim))] hover:text-[rgb(var(--text))]">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {openDrop && term.trim() && (
            <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lift">
              {suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[rgb(var(--text-dim))]">No matches for “{term}”.</div>
              ) : (
                suggestions.map((s) => (
                  <Link key={s.id} href={`/app/bookings/${s.id}`} onClick={() => setOpenDrop(false)}
                    className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border)/0.3)] px-4 py-2.5 last:border-0 hover:bg-[rgb(var(--surface-2))]">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-[rgb(var(--text))]">{s.party_name}</div>
                      <div className="truncate font-mono text-[11px] text-gold">{s.slip_no} · {fmtDate(s.event_date)}</div>
                    </div>
                    <Badge tone={statusTone[s.status]}>{s.status}</Badge>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex rounded-xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2)/0.5)] p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setKind(t.key)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                kind === t.key ? 'bg-gold text-ink' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'
              }`}>
              {t.label} <span className="opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
      </FadeUp>

      {/* Event date filter */}
      <FadeUp delay={0.06}>
        <div className="rounded-xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2)/0.4)]">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <button
              onClick={() => setShowDates((v) => !v)}
              aria-expanded={showDates}
              className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
                dateActive ? 'text-gold' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'
              }`}
            >
              <CalendarRange className="h-4 w-4" />
              Event date
              <span className={`text-xs ${dateActive ? 'text-gold' : 'text-[rgb(var(--text-dim))]'}`}>· {dateSummary}</span>
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-1">
              {DATE_PRESETS.map((p) => {
                const on = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      // Tapping the active preset again clears it.
                      if (on) { clearDates(); return; }
                      const [f, t] = p.range();
                      setFrom(f); setTo(t);
                    }}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      on ? 'bg-gold text-ink' : 'text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              {dateActive && (
                <button
                  onClick={clearDates}
                  aria-label="Clear event date filter"
                  className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:text-negative"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {showDates && (
            <div className="flex flex-col gap-3 border-t border-[rgb(var(--border)/0.5)] px-3 py-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">From</span>
                <DateInput value={from} onChange={setFrom} showDay={false} />
              </label>
              <label className="flex-1">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">To</span>
                <DateInput value={to} onChange={setTo} showDay={false} />
              </label>
              <p className="text-xs text-[rgb(var(--text-dim))] sm:max-w-[13rem] sm:pb-2.5">
                Leave either side blank for an open-ended range.
              </p>
            </div>
          )}
        </div>
      </FadeUp>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookMarked className="h-8 w-8" />}
            title={term || dateActive ? 'No matches' : kind === 'ENQUIRIES' ? 'No enquiries yet' : 'No bookings yet'}
            sub={
              term
                ? `Nothing matched “${term}”${dateActive ? ` with an event date ${dateSentence}` : ''}. Try a different slip #, name or phone.`
                : dateActive
                  ? `No bookings with an event date ${dateSentence}.`
                  : 'Create one to get started.'
            }
          />
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((b) => (
              <Link key={b.id} href={`/app/bookings/${b.id}`} className="block">
                <Card className="p-4 active:bg-[rgb(var(--surface-2)/0.5)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gold">{b.slip_no}</div>
                      <div className="mt-0.5 truncate font-medium text-[rgb(var(--text))]">{b.party_name}</div>
                    </div>
                    <Badge tone={statusTone[b.status]}>{b.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
                    <span>{fmtDate(b.event_date)}</span>
                    <span>{b.hall} · {b.shift}</span>
                    <span>{b.guest_count} guests</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-[rgb(var(--border)/0.4)] pt-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Total</div>
                      <div className="tnum text-sm text-[rgb(var(--text))]">{fmtMoney(b.total_amount, false)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Balance due</div>
                      <div className="tnum text-sm">
                        {b.balance_due > 0 ? <span className="text-negative">{fmtMoney(b.balance_due, false)}</span> : <span className="text-positive">Paid</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <TableScroll>
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                    <th className="px-4 py-3 font-medium">Slip #</th>
                    <th className="px-4 py-3 font-medium">Party</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Hall / Shift</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Balance Due</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b border-[rgb(var(--border)/0.25)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                      <td className="px-4 py-3 font-mono text-xs text-gold">{b.slip_no}</td>
                      <td className="px-4 py-3">
                        <div className="text-[rgb(var(--text))]">{b.party_name}</div>
                        <div className="text-xs text-[rgb(var(--text-dim))]">{b.guest_count} guests</div>
                      </td>
                      <td className="px-4 py-3 text-[rgb(var(--text-muted))]">{fmtDate(b.event_date)}</td>
                      <td className="px-4 py-3 text-[rgb(var(--text-muted))]">{b.hall}<span className="text-[rgb(var(--text-dim))]"> · {b.shift}</span></td>
                      <td className="px-4 py-3 text-right tnum text-[rgb(var(--text))]">{fmtMoney(b.total_amount, false)}</td>
                      <td className="px-4 py-3 text-right tnum">
                        {b.balance_due > 0 ? <span className="text-negative">{fmtMoney(b.balance_due, false)}</span> : <span className="text-positive">Paid</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge tone={statusTone[b.status]}>{b.status}</Badge>
                          <Badge tone={payTone[b.payment_status]}>{b.payment_status}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/app/bookings/${b.id}`} className="inline-flex rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold">
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </>
      )}
    </div>
  );
}

function Ticker({ label, value, tone = 'plain', money, sub }: { label: string; value: number; tone?: 'plain' | 'gold' | 'amber' | 'green' | 'red'; money?: boolean; sub?: string }) {
  const c = {
    plain: 'text-[rgb(var(--text))]', gold: 'text-gold', amber: 'text-amber-400',
    green: 'text-positive', red: 'text-negative',
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
      <div className={`mt-1 font-display text-2xl tnum ${c}`}>{money ? fmtMoney(value, false) : value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[rgb(var(--text-dim))]">{sub}</div>}
    </Card>
  );
}
