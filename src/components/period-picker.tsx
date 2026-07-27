'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MONTHS } from '@/lib/format';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';

export function PeriodPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function go(y: number, m: number) {
    const params = new URLSearchParams(sp.toString());
    params.set('y', String(y));
    params.set('m', String(m));
    router.push(`${pathname}?${params.toString()}`);
  }
  function shift(delta: number) {
    let y = year, m = month + delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    go(y, m);
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface))] p-1">
      <button onClick={() => shift(-1)} className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
      <select value={month} onChange={(e) => go(year, Number(e.target.value))} className="cursor-pointer bg-transparent px-1 py-1 text-sm text-[rgb(var(--text))] focus:outline-none">
        {MONTHS.map((m, i) => <option key={m} value={i + 1} className="bg-[rgb(var(--surface))]">{m}</option>)}
      </select>
      <select value={year} onChange={(e) => go(Number(e.target.value), month)} className="cursor-pointer bg-transparent px-1 py-1 text-sm text-[rgb(var(--text))] focus:outline-none">
        {[year - 2, year - 1, year, year + 1].map((y) => <option key={y} value={y} className="bg-[rgb(var(--surface))]">{y}</option>)}
      </select>
      <button onClick={() => shift(1)} className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="no-print inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--gold)/0.1)]">
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}

