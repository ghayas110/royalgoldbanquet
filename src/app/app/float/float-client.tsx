'use client';

import { useState, useMemo, useTransition } from 'react';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Button, Badge, FadeUp, Modal, Field, Input, Select, EmptyState } from '@/components/ui';
import { disburseFloat, markReturned } from '@/lib/actions/float';
import { SearchSelect, type Option } from '@/components/search-select';
import { HandCoins, ArrowRight, CheckCircle2, Plus, Wallet } from 'lucide-react';

type Row = {
  id: number; slip_no: string | null; party_name: string | null;
  disbursed_by_name: string; disbursed_to_name: string;
  amount_disbursed: number; expenses_recorded: number; amount_returned: number; outstanding: number;
  date_disbursed: string; date_returned: string | null; status: 'OPEN' | 'RECONCILED' | 'DISPUTED'; note: string | null;
};

export function FloatClient({ ledger, managers, bookings, canDisburse, canReconcile }: { ledger: Row[]; managers: { id: number; name: string }[]; bookings: Option[]; canDisburse: boolean; canReconcile: boolean }) {
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [returnRow, setReturnRow] = useState<Row | null>(null);
  const [msg, setMsg] = useState('');

  const totalOutstanding = useMemo(() => ledger.filter((r) => r.status !== 'RECONCILED').reduce((s, r) => s + r.outstanding, 0), [ledger]);
  const totalDisbursed = useMemo(() => ledger.reduce((s, r) => s + r.amount_disbursed, 0), [ledger]);
  const totalRecorded = useMemo(() => ledger.reduce((s, r) => s + r.expenses_recorded, 0), [ledger]);

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle
          sub="Owner ↔ Naseem reconciliation — every rupee of float accounted for"
          right={canDisburse ? <Button onClick={() => setDisburseOpen(true)}><Plus className="h-4 w-4" /> Disburse float</Button> : undefined}
        >
          Manager Float Ledger
        </SectionTitle>
      </FadeUp>

      {msg && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>}

      {/* Big outstanding callout */}
      <FadeUp delay={0.05}>
        <Card className="relative overflow-hidden p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgb(var(--gold)/0.1)] blur-3xl" />
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-dim))]"><HandCoins className="h-4 w-4 text-gold" /> Outstanding with Naseem</div>
              <div className="mt-2 font-display text-4xl text-gold tnum">{fmtMoney(totalOutstanding)}</div>
              <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">Held by manager, owed back</div>
            </div>
            <div className="md:border-l md:border-[rgb(var(--border)/0.5)] md:pl-6">
              <div className="text-sm text-[rgb(var(--text-dim))]">Total disbursed</div>
              <div className="mt-2 font-display text-2xl text-[rgb(var(--text))] tnum">{fmtMoney(totalDisbursed)}</div>
            </div>
            <div className="md:border-l md:border-[rgb(var(--border)/0.5)] md:pl-6">
              <div className="text-sm text-[rgb(var(--text-dim))]">Verified spend recorded</div>
              <div className="mt-2 font-display text-2xl text-[rgb(var(--text))] tnum">{fmtMoney(totalRecorded)}</div>
            </div>
          </div>
        </Card>
      </FadeUp>

      {ledger.length === 0 ? (
        <Card><EmptyState icon={<Wallet className="h-8 w-8" />} title="No float disbursed yet" sub="Disburse cash to a manager to begin reconciliation." /></Card>
      ) : (
        <div className="space-y-4">
          {ledger.map((r, i) => (
            <FadeUp key={r.id} delay={0.04 * i}>
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-[rgb(var(--border)/0.4)] px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg text-[rgb(var(--text))]">{r.slip_no ?? 'General float'}</span>
                    {r.party_name && <span className="text-sm text-[rgb(var(--text-dim))]">· {r.party_name}</span>}
                  </div>
                  <Badge tone={r.status === 'RECONCILED' ? 'green' : r.status === 'DISPUTED' ? 'red' : 'amber'}>{r.status}</Badge>
                </div>

                {/* Two-column reconciliation */}
                <div className="grid md:grid-cols-2">
                  {/* Owner side */}
                  <div className="border-b border-[rgb(var(--border)/0.4)] p-5 md:border-b-0 md:border-r">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold/80">Owner disbursement · {r.disbursed_by_name}</div>
                    <Line label="Disbursed" value={r.amount_disbursed} strong />
                    <Line label={`Date`} text={fmtDate(r.date_disbursed)} />
                    {r.note && <div className="mt-2 text-xs text-[rgb(var(--text-dim))]">{r.note}</div>}
                  </div>
                  {/* Manager side */}
                  <div className="p-5">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold/80">Manager spend · {r.disbursed_to_name}</div>
                    <Line label="Verified expenses recorded" value={r.expenses_recorded} negative />
                    <Line label="Cash returned" value={r.amount_returned} />
                    <div className="mt-2 flex items-center justify-between border-t border-[rgb(var(--border)/0.4)] pt-2">
                      <span className="text-sm font-medium text-[rgb(var(--text))]">Outstanding (Naseem Return)</span>
                      <span className={`tnum font-display text-lg ${r.outstanding > 0 ? 'text-gold' : 'text-positive'}`}>{fmtMoney(r.outstanding)}</span>
                    </div>
                  </div>
                </div>

                {/* Running balance strip + action */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2)/0.4)] px-5 py-3">
                  <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-dim))]">
                    <span className="tnum text-[rgb(var(--text-muted))]">{fmtMoney(r.amount_disbursed, false)}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="tnum">spent {fmtMoney(r.expenses_recorded, false)}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="tnum text-gold">holds {fmtMoney(r.outstanding, false)}</span>
                  </div>
                  {canReconcile && r.status !== 'RECONCILED' && (
                    <Button variant="outline" className="py-2 text-sm" onClick={() => setReturnRow(r)}>
                      <CheckCircle2 className="h-4 w-4" /> Mark returned
                    </Button>
                  )}
                </div>
              </Card>
            </FadeUp>
          ))}
        </div>
      )}

      {disburseOpen && <DisburseModal managers={managers} bookings={bookings} onClose={() => setDisburseOpen(false)} onDone={(m) => { setDisburseOpen(false); flash(m); }} />}
      {returnRow && <ReturnModal row={returnRow} onClose={() => setReturnRow(null)} onDone={(m) => { setReturnRow(null); flash(m); }} />}
    </div>
  );

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3500); location.reload(); }
}

function Line({ label, value, text, strong, negative }: { label: string; value?: number; text?: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-[rgb(var(--text-muted))]">{label}</span>
      <span className={`tnum ${negative ? 'text-negative' : strong ? 'font-semibold text-[rgb(var(--text))]' : 'text-[rgb(var(--text))]'}`}>{text ?? fmtMoney(value ?? 0)}</span>
    </div>
  );
}

function DisburseModal({ managers, bookings, onClose, onDone }: { managers: { id: number; name: string }[]; bookings: Option[]; onClose: () => void; onDone: (m: string) => void }) {
  const [bookingId, setBookingId] = useState<number | string | null>(null);
  const [disbursedTo, setTo] = useState(managers[0]?.id ?? 0);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <Modal open onClose={onClose} title="Disburse float" wide>
      <div className="space-y-4">
        <Field label="Against booking" hint="Search by party name, slip # or date — the float is tied to this booking">
          <SearchSelect options={bookings} value={bookingId} onChange={setBookingId} placeholder="Search bookings…" emptyLabel="Select a booking (or leave for general float)" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Disburse to"><Select value={disbursedTo} onChange={(e) => setTo(Number(e.target.value))}>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
          <Field label="Amount (Rs.)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20000" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Float for event expenses" /></Field>
        </div>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const res = await disburseFloat({ bookingId: bookingId ? Number(bookingId) : null, disbursedTo, amount: Number(amount), dateDisbursed: date, note: note || null });
            if (res.ok) onDone(res.message ?? 'Disbursed.'); else setError(res.error);
          })}>{pending ? 'Saving…' : 'Disburse'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: (m: string) => void }) {
  const [amount, setAmount] = useState(String(row.outstanding));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title={`Mark returned — ${row.slip_no ?? 'float'}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-[rgb(var(--surface-2))] p-4 text-sm">
          <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Disbursed</span><span className="tnum">{fmtMoney(row.amount_disbursed)}</span></div>
          <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Recorded spend</span><span className="tnum text-negative">{fmtMoney(row.expenses_recorded)}</span></div>
          <div className="mt-1 flex justify-between border-t border-[rgb(var(--border)/0.4)] pt-1 font-medium"><span>Should return</span><span className="tnum text-gold">{fmtMoney(row.outstanding)}</span></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cash returned (Rs.)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Date returned"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const res = await markReturned(row.id, Number(amount), date);
            if (res.ok) onDone(res.message ?? 'Marked returned.'); else setError(res.error);
          })}>{pending ? 'Saving…' : 'Confirm return'}</Button>
        </div>
      </div>
    </Modal>
  );
}
