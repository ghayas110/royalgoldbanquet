'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/format';
import { Search, Check, ChevronDown, X } from 'lucide-react';

export interface Option {
  value: number | string;
  label: string;
  sub?: string;   // secondary line (e.g. date / slip)
  right?: string; // right-aligned meta (e.g. amount)
}

export function SearchSelect({
  options, value, onChange, placeholder = 'Search…', emptyLabel = 'Select…',
}: {
  options: Option[];
  value: number | string | null;
  onChange: (v: number | string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 50);
    return options.filter((o) => `${o.label} ${o.sub ?? ''} ${o.right ?? ''}`.toLowerCase().includes(s)).slice(0, 50);
  }, [q, options]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.7)] px-3.5 py-2.5 text-left text-sm text-[rgb(var(--text))] transition-colors hover:border-[rgb(var(--gold)/0.5)]">
        <span className={cn('truncate', !selected && 'text-[rgb(var(--text-dim))]')}>
          {selected ? (
            <span className="flex items-center gap-2">
              <span>{selected.label}</span>
              {selected.sub && <span className="text-xs text-[rgb(var(--text-dim))]">· {selected.sub}</span>}
            </span>
          ) : emptyLabel}
        </span>
        <span className="flex items-center gap-1">
          {selected && <X className="h-4 w-4 text-[rgb(var(--text-dim))] hover:text-negative" onClick={(e) => { e.stopPropagation(); onChange(null); }} />}
          <ChevronDown className={cn('h-4 w-4 text-[rgb(var(--text-dim))] transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-[rgb(var(--gold)/0.25)] bg-[rgb(var(--surface))] shadow-lift">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border)/0.5)] px-3 py-2">
            <Search className="h-4 w-4 text-[rgb(var(--text-dim))]" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
              className="w-full bg-transparent text-sm text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-dim))]" />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-[rgb(var(--text-dim))]">No matches</div>}
            {filtered.map((o) => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[rgb(var(--surface-2))]', o.value === value && 'bg-[rgb(var(--gold)/0.1)]')}>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 truncate text-[rgb(var(--text))]">
                    {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}
                    {o.label}
                  </span>
                  {o.sub && <span className="block text-xs text-[rgb(var(--text-dim))]">{o.sub}</span>}
                </span>
                {o.right && <span className="shrink-0 tnum text-xs text-gold">{o.right}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
