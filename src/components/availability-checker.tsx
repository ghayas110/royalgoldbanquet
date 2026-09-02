'use client';

import { useState, useTransition } from 'react';
import { Card, Button } from '@/components/ui';
import { MONTHS, monthRange, parseDate } from '@/lib/format';
import { fetchPublicAvailability } from '@/lib/actions/misc';
import { Calendar, ChevronLeft, ChevronRight, Clock, Building2, ArrowRight } from 'lucide-react';

type HallProp = { id: number; name: string; capacity: number; base_charge: number; description: string };
type BookingItem = { date: string; shift: string; hallId: number; hallName: string };

export function AvailabilityChecker({
  initialYear,
  initialMonth,
  initialBookings,
  halls,
}: {
  initialYear: number;
  initialMonth: number;
  initialBookings: BookingItem[];
  halls: HallProp[];
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [bookings, setBookings] = useState<BookingItem[]>(initialBookings);
  const [selectedHallId, setSelectedHallId] = useState<number | 'ALL'>('ALL');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const daysInMonth = monthRange(year, month).days;

  function loadPeriod(y: number, m: number) {
    if (m < 1) { y -= 1; m = 12; }
    if (m > 12) { y += 1; m = 1; }
    setYear(y);
    setMonth(m);
    setSelectedDay(null);

    start(async () => {
      const data = await fetchPublicAvailability(y, m);
      setBookings(data.bookings);
    });
  }

  // Filter bookings by selected hall
  const filteredBookings = selectedHallId === 'ALL'
    ? bookings
    : bookings.filter((b) => Number(b.hallId) === Number(selectedHallId));

  // Key format: YYYY-MM-DD|SHIFT|HALL_ID
  const bookedSet = new Set(
    filteredBookings.map((b) => {
      const dayNum = Number(String(b.date).slice(8, 10));
      return `${dayNum}|${b.shift}|${b.hallId}`;
    })
  );

  // Helper to check if a specific day/shift/hall is booked
  function isSlotBooked(day: number, shift: string, hallId?: number) {
    if (hallId) return bookedSet.has(`${day}|${shift}|${hallId}`);
    if (selectedHallId !== 'ALL') return bookedSet.has(`${day}|${shift}|${selectedHallId}`);
    // For 'ALL' halls, count how many active halls are booked
    const bookedCount = halls.filter((h) => bookedSet.has(`${day}|${shift}|${h.id}`)).length;
    return bookedCount >= (halls.length || 1);
  }

  const selectedDateStr = selectedDay
    ? `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : '';

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayWeekday = new Date(year, month - 1, 1).getDay();

  return (
    <Card className="p-6 overflow-hidden">
      {/* Header controls: Month navigation & Hall filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgb(var(--border)/0.5)] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--gold)/0.14)] text-gold">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-xl text-[rgb(var(--text))]">
              {MONTHS[month - 1]} {year}
            </h3>
            <p className="text-xs text-[rgb(var(--text-dim))]">Select a date to view live hall availability</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hall selector tabs */}
          <div className="flex items-center rounded-lg border border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface-2)/0.4)] p-1 text-xs">
            <button
              onClick={() => setSelectedHallId('ALL')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${selectedHallId === 'ALL' ? 'bg-gold text-ink font-semibold' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'}`}
            >
              All Halls
            </button>
            {halls.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHallId(h.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${selectedHallId === h.id ? 'bg-gold text-ink font-semibold' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'}`}
              >
                {h.name}
              </button>
            ))}
          </div>

          {/* Month Steppers */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="p-2 h-9 w-9" onClick={() => loadPeriod(year, month - 1)} disabled={pending}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="p-2 h-9 w-9" onClick={() => loadPeriod(year, month + 1)} disabled={pending}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Legend */}
      <div className="flex flex-wrap items-center gap-4 py-3 text-xs text-[rgb(var(--text-muted))]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 1 Shift Open</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Reserved</span>
      </div>

      {/* Calendar Grid */}
      <div className="mt-2">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[rgb(var(--text-dim))] pb-2 border-b border-[rgb(var(--border)/0.3)]">
          {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1.5 pt-2">
          {/* Empty leading padding days */}
          {Array.from({ length: firstDayWeekday }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square rounded-lg bg-transparent" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const isSelected = selectedDay === d;
            const lunchBooked = isSlotBooked(d, 'LUNCH');
            const dinnerBooked = isSlotBooked(d, 'DINNER');
            const fullyBooked = lunchBooked && dinnerBooked;
            const partiallyBooked = (lunchBooked || dinnerBooked) && !fullyBooked;

            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border p-1 text-xs transition-all ${
                  isSelected
                    ? 'border-gold ring-2 ring-gold/40 bg-[rgb(var(--gold)/0.15)] font-bold text-gold'
                    : fullyBooked
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : partiallyBooked
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : 'border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2)/0.2)] text-[rgb(var(--text))] hover:border-[rgb(var(--gold)/0.5)] hover:bg-[rgb(var(--surface-2)/0.5)]'
                }`}
              >
                <span className="text-sm font-semibold">{d}</span>
                <span className="mt-0.5 text-[9px] uppercase font-mono">
                  {fullyBooked ? 'Booked' : partiallyBooked ? (lunchBooked ? 'Eve' : 'Day') : 'Open'}
                </span>
                <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${fullyBooked ? 'bg-rose-500' : partiallyBooked ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Availability Detail Breakdown */}
      {selectedDay && (
        <div className="mt-6 border-t border-[rgb(var(--border)/0.5)] pt-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gold font-semibold">Selected Date Status</div>
              <h4 className="font-display text-lg text-[rgb(var(--text))]">
                {parseDate(selectedDateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h4>
            </div>
            <a
              href={`#enquire`}
              onClick={() => {
                const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
                if (dateInput) dateInput.value = selectedDateStr;
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink hover:bg-gold-light transition-colors"
            >
              Book Date <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {halls.map((h) => {
              const lunch = bookedSet.has(`${selectedDay}|LUNCH|${h.id}`);
              const dinner = bookedSet.has(`${selectedDay}|DINNER|${h.id}`);
              return (
                <div key={h.id} className="rounded-xl border border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2)/0.3)] p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-[rgb(var(--border)/0.3)] pb-2">
                    <span className="font-medium text-sm text-[rgb(var(--text))] flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-gold" /> {h.name}
                    </span>
                    <span className="text-xs text-[rgb(var(--text-dim))]">up to {h.capacity} guests</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className={`flex items-center justify-between rounded-lg p-2 ${lunch ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                      <span className="flex items-center gap-1 font-medium"><Clock className="h-3 w-3" /> Lunch</span>
                      <span className="font-semibold">{lunch ? 'Reserved' : 'Available'}</span>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg p-2 ${dinner ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                      <span className="flex items-center gap-1 font-medium"><Clock className="h-3 w-3" /> Dinner</span>
                      <span className="font-semibold">{dinner ? 'Reserved' : 'Available'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
