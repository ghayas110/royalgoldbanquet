'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { fmtMoney, fmtDate, monthLabelFull, MONTHS } from '@/lib/format';
import { Card, SectionTitle, Button, Badge, Field, Input, Modal, FadeUp, EmptyState, TableScroll } from '@/components/ui';
import { PeriodPicker } from '@/components/period-picker';
import { addLoan, addAdvance, deleteAdvance, disburseSalary } from '@/lib/actions/salary';
import { ArrowLeft, Plus, HandCoins, Wallet, CalendarClock, Briefcase, Phone, Banknote, ScrollText, Coins, Trash2 } from 'lucide-react';

type Loan = { id: number; amount: number; repaid: number; outstanding: number; dateTaken: string; note: string | null; settled: boolean };
/**
 * A salary ADVANCE — this month's own pay drawn early, recovered from the next
 * salary run. Distinct from a loan, which is a larger sum repaid over months.
 */
type SalaryMonth = {
  year: number; month: number; base: number;
  advances: Array<{ id: number; date: string; amount: number; note: string | null; recovered: number }>;
  advanceTotal: number; absenceDeduction: number; loanDeduction: number; otherDeduction: number;
  netPaid: number; remaining: number; paid: boolean; paidDate: string | null; note: string | null;
};
type Advance = { id: number; amount: number; recovered: number; outstanding: number; advanceDate: string; note: string | null; settled: boolean };
type Salary = { id: number; year: number; month: number; baseSalary: number; absentDays: number; absenceDeduction: number; loanDeduction: number; otherDeduction: number; netPaid: number; paidDate: string; note: string | null };
type Ledger = {
  employee: { id: number; name: string; phone: string | null; designation: string; monthlySalary: number; joinedDate: string | null; isActive: boolean };
  loans: Loan[]; salaries: Salary[]; advances: Advance[]; salaryMonths: SalaryMonth[]; attendance: { present: number; absent: number; late: number; leave: number };
  totals: { totalLoan: number; totalRepaid: number; outstandingLoan: number; totalDisbursed: number; outstandingAdvance: number };
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
  const { employee: e, loans, salaryMonths, totals } = ledger;
  const [loanOpen, setLoanOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
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
            {/* flex-wrap: three actions overflowed a phone's width. */}
            {canManage && (
              <div className="flex flex-wrap gap-2 [&_button]:whitespace-nowrap">
                <Button variant="outline" onClick={() => setAdvanceOpen(true)}><Coins className="h-4 w-4" /> Give advance</Button>
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
        <MiniStat
          label="Advance outstanding"
          value={fmtMoney(totals.outstandingAdvance)}
          tone={totals.outstandingAdvance > 0 ? 'red' : 'plain'}
          sub={totals.outstandingAdvance > 0 ? 'Comes out of the next salary' : undefined}
        />
        <MiniStat label={`Abs. days · ${MONTHS[month - 1]}`} value={String(attendanceSummary.effectiveAbsentDays)} tone={attendanceSummary.effectiveAbsentDays > 0 ? 'red' : 'plain'} sub={`${attendanceSummary.present}P ${attendanceSummary.absent}A ${attendanceSummary.late}L`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
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

        {/* Salary — one record per month, with the advances drawn from that
            month listed inside it. An advance is part of that month's pay, not
            a separate arrangement, so the month shows what is left to hand over. */}
        <FadeUp delay={0.08}>
          <Card className="p-5">
            <SectionTitle
              sub="Each month's pay, and anything drawn from it during the month"
              right={canManage ? (
                <button onClick={() => setAdvanceOpen(true)} className="text-xs text-gold hover:underline">
                  Give advance
                </button>
              ) : undefined}
            >
              Salary
            </SectionTitle>

            <div className="space-y-3">
              {salaryMonths.map((m) => {
                const deductions = m.absenceDeduction + m.loanDeduction + m.otherDeduction;
                return (
                  <div
                    key={`${m.year}-${m.month}`}
                    className={`rounded-xl border p-4 ${m.paid ? 'border-[rgb(var(--border)/0.4)]' : 'border-gold/35 bg-[rgb(var(--gold)/0.04)]'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg text-[rgb(var(--text))]">{MONTHS[m.month - 1]} {m.year}</span>
                        {m.paid
                          ? <Badge tone="green">Paid {m.paidDate ? fmtDate(m.paidDate) : ''}</Badge>
                          : <Badge tone="amber">Not yet paid</Badge>}
                      </div>
                      <span className="tnum text-sm text-[rgb(var(--text-dim))]">Salary {fmtMoney(m.base)}</span>
                    </div>

                    {/* The lines that make up the month, in the order they happen. */}
                    <div className="mt-3 space-y-1.5 text-sm">
                      {m.advances.map((a) => (
                        <div key={a.id} className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-[rgb(var(--text-muted))]">
                            <span className="text-negative">Advance taken</span> · {fmtDate(a.date)}
                            {a.note ? <span className="text-[rgb(var(--text-dim))]"> · {a.note}</span> : null}
                          </span>
                          <span className="tnum shrink-0 text-negative">−{fmtMoney(a.amount, false)}</span>
                        </div>
                      ))}
                      {m.absenceDeduction > 0 && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[rgb(var(--text-muted))]">Absence deduction</span>
                          <span className="tnum text-negative">−{fmtMoney(m.absenceDeduction, false)}</span>
                        </div>
                      )}
                      {m.loanDeduction > 0 && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[rgb(var(--text-muted))]">Loan installment</span>
                          <span className="tnum text-negative">−{fmtMoney(m.loanDeduction, false)}</span>
                        </div>
                      )}
                      {m.otherDeduction > 0 && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[rgb(var(--text-muted))]">Other deduction</span>
                          <span className="tnum text-negative">−{fmtMoney(m.otherDeduction, false)}</span>
                        </div>
                      )}
                      {m.advances.length === 0 && deductions === 0 && (
                        <div className="text-xs text-[rgb(var(--text-dim))]">Nothing drawn from this month.</div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[rgb(var(--border)/0.4)] pt-2.5">
                      <span className={`text-sm font-medium ${m.paid ? 'text-positive' : 'text-gold'}`}>
                        {m.paid ? 'Paid at month end' : 'Remaining to pay'}
                      </span>
                      <span className={`tnum font-display text-lg ${m.paid ? 'text-positive' : 'text-gold'}`}>
                        {fmtMoney(m.paid ? m.netPaid : m.remaining)}
                      </span>
                    </div>

                    {/* Removing is refused server-side once a salary run has
                        recovered any of it, so only offer it while untouched. */}
                    {canManage && !m.paid && m.advances.some((a) => a.recovered === 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.advances.filter((a) => a.recovered === 0).map((a) => (
                          <button
                            key={a.id}
                            onClick={async () => {
                              const r = await deleteAdvance(a.id);
                              flash(r.ok ? (r.message ?? 'Advance removed.') : r.error);
                            }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-negative"
                          >
                            <Trash2 className="h-3 w-3" /> Remove {fmtMoney(a.amount, false)} advance
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </FadeUp>
      </div>

      {loanOpen && <LoanModal employeeId={e.id} onClose={() => setLoanOpen(false)} onDone={flash} />}
      {advanceOpen && (
        <AdvanceModal
          employeeId={e.id}
          employeeName={e.name}
          monthlySalary={e.monthlySalary}
          outstanding={totals.outstandingAdvance}
          onClose={() => setAdvanceOpen(false)}
          onDone={flash}
        />
      )}
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

  const outstanding = ledger.totals.outstandingLoan;
  // Advances already handed over come out of this salary automatically — the
  // server recovers them, so the figure is shown here rather than typed.
  const advanceOutstanding = ledger.totals.outstandingAdvance;
  const beforeAdvance = useMemo(
    () => Math.max(0, (Number(base) || 0) - (Number(absenceDed) || 0) - (Number(loanDed) || 0) - (Number(otherDed) || 0)),
    [base, absenceDed, loanDed, otherDed],
  );
  const advanceDeduction = Math.min(advanceOutstanding, beforeAdvance);
  const net = beforeAdvance - advanceDeduction;

  return (
    <Modal open onClose={onClose} title={`Disburse salary — ${MONTHS[month - 1]} ${year}`} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-[rgb(var(--surface-2))] p-3 text-sm text-[rgb(var(--text-muted))]">
          Effective absent days this month: <strong className="text-[rgb(var(--text))]">{effAbsent}</strong> · Outstanding loan: <strong className="text-gold">{fmtMoney(outstanding)}</strong>
          {advanceOutstanding > 0 && (
            <> · Advance already taken: <strong className="text-negative">{fmtMoney(advanceOutstanding)}</strong></>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base salary"><Input inputMode="decimal" value={base} onChange={(ev) => setBase(ev.target.value)} /></Field>
          <Field label="Absence deduction" hint={`Suggested ${fmtMoney(suggestedAbsenceDeduction)}`}><Input inputMode="decimal" value={absenceDed} onChange={(ev) => setAbsenceDed(ev.target.value)} /></Field>
          <Field label="Loan installment" hint={outstanding > 0 ? `Max ${fmtMoney(outstanding)}` : 'No outstanding loan'}><Input inputMode="decimal" value={loanDed} onChange={(ev) => setLoanDed(ev.target.value)} /></Field>
          <Field label="Other deduction"><Input inputMode="decimal" value={otherDed} onChange={(ev) => setOtherDed(ev.target.value)} /></Field>
        </div>
        <Field label="Paid date"><Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></Field>

        {advanceDeduction > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--border)/0.5)] px-4 py-2.5 text-sm">
            <span className="text-[rgb(var(--text-muted))]">Less advance already paid to {e.name.split(' ')[0]}</span>
            <span className="tnum text-negative">−{fmtMoney(advanceDeduction)}</span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-[rgb(var(--gold)/0.1)] px-4 py-3">
          <span className="font-medium text-gold">
            {advanceDeduction > 0 ? 'Still to hand over' : 'Net payable'}
          </span>
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

/**
 * Give a salary advance.
 *
 * The action refuses an amount that would push the outstanding advances past
 * the monthly salary they are recovered from — beyond that it stops being an
 * advance and becomes an unrecorded loan — so the remaining headroom is shown
 * here rather than letting the owner discover the limit by hitting it.
 */
function AdvanceModal({
  employeeId, employeeName, monthlySalary, outstanding, onClose, onDone,
}: {
  employeeId: number; employeeName: string; monthlySalary: number;
  outstanding: number; onClose: () => void; onDone: (m: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [postToExpense, setPostToExpense] = useState(true);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const headroom = Math.max(0, monthlySalary - outstanding);

  return (
    <Modal open onClose={onClose} title={`Give ${employeeName} an advance`}>
      <div className="space-y-4">
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Cash drawn against this month&apos;s salary. It is recovered from the next salary run —
          for a larger sum repaid over months, record a <b>loan</b> instead.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" hint={monthlySalary > 0 ? `Up to ${fmtMoney(headroom)} left this month` : undefined}>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Note" hint="Optional">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. medical" />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={postToExpense}
            onChange={(e) => setPostToExpense(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-[rgb(var(--text-muted))]">
            Record it in petty cash today under &ldquo;Advance to Employees&rdquo; — the cash
            leaves now, so the expense is dated now rather than at month end.
          </span>
        </label>

        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => start(async () => {
              setError('');
              const r = await addAdvance({
                employeeId,
                amount: Number(amount),
                advanceDate: date,
                note: note || null,
                postToExpense,
              });
              if (r.ok) onDone(r.message ?? 'Advance recorded.');
              else setError(r.error);
            })}
          >
            {pending ? 'Saving…' : 'Give advance'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
