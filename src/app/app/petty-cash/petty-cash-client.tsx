'use client';

import { useState, useMemo, useTransition } from 'react';
import { fmtMoney, monthLabelFull, fmtDate } from '@/lib/format';
import { Card, Button, Badge, FadeUp, Modal, Field, Input, Toggle, EmptyState } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import { useRef } from 'react';
import {
  saveCell,
  setMonthLock, addExpenseHead, updateExpenseHead, deleteExpenseHead, restoreExpenseHead,
} from '@/lib/actions/petty-cash';
import { Lock, LockOpen, Plus, Trash2, Tags, CalendarDays, Pencil, Search, X } from 'lucide-react';

type Head = { id: number; name: string; hasQtyNote: boolean };
type Entry = { id: number; day: number; headId: number; headName: string; amount: number; qtyNote: string | null };
type Cat = { id: number; name: string; hasQtyNote: boolean; active: boolean; usage: number };

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PettyCashClient({
  year, month, days, heads, entries: initial, locked, categories, canEdit, canLock,
}: {
  year: number; month: number; days: number; heads: Head[]; entries: Entry[]; locked: boolean;
  categories: Cat[]; canEdit: boolean; canLock: boolean;
}) {
  const [tab, setTab] = useState<'daily' | 'categories'>('daily');
  const [entries, setEntries] = useState<Entry[]>(initial);
  const today = new Date();
  const defaultDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : 1;
  const [selectedDay, setSelectedDay] = useState(Math.min(defaultDay, days));
  const [pendingLock, startLock] = useTransition();
  const editable = canEdit && !locked;

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateOf = (d: number) => `${year}-${pad(month)}-${pad(d)}`;

  const dayTotals = useMemo(() => {
    const t: Record<number, number> = {};
    for (const e of entries) t[e.day] = (t[e.day] ?? 0) + e.amount;
    return t;
  }, [entries]);
  const grandTotal = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);
  const dayEntries = useMemo(() => entries.filter((e) => e.day === selectedDay), [entries, selectedDay]);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-5">
      <FadeUp className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">Petty Cash</h1>
            {locked && <Badge tone="amber"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
          </div>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">Daily expenses · {monthLabelFull(year, month)} · <span className="tnum text-gold">{fmtMoney(grandTotal)}</span> total</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker year={year} month={month} />
          {canLock && (
            <Button variant={locked ? 'gold' : 'outline'} disabled={pendingLock} onClick={() => startLock(async () => { await setMonthLock(year, month, !locked); location.reload(); })}>
              {locked ? <><LockOpen className="h-4 w-4" /> Unlock</> : <><Lock className="h-4 w-4" /> Lock</>}
            </Button>
          )}
        </div>
      </FadeUp>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface))] p-1 w-fit">
        {([['daily', 'Daily Entry', CalendarDays], ['categories', 'Expense Categories', Tags]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${tab === id ? 'bg-gold text-ink font-semibold' : 'text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'daily' ? (
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Calendar */}
          <FadeUp delay={0.04} className="lg:col-span-3">
            <Card className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {WD.map((d) => <div key={d} className="py-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-[rgb(var(--text-dim))]">{d}</div>)}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const total = dayTotals[day] ?? 0;
                  const selected = day === selectedDay;
                  return (
                    <button key={i} onClick={() => setSelectedDay(day)}
                      className={`flex min-h-[64px] flex-col items-start rounded-xl border p-2 text-left transition-colors ${selected ? 'border-[rgb(var(--gold)/0.6)] bg-[rgb(var(--gold)/0.12)]' : 'border-[rgb(var(--border)/0.4)] hover:bg-[rgb(var(--surface-2))]'}`}>
                      <span className={`text-xs ${selected ? 'font-semibold text-gold' : 'text-[rgb(var(--text-dim))]'}`}>{day}</span>
                      {total > 0 && <span className="mt-auto w-full truncate text-right text-[11px] tnum font-medium text-[rgb(var(--text))]">{fmtMoney(total, false)}</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          </FadeUp>

          {/* Day detail table */}
          <FadeUp delay={0.08} className="lg:col-span-2">
            <DayPanel
              date={dateOf(selectedDay)} label={`${selectedDay} ${monthLabelFull(year, month)}`}
              day={selectedDay} dayEntries={dayEntries} heads={heads} editable={editable}
              onCellChange={(headId, amount, qtyNote) => setEntries((prev) => {
                const filtered = prev.filter((e) => !(e.day === selectedDay && e.headId === headId));
                if (amount > 0 || qtyNote) { const h = heads.find((x) => x.id === headId)!; return [...filtered, { id: Date.now() + headId, day: selectedDay, headId, headName: h.name, amount, qtyNote: qtyNote || null }]; }
                return filtered;
              })}
            />
          </FadeUp>
        </div>
      ) : (
        <CategoriesTab categories={categories} canEdit={canEdit} />
      )}
    </div>
  );
}

// ── Day detail: every category listed, zero by default, autosave ──
function DayPanel({ date, label, dayEntries, heads, editable, onCellChange }: {
  date: string; label: string; day: number; dayEntries: Entry[]; heads: Head[]; editable: boolean;
  onCellChange: (headId: number, amount: number, qtyNote: string | null) => void;
}) {
  const byHead = useMemo(() => {
    const m: Record<number, Entry> = {};
    for (const e of dayEntries) m[e.headId] = e;
    return m;
  }, [dayEntries]);
  const dayTotal = dayEntries.reduce((s, e) => s + e.amount, 0);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-gold">{label}</h3>
        <span className="tnum text-sm text-[rgb(var(--text-muted))]">{fmtMoney(dayTotal)}</span>
      </div>
      <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-[rgb(var(--border)/0.4)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0"><tr className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2))] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]"><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 text-right font-medium">Amount (Rs.)</th></tr></thead>
          <tbody>
            {heads.map((h) => <CellRow key={`${date}-${h.id}`} head={h} date={date} entry={byHead[h.id]} editable={editable} onSaved={onCellChange} />)}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[rgb(var(--text-dim))]">Every category starts at zero — just fill in the day&apos;s expenses. Saves automatically.</p>
    </Card>
  );
}

function CellRow({ head, date, entry, editable, onSaved }: { head: Head; date: string; entry?: Entry; editable: boolean; onSaved: (headId: number, amount: number, qtyNote: string | null) => void }) {
  const [val, setVal] = useState(entry && entry.amount ? String(entry.amount) : '');
  const [note, setNote] = useState(entry?.qtyNote ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(amountStr: string, noteStr: string) {
    const n = Math.max(0, Number(amountStr) || 0);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveCell({ date, headId: head.id, amount: n, qtyNote: noteStr || null });
      onSaved(head.id, n, noteStr || null);
    }, 500);
  }

  return (
    <tr className="border-b border-[rgb(var(--border)/0.2)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
      <td className="px-3 py-1.5 text-[rgb(var(--text-muted))]">
        {head.name}
        {head.hasQtyNote && editable && (
          <input value={note} onChange={(e) => { setNote(e.target.value); persist(val, e.target.value); }} placeholder="qty" className="ml-2 w-14 rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[11px] text-[rgb(var(--text-dim))] outline-none" />
        )}
      </td>
      <td className="px-3 py-1.5 text-right">
        {editable
          ? <input value={val} onChange={(e) => { setVal(e.target.value); persist(e.target.value, note); }} inputMode="decimal" placeholder="0" className="w-24 rounded-md bg-[rgb(var(--surface-2))] px-2 py-1 text-right text-sm tnum outline-none focus:ring-1 focus:ring-gold placeholder:text-[rgb(var(--text-dim))]" />
          : <span className="tnum text-[rgb(var(--text))]">{entry?.amount ? fmtMoney(entry.amount, false) : '—'}</span>}
      </td>
    </tr>
  );
}

function CategoriesTab({ categories, canEdit }: { categories: Cat[]; canEdit: boolean }) {
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<null | { cat: Cat | null }>(null);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? categories.filter((c) => c.name.toLowerCase().includes(s)) : categories;
  }, [q, categories]);

  return (
    <FadeUp delay={0.04}>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-[rgb(var(--surface-2))] px-3 py-2">
            <Search className="h-4 w-4 text-[rgb(var(--text-dim))]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" className="w-48 bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-dim))]" />
            {q && <X className="h-4 w-4 cursor-pointer text-[rgb(var(--text-dim))]" onClick={() => setQ('')} />}
          </div>
          {canEdit && <Button onClick={() => setModal({ cat: null })}><Plus className="h-4 w-4" /> New category</Button>}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Tags className="h-8 w-8" />} title="No categories found" sub={q ? 'Try a different search.' : 'Add your first category.'} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((c) => (
              <div key={c.id} className={`flex items-center justify-between rounded-xl border border-[rgb(var(--border)/0.4)] px-3 py-2.5 ${!c.active ? 'opacity-55' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-[rgb(var(--text))]">{c.name}</span>
                    {c.hasQtyNote && <Badge tone="muted">qty</Badge>}
                    {!c.active && <Badge tone="muted">archived</Badge>}
                  </div>
                  <div className="text-xs text-[rgb(var(--text-dim))]">{c.usage} entries</div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    {c.active
                      ? <button onClick={() => setModal({ cat: c })} className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"><Pencil className="h-4 w-4" /></button>
                      : <button onClick={async () => { await restoreExpenseHead(c.id); location.reload(); }} className="text-xs text-gold hover:underline">Restore</button>}
                    {c.active && <DeleteCat cat={c} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      {modal && <CategoryModal cat={modal.cat} onClose={() => setModal(null)} />}
    </FadeUp>
  );
}

function DeleteCat({ cat }: { cat: Cat }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button onClick={() => setConfirm(true)} className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:bg-negative/10 hover:text-negative"><Trash2 className="h-4 w-4" /></button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`${cat.usage > 0 ? 'Archive' : 'Delete'} “${cat.name}”?`}>
        <p className="text-sm text-[rgb(var(--text-muted))]">{cat.usage > 0 ? `This category has ${cat.usage} entries, so it will be archived (hidden) rather than deleted.` : 'This category has no entries and will be permanently deleted.'}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { await deleteExpenseHead(cat.id); location.reload(); })}>{cat.usage > 0 ? 'Archive' : 'Delete'}</Button>
        </div>
      </Modal>
    </>
  );
}

function CategoryModal({ cat, onClose }: { cat: Cat | null; onClose: () => void }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [qty, setQty] = useState(cat?.hasQtyNote ?? false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title={cat ? 'Edit category' : 'New expense category'}>
      <div className="space-y-4">
        <Field label="Category name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Security Guard" /></Field>
        <Toggle checked={qty} onChange={setQty} label="Has a secondary count / quantity note" />
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = cat ? await updateExpenseHead(cat.id, name, qty) : await addExpenseHead(name, qty);
            if (r.ok) { onClose(); location.reload(); } else setError(r.error);
          })}>{pending ? 'Saving…' : cat ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
