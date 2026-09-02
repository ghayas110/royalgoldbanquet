'use client';

import { useState, useTransition } from 'react';
import { fmtMoney, fmtDate, fmtDateWithDay, fmtPhone } from '@/lib/format';
import { Card, Button, Field, Input, Select, FadeUp, TableScroll, Modal } from '@/components/ui';
import { recordPayment, updatePayment, deletePayment, convertEnquiry, updateBookingServices, updateBookingRules,
  changeEventDate, refundBooking, cancelBooking } from '@/lib/actions/bookings';
import { Printer, Plus, FileCheck2, Pencil, Trash2, CalendarClock, Undo2, Ban } from 'lucide-react';
import { InvoiceShareButton } from '@/components/invoice-share';
import { SERVICE_PRESETS } from '@/lib/service-presets';
import { DateInput } from '@/components/date-input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Booking = {
  id: number; slip_no: string; party_name: string;
  phone: string | null; phone2: string | null; address: string | null; hall: string; event_date: string; booking_date: string; shift: string;
  guest_count: number; balance_amount: number; banquet_amount: number; total_amount: number; paid_amount: number;
  payment_status: string; status: string; notes: string | null;
  date_change_count: number; refunded_amount: number;
};

type DateChange = { seq: number; from_date: string; to_date: string; amount: number; reason: string | null };

export function BookingDetailClient({ booking: b, items, payments, canPay, canConvert, canEdit, rules, ruleLibrary, dateChanges }: {
  booking: Booking; items: { label: string; qty: number; rate: number; subtotal: number }[];
  payments: { id: number; booking_id: number; amount: number; payment_date: string; method: string; note: string | null }[];
  canPay: boolean; canConvert: boolean; canEdit: boolean; rules: string[]; ruleLibrary: string[];
  dateChanges: DateChange[];
}) {
  const due = b.total_amount - b.paid_amount;
  const isEnquiry = b.status === 'ENQUIRY';
  const [editingServices, setEditingServices] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main detail. `min-w-0` is required: grid items default to
          min-width:auto, so without it this column refuses to shrink below its
          widest table and pushes the whole page sideways. */}
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <FadeUp>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm text-gold">{b.slip_no}</div>
                <h1 className="mt-1 font-display text-2xl text-[rgb(var(--text))]">{b.party_name}</h1>
                <div className="mt-1 text-sm text-[rgb(var(--text-dim))]">
                  {[fmtPhone(b.phone), fmtPhone(b.phone2)].filter((p) => p !== '—').join(' · ') || 'No phone'}{b.address ? ` · ${b.address}` : ''}
                </div>
              </div>
              <div className="no-print flex flex-wrap items-start gap-2">
                <Link href={`/print/booking/${b.id}`} className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm hover:bg-[rgb(var(--gold)/0.1)]"><Printer className="h-4 w-4" /> {isEnquiry ? 'Print inquiry' : 'Print slip'}</Link>
                <InvoiceShareButton
                  bookingId={b.id}
                  slipNo={b.slip_no}
                  partyName={b.party_name}
                  phone={b.phone ?? null}
                  docLabel={isEnquiry ? 'Quotation' : 'Invoice'}
                />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Info label="Event date" value={fmtDateWithDay(b.event_date)} />
              <Info label="Booking date" value={fmtDateWithDay(b.booking_date)} />
              <Info label="Shift" value={b.shift} />
              <Info label="Hall" value={b.hall} />
              <Info label="Guests" value={String(b.guest_count)} />
            </div>
            {b.notes && (
              <div className="mt-5 rounded-xl border border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface-2)/0.4)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Notes</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-[rgb(var(--text-muted))]">{b.notes}</div>
              </div>
            )}
          </Card>
        </FadeUp>

        {isEnquiry && canConvert && (
          <FadeUp delay={0.02}>
            <ConvertPanel bookingId={b.id} balanceAmount={b.balance_amount} banquetAmount={b.banquet_amount} />
          </FadeUp>
        )}

        {!isEnquiry && canEdit && (
          <FadeUp delay={0.03}>
            <ReschedulePanel booking={b} dateChanges={dateChanges} />
          </FadeUp>
        )}

        <FadeUp delay={0.04}>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--border)/0.5)] px-5 py-3">
              <span className="font-display text-lg text-gold">Banquet services</span>
              {canEdit && !editingServices && (
                <Button variant="outline" className="py-1.5 text-xs" onClick={() => setEditingServices(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit services
                </Button>
              )}
            </div>

            {editingServices ? (
              <ServicesEditor
                bookingId={b.id}
                initial={items}
                balanceAmount={b.balance_amount}
                paidAmount={b.paid_amount}
                onClose={() => setEditingServices(false)}
              />
            ) : (
            <TableScroll>
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="border-b border-[rgb(var(--border)/0.4)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]"><th className="px-5 py-2.5">Item</th><th className="px-5 py-2.5 text-right">Qty</th><th className="px-5 py-2.5 text-right">Rate</th><th className="px-5 py-2.5 text-right">Subtotal</th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-[rgb(var(--border)/0.2)] last:border-0">
                    <td className="px-5 py-2.5 text-[rgb(var(--text-muted))]">{it.label}</td>
                    <td className="px-5 py-2.5 text-right tnum">{it.qty}</td>
                    <td className="px-5 py-2.5 text-right tnum">{fmtMoney(it.rate, false)}</td>
                    <td className="px-5 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(it.subtotal, false)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-[rgb(var(--surface-2)/0.5)] font-medium"><td className="px-5 py-2.5 text-[rgb(var(--text-muted))]" colSpan={3}>Banquet Amount</td><td className="px-5 py-2.5 text-right tnum text-gold">{fmtMoney(b.banquet_amount, false)}</td></tr></tfoot>
            </table>
            </TableScroll>
            )}
          </Card>
        </FadeUp>

        {/* Payments */}
        <FadeUp delay={0.08}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgb(var(--border)/0.5)] px-5 py-3">
              <span className="font-display text-lg text-gold">Payments</span>
              {canPay && due > 0 && !isEnquiry && <AddPaymentButton bookingId={b.id} due={due} />}
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-[rgb(var(--text-dim))]">No payments recorded.</div>
            ) : (
              <TableScroll>
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2)/0.3)] text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-dim))]">
                    <th className="px-5 py-2 text-left">Date</th>
                    <th className="px-5 py-2 text-left">Method</th>
                    <th className="px-5 py-2 text-left">Note</th>
                    <th className="px-5 py-2 text-right">Amount</th>
                    {canPay && <th className="px-3 py-2 text-right w-24">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <PaymentRow key={p.id} p={p} bookingId={b.id} canPay={canPay} />
                  ))}
                </tbody>
              </table>
              </TableScroll>
            )}
          </Card>
        </FadeUp>

        <FadeUp delay={0.1}>
          <RulesCard bookingId={b.id} initial={rules} library={ruleLibrary} canEdit={canEdit} />
        </FadeUp>
      </div>

      {/* Amount summary */}
      <div>
        <FadeUp delay={0.06}>
          <Card glass className="sticky top-6 p-5">
            <h3 className="mb-4 font-display text-lg text-gold">{isEnquiry ? 'Estimate' : 'Account'}</h3>
            <div className="space-y-2 text-sm">
              <Row label="Balance Amount" value={b.balance_amount} />
              <Row label="Banquet Amount" value={b.banquet_amount} />
              <div className="border-t border-[rgb(var(--border)/0.5)] pt-2"><Row label={isEnquiry ? 'Estimated Total' : 'Total'} value={b.total_amount} strong /></div>
              {!isEnquiry && <Row label="Paid" value={b.paid_amount} muted />}
              {!isEnquiry && <div className="border-t border-[rgb(var(--gold)/0.4)] pt-2"><Row label="Balance Due" value={due} big /></div>}
            </div>
          </Card>
        </FadeUp>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div><div className="mt-0.5 text-sm text-[rgb(var(--text))]">{value}</div></div>;
}
function Row({ label, value, strong, big, muted }: { label: string; value: number; strong?: boolean; big?: boolean; muted?: boolean }) {
  return <div className="flex items-center justify-between"><span className={big ? 'font-display text-base text-gold' : muted ? 'text-[rgb(var(--text-dim))]' : 'text-[rgb(var(--text-muted))]'}>{label}</span><span className={`tnum ${big ? 'font-display text-lg text-gold' : strong ? 'font-semibold text-[rgb(var(--text))]' : 'text-[rgb(var(--text))]'}`}>{fmtMoney(value)}</span></div>;
}

/**
 * Inline editor for a booking's banquet services. Services are normally agreed
 * after the enquiry is raised, so this stays available on enquiries and on
 * confirmed bookings alike.
 */
function ServicesEditor({ bookingId, initial, balanceAmount, paidAmount, onClose }: {
  bookingId: number; initial: { label: string; qty: number; rate: number }[];
  balanceAmount: number; paidAmount: number; onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(
    initial.length ? initial.map((i) => ({ label: i.label, qty: String(i.qty), rate: String(i.rate) })) : [{ label: '', qty: '1', rate: '' }],
  );
  const [hall, setHall] = useState(String(balanceAmount));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const banquet = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);
  const total = (Number(hall) || 0) + banquet;
  const belowPaid = total < paidAmount - 0.01;

  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="p-5">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input list="svc-presets-edit" value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Service"
              className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--gold)/0.5)]" />
            <input value={r.qty} inputMode="decimal" onChange={(e) => set(i, { qty: e.target.value })} placeholder="qty"
              className="w-14 rounded-lg border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2))] px-2 py-2 text-right text-sm tnum outline-none" />
            <input value={r.rate} inputMode="decimal" onChange={(e) => set(i, { rate: e.target.value })} placeholder="rate"
              className="w-24 rounded-lg border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2))] px-2 py-2 text-right text-sm tnum outline-none" />
            <span className="hidden w-24 text-right text-sm tnum text-[rgb(var(--text-dim))] sm:block">{fmtMoney((Number(r.qty) || 0) * (Number(r.rate) || 0), false)}</span>
            <button onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove service"
              className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:text-negative"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <datalist id="svc-presets-edit">{SERVICE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
      </div>

      <button onClick={() => setRows((p) => [...p, { label: '', qty: '1', rate: '' }])} className="mt-3 flex items-center gap-1 text-xs text-gold hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add line
      </button>

      <div className="mt-4 grid gap-3 border-t border-[rgb(var(--border)/0.4)] pt-4 sm:grid-cols-2">
        <Field label="Hall payment (Balance Amount)">
          <Input inputMode="decimal" value={hall} onChange={(e) => setHall(e.target.value)} />
        </Field>
        <div className="flex flex-col justify-end gap-1 text-sm">
          <div className="flex justify-between"><span className="text-[rgb(var(--text-muted))]">Banquet Amount</span><span className="tnum">{fmtMoney(banquet)}</span></div>
          <div className="flex justify-between border-t border-[rgb(var(--border)/0.4)] pt-1"><span className="font-medium text-[rgb(var(--text))]">New total</span><span className="tnum font-semibold text-gold">{fmtMoney(total)}</span></div>
        </div>
      </div>

      {belowPaid && <div className="mt-3 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">Total can&apos;t be less than the {fmtMoney(paidAmount)} already paid.</div>}
      {error && <div className="mt-3 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

      <div className="mt-4 flex gap-2">
        <Button disabled={pending || belowPaid} onClick={() => { setError(''); start(async () => {
          const res = await updateBookingServices({
            bookingId, balanceAmount: Number(hall) || 0,
            serviceItems: rows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), qty: Number(r.qty) || 0, rate: Number(r.rate) || 0 })),
          });
          if (res.ok) { onClose(); router.refresh(); } else setError(res.error);
        }); }}>{pending ? 'Saving…' : 'Save services'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

const MAX_DATE_CHANGES = 3;

/**
 * Reschedule / refund / cancel.
 *
 * The event date may be moved at most 3 times. Once that's used up the only
 * remaining outcomes are cancelling the event or returning the customer's
 * money, so the panel switches to offering exactly those.
 */
function ReschedulePanel({ booking: b, dateChanges }: { booking: Booking; dateChanges: DateChange[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'move' | 'refund' | 'cancel'>(null);
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [refundAmt, setRefundAmt] = useState(String(b.paid_amount));
  const [refundDate, setRefundDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  const used = b.date_change_count;
  const remaining = Math.max(0, MAX_DATE_CHANGES - used);
  const closed = b.status === 'RETURNED' || b.status === 'CANCELLED';

  function reset() { setMode(null); setError(''); setNewDate(''); setReason(''); }

  if (closed) {
    return (
      <Card className="border border-[rgb(var(--border)/0.7)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Ban className="h-5 w-5 text-[rgb(var(--text-dim))]" />
          <h3 className="font-display text-lg text-[rgb(var(--text-muted))]">
            {b.status === 'RETURNED' ? 'Payment returned' : 'Event cancelled'}
          </h3>
        </div>
        {b.status === 'RETURNED' && (
          <p className="mt-1.5 text-sm text-[rgb(var(--text-muted))]">
            <span className="tnum text-negative">{fmtMoney(b.refunded_amount)}</span> was returned to the
            customer and recorded in petty cash.
          </p>
        )}
        {dateChanges.length > 0 && <DateHistory changes={dateChanges} />}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-gold">Event date</h3>
          <p className="mt-0.5 text-sm text-[rgb(var(--text-muted))]">
            Currently <span className="text-[rgb(var(--text))]">{fmtDate(b.event_date)}</span> ·{' '}
            {remaining > 0
              ? `${used} of ${MAX_DATE_CHANGES} changes used — ${remaining} left.`
              : `All ${MAX_DATE_CHANGES} date changes used. You can cancel the event or return the payment.`}
          </p>
        </div>
        {!mode && (
          <div className="flex flex-wrap gap-2">
            {remaining > 0 && (
              <Button variant="outline" className="py-2 text-sm" onClick={() => { setMsg(''); setMode('move'); }}>
                <CalendarClock className="h-4 w-4" /> Change date
              </Button>
            )}
            <Button variant="danger" className="py-2 text-sm" onClick={() => { setMsg(''); setMode('refund'); }}>
              <Undo2 className="h-4 w-4" /> Return payment
            </Button>
            <Button variant="ghost" className="py-2 text-sm" onClick={() => { setMsg(''); setMode('cancel'); }}>
              <Ban className="h-4 w-4" /> Cancel event
            </Button>
          </div>
        )}
      </div>

      {msg && <div className="mt-3 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">{msg}</div>}

      {/* Modal 1: Change Event Date */}
      <Modal open={mode === 'move'} onClose={reset} title="Change Event Date">
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgb(var(--gold)/0.3)] bg-[rgb(var(--gold)/0.08)] p-3.5 text-sm text-[rgb(var(--text-muted))]">
            Currently scheduled for <span className="font-semibold text-gold">{fmtDate(b.event_date)}</span>.
            This will be change <span className="font-bold text-[rgb(var(--text))]">{used + 1}</span> of {MAX_DATE_CHANGES}.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New event date" hint="dd/mm/yyyy">
              <DateInput value={newDate} onChange={setNewDate} />
            </Field>
            <Field label="Reason for change (optional)">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family request" />
            </Field>
          </div>

          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button
              disabled={pending || !newDate}
              onClick={() => {
                setError('');
                start(async () => {
                  const res = await changeEventDate({ bookingId: b.id, newEventDate: newDate, reason: reason || null });
                  if (res.ok) {
                    setMsg(`Date changed. ${res.remaining} change${res.remaining === 1 ? '' : 's'} left.`);
                    reset();
                    router.refresh();
                  } else setError(res.error);
                });
              }}
            >
              {pending ? 'Saving…' : 'Confirm New Date'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Return Payment */}
      <Modal open={mode === 'refund'} onClose={reset} title="Confirm Payment Return & Close Booking">
        <div className="space-y-4">
          <div className="rounded-xl border border-negative/40 bg-negative/10 p-3.5 text-sm text-[rgb(var(--text-muted))]">
            <div className="font-semibold text-negative mb-1 flex items-center gap-1.5">
              <Undo2 className="h-4 w-4" /> Warning: Payment Return
            </div>
            Returning payment will close this booking for <span className="font-semibold text-[rgb(var(--text))]">{b.party_name}</span>, free the hall date on <span className="font-semibold text-[rgb(var(--text))]">{fmtDate(b.event_date)}</span>, and log the refund in petty cash.
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount to return" hint={`Received: ${fmtMoney(b.paid_amount)}`}>
              <Input inputMode="decimal" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} />
            </Field>
            <Field label="Return Date" hint="dd/mm/yyyy">
              <DateInput value={refundDate} onChange={setRefundDate} />
            </Field>
            <Field label="Reason (optional)">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
            </Field>
          </div>

          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setError('');
                start(async () => {
                  const res = await refundBooking({ bookingId: b.id, amount: Number(refundAmt) || 0, refundDate, reason: reason || null });
                  if (res.ok) {
                    setMsg(res.message);
                    reset();
                    router.refresh();
                  } else setError(res.error);
                });
              }}
            >
              {pending ? 'Returning…' : 'Confirm & Return Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Cancel Event */}
      <Modal open={mode === 'cancel'} onClose={reset} title="Confirm Event Cancellation">
        <div className="space-y-4">
          <div className="rounded-xl border border-negative/40 bg-negative/10 p-3.5 text-sm text-[rgb(var(--text-muted))]">
            <div className="font-semibold text-negative mb-1 flex items-center gap-1.5">
              <Ban className="h-4 w-4" /> Warning: Event Cancellation
            </div>
            Are you sure you want to cancel the event for <span className="font-semibold text-[rgb(var(--text))]">{b.party_name}</span> on <span className="font-semibold text-[rgb(var(--text))]">{fmtDate(b.event_date)}</span>?
            <br />
            This will mark the event as CANCELLED and free the hall date. No money will be refunded.
          </div>

          <Field label="Cancellation reason (optional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer request" />
          </Field>

          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={reset}>Keep Booking</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setError('');
                start(async () => {
                  const res = await cancelBooking(b.id, reason || undefined);
                  if (res.ok) {
                    setMsg('Event cancelled.');
                    reset();
                    router.refresh();
                  } else setError(res.error);
                });
              }}
            >
              {pending ? 'Cancelling…' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>

      {dateChanges.length > 0 && <DateHistory changes={dateChanges} />}
    </Card>
  );
}

/** 1st / 2nd / 3rd event date with the booking value at the time. */
function DateHistory({ changes }: { changes: DateChange[] }) {
  const ord = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
  return (
    <div className="mt-4 border-t border-[rgb(var(--border)/0.4)] pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Date change history</div>
      <ul className="space-y-1.5">
        {changes.map((c) => (
          <li key={c.seq} className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-gold">{ord(c.seq)}</span>
            <span className="text-[rgb(var(--text-dim))]">{fmtDate(c.from_date)}</span>
            <span className="text-[rgb(var(--text-dim))]">→</span>
            <span className="text-[rgb(var(--text))]">{fmtDate(c.to_date)}</span>
            <span className="ml-auto tnum text-[rgb(var(--text-muted))]">{fmtMoney(c.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Booking-specific rules — these print as the slip's Terms & Conditions. */
function RulesCard({ bookingId, initial, library, canEdit }: { bookingId: number; initial: string[]; library: string[]; canEdit: boolean }) {
  const router = useRouter();
  // Every rule from the portal is selected by default: the banquet's standing
  // terms apply to every customer, so the common case should need no clicks.
  // Un-ticking one here removes it from THIS booking's slip only.
  const usingLibraryDefaults = initial.length === 0 && library.length > 0;
  const [rules, setRules] = useState<string[]>(initial.length ? initial : library);
  const [draft, setDraft] = useState('');
  // Defaults aren't persisted yet, so offer Save straight away.
  const [dirty, setDirty] = useState(usingLibraryDefaults);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const add = (text: string) => {
    const t = text.trim();
    if (!t || rules.includes(t)) return;
    setRules((p) => [...p, t]); setDirty(true); setSaved(false);
  };
  const remove = (i: number) => { setRules((p) => p.filter((_, idx) => idx !== i)); setDirty(true); setSaved(false); };

  const unused = library.filter((l) => !rules.includes(l));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--border)/0.5)] px-5 py-3">
        <span className="font-display text-lg text-gold">Booking rules</span>
        <span className="text-xs text-[rgb(var(--text-dim))]">Printed on the back of the slip</span>
      </div>

      <div className="p-5">
        {usingLibraryDefaults && (
          <p className="mb-3 rounded-lg border border-[rgb(var(--gold)/0.3)] bg-[rgb(var(--gold)/0.06)] px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
            All {library.length} rules from your rules library are selected. Remove any that
            don&apos;t apply to this booking, then save.
          </p>
        )}
        {rules.length === 0 ? (
          <p className="text-sm text-[rgb(var(--text-dim))]">
            No rules selected — nothing will print in the Terms &amp; Conditions section.
            Add rules below or pick from your library.
          </p>
        ) : (
          <ol className="space-y-2">
            {rules.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-4 shrink-0 text-right text-xs text-gold">{i + 1}.</span>
                <span className="min-w-0 flex-1 text-[rgb(var(--text-muted))]">{r}</span>
                {canEdit && (
                  <button onClick={() => remove(i)} aria-label={`Remove rule ${i + 1}`} className="rounded-lg p-1 text-[rgb(var(--text-dim))] hover:text-negative">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {canEdit && (
          <>
            <div className="mt-4 flex gap-2">
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. AC open 3 hrs"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); setDraft(''); } }} />
              <Button variant="outline" className="shrink-0 py-2 text-sm" onClick={() => { add(draft); setDraft(''); }}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            {unused.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs text-[rgb(var(--text-dim))]">From your rules library</div>
                <div className="flex flex-wrap gap-1.5">
                  {unused.map((l) => (
                    <button key={l} onClick={() => add(l)}
                      className="rounded-full border border-[rgb(var(--border)/0.7)] px-2.5 py-1 text-xs text-[rgb(var(--text-muted))] hover:border-[rgb(var(--gold)/0.6)] hover:text-gold">
                      + {l.length > 46 ? `${l.slice(0, 46)}…` : l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(dirty || saved) && (
              <div className="mt-4 flex items-center gap-3">
                <Button disabled={pending || !dirty} onClick={() => start(async () => {
                  const res = await updateBookingRules({ bookingId, rules });
                  if (res.ok) { setDirty(false); setSaved(true); router.refresh(); }
                })}>{pending ? 'Saving…' : 'Save rules'}</Button>
                {saved && !dirty && <span className="text-xs text-positive">Saved — these now print on the slip.</span>}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function ConvertPanel({ bookingId, balanceAmount, banquetAmount }: {
  bookingId: number; balanceAmount: number; banquetAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [advance, setAdvance] = useState('');
  const [method, setMethod] = useState('CASH');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // Seeded from the enquiry's estimate, then edited to whatever was actually
  // agreed. This is the number that most often changes between enquiry and
  // handshake, so it is settled here rather than in a separate edit first.
  const [hall, setHall] = useState(String(balanceAmount));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const total = (Number(hall) || 0) + banquetAmount;
  const advanceNum = Number(advance) || 0;
  const overAdvance = advanceNum > total;

  return (
    <Card className="border border-[rgb(var(--gold)/0.35)] bg-[rgb(var(--gold)/0.06)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-gold">This is an enquiry</h3>
          <p className="mt-0.5 text-sm text-[rgb(var(--text-muted))]">
            Confirm it to lock the hall for this date and issue a booking slip.
            Agreed the services since? Use <span className="text-gold">Edit services</span> below first — the total updates before you take the advance.
          </p>
        </div>
        {!open && <Button onClick={() => setOpen(true)}><FileCheck2 className="h-4 w-4" /> Convert to booking</Button>}
      </div>
      {open && (
        <div className="mt-4 border-t border-[rgb(var(--gold)/0.25)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Hall payment (Balance Amount)" hint="The agreed hall charge">
              <Input inputMode="decimal" value={hall} onChange={(e) => setHall(e.target.value)} placeholder="400000" />
            </Field>
            <Field label="Advance now (optional)"><Input inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="150000" /></Field>
            <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)}><option>CASH</option><option>BANK</option><option>CHEQUE</option><option>ONLINE</option></Select></Field>
            <Field label="Booking date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <p className="mt-2 text-xs text-[rgb(var(--text-dim))]">
            Hall {fmtMoney(Number(hall) || 0)} + services {fmtMoney(banquetAmount)} ={' '}
            <span className="text-[rgb(var(--text))]">total {fmtMoney(total)}</span>. A new RGB slip number will be assigned.
          </p>
          {overAdvance && (
            <p className="mt-1 text-xs text-negative">The advance is more than the total.</p>
          )}
          {error && <div className="mt-3 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
          <div className="mt-3 flex gap-2">
            <Button disabled={pending || overAdvance} onClick={() => { setError(''); start(async () => {
              const res = await convertEnquiry({
                bookingId, bookingDate: date, advanceAmount: advanceNum,
                advanceMethod: method, balanceAmount: Number(hall) || 0,
              });
              if (res.ok) router.refresh(); else setError(res.error);
            }); }}>{pending ? 'Confirming…' : 'Confirm booking'}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AddPaymentButton({ bookingId, due }: { bookingId: number; due: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(due));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('CASH');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (!open) return <Button className="py-2 text-sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record payment</Button>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 py-1.5" placeholder="Amount" />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36 py-1.5" />
      <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-24 py-1.5"><option>CASH</option><option>BANK</option><option>CHEQUE</option><option>ONLINE</option></Select>
      <Button className="py-1.5 text-sm" disabled={pending} onClick={() => start(async () => {
        const res = await recordPayment({ bookingId, amount: Number(amount), paymentDate: date, method, note: 'Settlement' });
        if (res.ok) { setOpen(false); router.refresh(); } else setError(res.error);
      })}>Save</Button>
      {error && <span className="w-full text-xs text-negative">{error}</span>}
    </div>
  );
}

type PaymentItem = {
  id: number;
  booking_id: number;
  amount: number;
  payment_date: string;
  method: string;
  note: string | null;
};

function PaymentRow({ p, bookingId, canPay }: { p: PaymentItem; bookingId: number; canPay: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amount, setAmount] = useState(String(p.amount));
  const [date, setDate] = useState(String(p.payment_date).slice(0, 10));
  const [method, setMethod] = useState(p.method || 'CASH');
  const [note, setNote] = useState(p.note || '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (confirmDelete) {
    return (
      <tr className="border-b border-[rgb(var(--border)/0.2)] bg-negative/10">
        <td colSpan={canPay ? 4 : 3} className="px-5 py-3 text-xs font-medium text-[rgb(var(--text-muted))]">
          Confirm deleting payment of <span className="font-bold text-[rgb(var(--text))]">{fmtMoney(p.amount)}</span> from {fmtDate(p.payment_date)}?
          {error && <span className="mt-1 block text-negative">{error}</span>}
        </td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              className="bg-rose-600 px-2.5 py-1 text-xs text-white hover:bg-rose-500"
              disabled={pending}
              onClick={() => start(async () => {
                setError('');
                const res = await deletePayment({ paymentId: p.id, bookingId });
                if (res.ok) {
                  router.refresh();
                } else {
                  setError(res.error);
                }
              })}
            >
              {pending ? 'Deleting…' : 'Yes, Delete'}
            </Button>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  if (editing) {
    return (
      <tr className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2))]">
        <td className="px-3 py-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="py-1 text-xs" />
        </td>
        <td className="px-3 py-2">
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="py-1 text-xs">
            <option>CASH</option>
            <option>BANK</option>
            <option>CHEQUE</option>
            <option>ONLINE</option>
          </Select>
        </td>
        <td className="px-3 py-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="py-1 text-xs" />
        </td>
        <td className="px-3 py-2 text-right">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="py-1 text-right text-xs" />
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              className="px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => start(async () => {
                setError('');
                const res = await updatePayment({
                  paymentId: p.id,
                  bookingId,
                  amount: Number(amount),
                  paymentDate: date,
                  method,
                  note,
                });
                if (res.ok) {
                  setEditing(false);
                  router.refresh();
                } else {
                  setError(res.error);
                }
              })}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setEditing(false); setError(''); }}>
              Cancel
            </Button>
          </div>
          {error && <div className="mt-1 text-right text-[10px] text-rose-400">{error}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[rgb(var(--border)/0.2)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.3)]">
      <td className="px-5 py-2.5 text-[rgb(var(--text-muted))]">{fmtDate(p.payment_date)}</td>
      <td className="font-mono text-xs text-[rgb(var(--text-dim))] px-5 py-2.5">{p.method}</td>
      <td className="px-5 py-2.5 text-[rgb(var(--text-dim))]">{p.note || '—'}</td>
      <td className="tnum font-medium text-positive px-5 py-2.5 text-right">{fmtMoney(p.amount, false)}</td>
      {canPay && (
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setEditing(true)}
              title="Edit payment"
              className="rounded p-1 text-[rgb(var(--text-dim))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-gold"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete payment"
              className="rounded p-1 text-[rgb(var(--text-dim))] transition-colors hover:bg-rose-500/10 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
