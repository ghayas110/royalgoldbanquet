'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { fmtMoney, fmtDate, monthLabelFull, MONTHS } from '@/lib/format';
import { Card, SectionTitle, Button, Badge, Field, Input, Modal, FadeUp, EmptyState } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import { addLoan, disburseSalary } from '@/lib/actions/salary';
import { ArrowLeft, Plus, HandCoins, Wallet, CalendarClock, Briefcase, Phone, Banknote, ScrollText } from 'lucide-react';

type Loan = { id: number; amount: number; repaid: number; outstanding: number; dateTaken: string; note: string | null; settled: boolean };
type Salary = { id: number; year: number; month: number; baseSalary: number; absentDays: number; absenceDeduction: number; loanDeduction: number; otherDeduction: number; netPaid: number; paidDate: string; note: string | null };
type Ledger = {
  employee: { id: number; name: string; phone: string | null; designation: string; monthlySalary: number; joinedDate: string | null; isActive: boolean };
  loans: Loan[]; salaries: Salary[]; attendance: { present: number; absent: number; late: number; leave: number };
  totals: { totalLoan: number; totalRepaid: number; outstandingLoan: number; totalDisbursed: number };
};

function tenure(joined: string | null): string {
  if (!joined) return '—';
  const d = new Date(joined); const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (months < 0) { years--; months += 12; }
  return years > 0 ? `${years}y ${months}m` : `${months}m`;
}

export function EmployeeLedgerClient({ ledger, year, month, attendanceSummary, suggestedAbsenceDeduction, alreadyPaidThisMonth, canManage }: {
  ledger: Ledger; year: number; month: number;
  attendanceSummary: { present: number; absent: number; late: number; leave: number; effectiveAbsentDays: number; lateAsAbsent: number };
  suggestedAbsenceDeduction: number; alreadyPaidThisMonth: boolean; canManage: boolean;
}) {
  const { employee: e, loans, salaries, totals } = ledger;
  const [loanOpen, setLoanOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); location.reload(); };

  return (
    <div className="space-y-6">
      <FadeUp className="flex items-center justify-between">
        <Link href="/app/attendance" className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] hover:text-gold"><ArrowLeft className="h-4 w-4" /> Attendance</Link>
        <PeriodPicker year={year} month={month} />
      </FadeUp>

      {msg && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>}

      {/* Profile header */}
      <FadeUp delay={0.03}>
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold text-2xl font-semibold text-ink ring-1 ring-inset ring-white/15">{e.name.slice(0, 1)}</div>
              <div>
                <h1 className="font-display text-2xl text-[rgb(var(--text))]">{e.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[rgb(var(--text-dim))]">
                  <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {e.designation}</span>
                  {e.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {e.phone}</span>}
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {tenure(e.joinedDate)} · since {fmtDate(e.joinedDate)}</span>
                  {!e.isActive && <Badge tone="muted">Inactive</Badge>}
                </div>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLoanOpen(true)}><HandCoins className="h-4 w-4" /> Add loan</Button>
                <Button onClick={() => setSalaryOpen(true)} disabled={alreadyPaidThisMonth}><Banknote className="h-4 w-4" /> {alreadyPaidThisMonth ? 'Salary paid' : 'Disburse salary'}</Button>
              </div>
            )}
          </div>
        </Card>
      </FadeUp>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Monthly salary" value={fmtMoney(e.monthlySalary)} />
        <MiniStat label="Total disbursed" value={fmtMoney(totals.totalDisbursed)} tone="green" />
        <MiniStat label="Outstanding loan" value={fmtMoney(totals.outstandingLoan)} tone={totals.outstandingLoan > 0 ? 'gold' : 'plain'} />
        <MiniStat label={`Abs. days · ${MONTHS[month - 1]}`} value={String(attendanceSummary.effectiveAbsentDays)} tone={attendanceSummary.effectiveAbsentDays > 0 ? 'red' : 'plain'} sub={`${attendanceSummary.present}P ${attendanceSummary.absent}A ${attendanceSummary.late}L`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loans */}
        <FadeUp delay={0.05}>
          <Card className="p-5">
            <SectionTitle sub={`Outstanding ${fmtMoney(totals.outstandingLoan)}`}>Loans</SectionTitle>
            {loans.length === 0 ? <EmptyState icon={<HandCoins className="h-7 w-7" />} title="No loans" sub="This employee has no recorded loans." /> : (
              <div className="space-y-2">
                {loans.map((l) => (
                  <div key={l.id} className="rounded-xl border border-[rgb(var(--border)/0.4)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="tnum font-medium text-[rgb(var(--text))]">{fmtMoney(l.amount)}</span>
                      <Badge tone={l.settled ? 'green' : 'gold'}>{l.settled ? 'Settled' : `${fmtMoney(l.outstanding)} left`}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-[rgb(var(--text-dim))]">
                      <span>{fmtDate(l.dateTaken)}{l.note ? ` · ${l.note}` : ''}</span>
                      <span className="tnum">repaid {fmtMoney(l.repaid, false)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </FadeUp>

        {/* Salary history */}
        <FadeUp delay={0.08}>
          <Card className="p-5">
            <SectionTitle sub="Monthly disbursements">Salary history</SectionTitle>
            {salaries.length === 0 ? <EmptyState icon={<Wallet className="h-7 w-7" />} title="No salary paid yet" sub="Disburse a salary to start the history." /> : (
              <div className="overflow-hidden rounded-xl border border-[rgb(var(--border)/0.4)]">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2)/0.5)] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]"><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">Deductions</th><th className="px-3 py-2 text-right">Net</th></tr></thead>
                  <tbody>
                    {salaries.map((s) => (
                      <tr key={s.id} className="border-b border-[rgb(var(--border)/0.2)] last:border-0">
                        <td className="px-3 py-2 text-[rgb(var(--text-muted))]">{MONTHS[s.month - 1]} {s.year}</td>
                        <td className="px-3 py-2 text-right tnum">{fmtMoney(s.baseSalary, false)}</td>
                        <td className="px-3 py-2 text-right tnum text-negative">-{fmtMoney(s.absenceDeduction + s.loanDeduction + s.otherDeduction, false)}</td>
                        <td className="px-3 py-2 text-right tnum font-medium text-positive">{fmtMoney(s.netPaid, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </FadeUp>
      </div>

      {loanOpen && <LoanModal employeeId={e.id} onClose={() => setLoanOpen(false)} onDone={flash} />}
      {salaryOpen && <SalaryModal ledger={ledger} year={year} month={month} suggestedAbsenceDeduction={suggestedAbsenceDeduction} effAbsent={attendanceSummary.effectiveAbsentDays} onClose={() => setSalaryOpen(false)} onDone={flash} />}
    </div>
  );
}

function MiniStat({ label, value, sub, tone = 'plain' }: { label: string; value: string; sub?: string; tone?: 'plain' | 'gold' | 'green' | 'red' }) {
  const c = { plain: 'text-[rgb(var(--text))]', gold: 'text-gold', green: 'text-positive', red: 'text-negative' }[tone];
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
      <div className={`mt-1 tnum font-display text-xl ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[rgb(var(--text-dim))]">{sub}</div>}
    </Card>
  );
}

function LoanModal({ employeeId, onClose, onDone }: { employeeId: number; onClose: () => void; onDone: (m: string) => void }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Record a loan">
      <div className="space-y-4">
        <p className="text-sm text-[rgb(var(--text-dim))]">The loan is added to this employee&apos;s outstanding balance and posted to the expense sheet under &ldquo;Employee Loan&rdquo;. Deduct it in installments when disbursing salary.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loan amount (Rs.)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000" /></Field>
          <Field label="Date taken"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Personal loan" /></Field>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => { const r = await addLoan({ employeeId, amount: Number(amount), dateTaken: date, note: note || null, postToExpense: true }); if (r.ok) onDone(r.message ?? 'Loan recorded.'); else setError(r.error); })}>{pending ? 'Saving…' : 'Record loan'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function SalaryModal({ ledger, year, month, suggestedAbsenceDeduction, effAbsent, onClose, onDone }: {
  ledger: Ledger; year: number; month: number; suggestedAbsenceDeduction: number; effAbsent: number; onClose: () => void; onDone: (m: string) => void;
}) {
  const e = ledger.employee;
  const [base, setBase] = useState(String(e.monthlySalary));
  const [absenceDed, setAbsenceDed] = useState(String(Math.round(suggestedAbsenceDeduction)));
  const [loanDed, setLoanDed] = useState('0');
  const [otherDed, setOtherDed] = useState('0');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const net = useMemo(() => Math.max(0, (Number(base) || 0) - (Number(absenceDed) || 0) - (Number(loanDed) || 0) - (Number(otherDed) || 0)), [base, absenceDed, loanDed, otherDed]);
  const outstanding = ledger.totals.outstandingLoan;

  return (
    <Modal open onClose={onClose} title={`Disburse salary — ${MONTHS[month - 1]} ${year}`} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-[rgb(var(--surface-2))] p-3 text-sm text-[rgb(var(--text-muted))]">
          Effective absent days this month: <strong className="text-[rgb(var(--text))]">{effAbsent}</strong> · Outstanding loan: <strong className="text-gold">{fmtMoney(outstanding)}</strong>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base salary"><Input inputMode="decimal" value={base} onChange={(ev) => setBase(ev.target.value)} /></Field>
          <Field label="Absence deduction" hint={`Suggested ${fmtMoney(suggestedAbsenceDeduction)}`}><Input inputMode="decimal" value={absenceDed} onChange={(ev) => setAbsenceDed(ev.target.value)} /></Field>
          <Field label="Loan installment" hint={outstanding > 0 ? `Max ${fmtMoney(outstanding)}` : 'No outstanding loan'}><Input inputMode="decimal" value={loanDed} onChange={(ev) => setLoanDed(ev.target.value)} /></Field>
          <Field label="Other deduction"><Input inputMode="decimal" value={otherDed} onChange={(ev) => setOtherDed(ev.target.value)} /></Field>
        </div>
        <Field label="Paid date"><Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></Field>

        <div className="flex items-center justify-between rounded-xl bg-[rgb(var(--gold)/0.1)] px-4 py-3">
          <span className="font-medium text-gold">Net payable</span>
          <span className="tnum font-display text-xl text-gold">{fmtMoney(net)}</span>
        </div>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await disburseSalary({
              employeeId: e.id, year, month, baseSalary: Number(base) || 0, absentDays: effAbsent,
              absenceDeduction: Number(absenceDed) || 0, loanDeduction: Number(loanDed) || 0, otherDeduction: Number(otherDed) || 0,
              paidDate: date, note: null, postToExpense: true,
            });
            if (r.ok) onDone(r.message ?? 'Salary disbursed.'); else setError(r.error);
          })}>{pending ? 'Disbursing…' : 'Confirm & disburse'}</Button>
        </div>
      </div>
    </Modal>
  );
}
