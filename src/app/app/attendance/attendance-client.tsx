'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { monthLabelFull, MONTHS } from '@/lib/format';
import { Card, SectionTitle, Button, Badge, Field, Input, Select, Modal, FadeUp } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import { markAttendance, markAllPresent, createEmployee } from '@/lib/actions/attendance';
import { summarizeAttendance } from '@/lib/attendance-calc';
import { UserPlus, CheckCheck, Info, ArrowUpRight } from 'lucide-react';

type Emp = { id: number; name: string; designation: string; salary: number };
type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | '';

const STATUS_META: Record<Exclude<Status, ''>, { short: string; cls: string; label: string; dot: string }> = {
  PRESENT: { short: 'P', label: 'Present', cls: 'bg-positive/20 text-positive ring-positive/50', dot: 'bg-positive' },
  ABSENT: { short: 'A', label: 'Absent', cls: 'bg-negative/20 text-negative ring-negative/50', dot: 'bg-negative' },
  LATE: { short: 'L', label: 'Late', cls: 'bg-warn/20 text-warn ring-warn/50', dot: 'bg-warn' },
  LEAVE: { short: 'Lv', label: 'Leave', cls: 'bg-sky-500/15 text-sky-400 ring-sky-500/50', dot: 'bg-sky-400' },
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AttendanceClient({ year, month, days, employees, cells: initial, canMark, canManage }: {
  year: number; month: number; days: number; employees: Emp[]; cells: Record<string, string>; canMark: boolean; canManage: boolean;
}) {
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const today = new Date();
  const defaultDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : 1;
  const [selectedDay, setSelectedDay] = useState(Math.min(defaultDay, days));
  const [pendingAll, startAll] = useTransition();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateOf = (d: number) => `${year}-${pad(month)}-${pad(d)}`;
  const key = (empId: number, day: number) => `${empId}|${day}`;

  async function setStatus(empId: number, day: number, status: Status) {
    const k = key(empId, day);
    setCells((p) => { const n = { ...p }; if (status) n[k] = status; else delete n[k]; return n; });
    if (status) { setSaving((s) => s + 1); await markAttendance({ employeeId: empId, date: dateOf(day), status }); setSaving((s) => s - 1); }
  }

  const summaries = useMemo(() => {
    const map: Record<number, ReturnType<typeof summarizeAttendance>> = {};
    for (const e of employees) {
      let present = 0, absent = 0, late = 0, leave = 0;
      for (let d = 1; d <= days; d++) {
        const s = cells[key(e.id, d)];
        if (s === 'PRESENT') present++; else if (s === 'ABSENT') absent++; else if (s === 'LATE') late++; else if (s === 'LEAVE') leave++;
      }
      map[e.id] = summarizeAttendance({ present, absent, late, leave });
    }
    return map;
  }, [cells, employees, days]);

  // per-day marked counts for the calendar
  const dayMarked = useMemo(() => {
    const t: Record<number, number> = {};
    for (let d = 1; d <= days; d++) { let c = 0; for (const e of employees) if (cells[key(e.id, d)]) c++; t[d] = c; }
    return t;
  }, [cells, employees, days]);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const gridCells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  return (
    <div className="space-y-5">
      <FadeUp className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-[rgb(var(--text))]">Attendance</h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">{employees.length} staff · {monthLabelFull(year, month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving > 0 && <span className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-dim))]"><span className="h-2 w-2 animate-pulse rounded-full bg-gold" /> Saving…</span>}
          <PeriodPicker year={year} month={month} />
          {canManage && <Button variant="outline" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Employee</Button>}
        </div>
      </FadeUp>

      <FadeUp delay={0.03}>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]"><Info className="h-4 w-4 text-gold" /><span><strong className="text-[rgb(var(--text))]">Rule:</strong> 1 absent = 1 day · every 3 lates = 1 absent day · leave is separate.</span></div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(Object.keys(STATUS_META) as Array<Exclude<Status, ''>>).map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[rgb(var(--text-dim))]"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} /> {STATUS_META[s].label}</span>
            ))}
          </div>
        </Card>
      </FadeUp>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Calendar */}
        <FadeUp delay={0.05} className="lg:col-span-3">
          <Card className="p-4">
            <div className="grid grid-cols-7 gap-1.5">
              {WD.map((d) => <div key={d} className="py-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-[rgb(var(--text-dim))]">{d}</div>)}
              {gridCells.map((day, i) => {
                if (!day) return <div key={i} />;
                const marked = dayMarked[day] ?? 0;
                const selected = day === selectedDay;
                const complete = marked === employees.length && employees.length > 0;
                return (
                  <button key={i} onClick={() => setSelectedDay(day)}
                    className={`flex min-h-[64px] flex-col items-start rounded-xl border p-2 text-left transition-colors ${selected ? 'border-[rgb(var(--gold)/0.6)] bg-[rgb(var(--gold)/0.12)]' : 'border-[rgb(var(--border)/0.4)] hover:bg-[rgb(var(--surface-2))]'}`}>
                    <span className={`text-xs ${selected ? 'font-semibold text-gold' : 'text-[rgb(var(--text-dim))]'}`}>{day}</span>
                    {marked > 0 && <span className={`mt-auto text-[10px] ${complete ? 'text-positive' : 'text-[rgb(var(--text-dim))]'}`}>{marked}/{employees.length} marked</span>}
                  </button>
                );
              })}
            </div>
          </Card>
        </FadeUp>

        {/* Day marking panel */}
        <FadeUp delay={0.08} className="lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg text-gold">{selectedDay} {monthLabelFull(year, month)}</h3>
              {canMark && (
                <Button variant="solid" className="py-1.5 text-xs" disabled={pendingAll} onClick={() => startAll(async () => { await markAllPresent(dateOf(selectedDay)); location.reload(); })}>
                  <CheckCheck className="h-4 w-4" /> All present
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {employees.map((e) => {
                const s = (cells[key(e.id, selectedDay)] ?? '') as Status;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-[rgb(var(--border)/0.35)] px-3 py-2">
                    <Link href={`/app/employees/${e.id}`} className="group min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm text-[rgb(var(--text))] group-hover:text-gold">{e.name} <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" /></div>
                      <div className="text-[11px] text-[rgb(var(--text-dim))]">{e.designation}</div>
                    </Link>
                    <div className="flex gap-1">
                      {(Object.keys(STATUS_META) as Array<Exclude<Status, ''>>).map((st) => (
                        <button key={st} disabled={!canMark} onClick={() => setStatus(e.id, selectedDay, s === st ? '' : st)}
                          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${s === st ? `ring-1 ${STATUS_META[st].cls}` : 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text-dim))] hover:text-[rgb(var(--text))]'} ${canMark ? 'cursor-pointer' : 'cursor-default'}`}>
                          {STATUS_META[st].short}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </FadeUp>
      </div>

      {/* Month summary */}
      <FadeUp delay={0.1}>
        <Card className="p-5">
          <SectionTitle sub="Effective absent days apply the 3-lates rule">Month summary</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]"><th className="px-3 py-2 font-medium">Employee</th><th className="px-3 py-2 text-center">P</th><th className="px-3 py-2 text-center">A</th><th className="px-3 py-2 text-center">L</th><th className="px-3 py-2 text-center">Lv</th><th className="px-3 py-2 text-center">Eff. Abs</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {employees.map((e) => { const sm = summaries[e.id]; return (
                  <tr key={e.id} className="border-b border-[rgb(var(--border)/0.2)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                    <td className="px-3 py-2.5"><div className="text-[rgb(var(--text))]">{e.name}</div><div className="text-xs text-[rgb(var(--text-dim))]">{e.designation}</div></td>
                    <td className="px-3 py-2.5 text-center tnum text-positive">{sm.present}</td>
                    <td className="px-3 py-2.5 text-center tnum text-negative">{sm.absent}</td>
                    <td className="px-3 py-2.5 text-center tnum text-warn">{sm.late}</td>
                    <td className="px-3 py-2.5 text-center tnum text-sky-400">{sm.leave}</td>
                    <td className="px-3 py-2.5 text-center tnum font-semibold text-[rgb(var(--text))]">{sm.effectiveAbsentDays}{sm.lateAsAbsent > 0 && <span className="ml-0.5 text-[10px] text-[rgb(var(--text-dim))]">(+{sm.lateAsAbsent})</span>}</td>
                    <td className="px-3 py-2.5 text-right"><Link href={`/app/employees/${e.id}`} className="inline-flex rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"><ArrowUpRight className="h-4 w-4" /></Link></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </Card>
      </FadeUp>

      {addOpen && <EmployeeModal onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); location.reload(); }} />}
    </div>
  );
}

function EmployeeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Waiter');
  const [salary, setSalary] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Add employee">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" /></Field>
          <Field label="Designation"><Select value={designation} onChange={(e) => setDesignation(e.target.value)}>{['Head Waiter', 'Waiter', 'Cook', 'Cleaner', 'Valet', 'Security', 'Electrician', 'Staff'].map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Monthly salary (Rs.)"><Input inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="28000" /></Field>
        </div>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => { const r = await createEmployee({ name, phone: phone || null, designation, monthlySalary: Number(salary) || 0 }); if (r.ok) onDone(); else setError(r.error); })}>{pending ? 'Saving…' : 'Add employee'}</Button>
        </div>
      </div>
    </Modal>
  );
}
