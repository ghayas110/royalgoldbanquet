'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Field, Input, Select, FadeUp } from '@/components/ui';
import { fmtMoney, fmtDateWithDay } from '@/lib/format';
import { createBooking } from '@/lib/actions/bookings';
import { SERVICE_PRESETS } from '@/lib/service-presets';
import { DateInput } from '@/components/date-input';
import { Plus, Trash2, Check, ToggleLeft, ToggleRight } from 'lucide-react';

type Item = { label: string; qty: string; rate: string };
type Hall = { id: number; name: string; capacity: number; baseCharge: number };

export function NewBookingForm({ halls }: { halls: Hall[] }) {
  const router = useRouter();
  const [partyName, setPartyName] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  // No hall pre-selected — staff must choose one deliberately.
  const [hallId, setHallId] = useState(0);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventDate, setEventDate] = useState('');
  const [shift, setShift] = useState<'LUNCH' | 'DINNER'>('DINNER');
  const [guestCount, setGuests] = useState('');
  // Starts at 0 and is typed in each time — hall rates vary per booking, so
  // auto-filling the hall's base charge was quietly setting the wrong amount.
  const [balanceAmount, setBalance] = useState('');
  const [wantsServices, setWantsServices] = useState(false);
  const [items, setItems] = useState<Item[]>([{ label: 'Gents Waiters', qty: '10', rate: '800' }]);
  const [advance, setAdvance] = useState('');
  const [advanceMethod, setMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [isEnquiry, setIsEnquiry] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  // The hall no longer sets the amount — the balance is entered by hand.
  function onHallChange(id: number) {
    setHallId(id);
  }

  const banquet = useMemo(() => (wantsServices ? items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0) : 0), [items, wantsServices]);
  const balance = Number(balanceAmount) || 0;
  const total = balance + banquet;
  const adv = Number(advance) || 0;
  const due = total - adv;

  const addItem = () => setItems((p) => [...p, { label: '', qty: '1', rate: '' }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const setItem = (i: number, patch: Partial<Item>) => setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  function submit() {
    setError('');
    start(async () => {
      const res = await createBooking({
        partyName, phone: phone || null, phone2: phone2 || null, address: address || null,
        hallId, bookingDate, eventDate, shift, guestCount: Number(guestCount) || 0,
        balanceAmount: balance,
        serviceItems: wantsServices ? items.filter((it) => it.label).map((it) => ({ label: it.label, qty: Number(it.qty) || 0, rate: Number(it.rate) || 0 })) : [],
        advanceAmount: isEnquiry ? 0 : adv, advanceMethod,
        notes: notes || null, isEnquiry,
      });
      if (res.ok) router.push(`/app/bookings/${res.id}?created=1`);
      else setError(res.error);
    });
  }

  const inputOk = partyName && eventDate && hallId;

  return (
    <div className="space-y-6">
      <FadeUp><SectionTitle sub={isEnquiry ? 'Tentative quotation — no slot held, no advance taken' : 'Two-amount model: hall charge + itemized services'}>{isEnquiry ? 'New Enquiry' : 'New Booking'}</SectionTitle></FadeUp>

      {/* Mode: tentative enquiry vs confirmed booking */}
      <FadeUp delay={0.01}>
        <div className="inline-flex rounded-xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2)/0.5)] p-1">
          <button type="button" onClick={() => setIsEnquiry(false)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${!isEnquiry ? 'bg-gold text-black' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'}`}>
            Confirmed booking
          </button>
          <button type="button" onClick={() => setIsEnquiry(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${isEnquiry ? 'bg-gold text-black' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'}`}>
            Enquiry / Quotation
          </button>
        </div>
      </FadeUp>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Party details */}
          <FadeUp delay={0.03}>
            <Card className="p-5">
              <h3 className="mb-4 font-display text-lg text-gold">Party details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Party name"><Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g. Ahmed–Zoya Wedding" /></Field>
                <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" /></Field>
                <Field label="Secondary phone"><Input value={phone2} onChange={(e) => setPhone2(e.target.value)} placeholder="0321-7654321" /></Field>
                <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street / area" /></Field>
              </div>
            </Card>
          </FadeUp>

          {/* Date & venue */}
          <FadeUp delay={0.06}>
            <Card className="p-5">
              <h3 className="mb-4 font-display text-lg text-gold">Date &amp; venue</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hall">
                  <Select value={hallId} onChange={(e) => onHallChange(Number(e.target.value))}>
                    <option value={0}>Select hall</option>
                    {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </Select>
                </Field>
                <Field label="Shift"><Select value={shift} onChange={(e) => setShift(e.target.value as 'LUNCH' | 'DINNER')}><option value="LUNCH">Lunch</option><option value="DINNER">Dinner</option></Select></Field>
                <Field label="Booking date" hint="dd/mm/yyyy"><DateInput value={bookingDate} onChange={setBookingDate} /></Field>
                <Field label="Event date" hint="dd/mm/yyyy"><DateInput value={eventDate} onChange={setEventDate} /></Field>
                <Field label="Guest count"><Input inputMode="numeric" value={guestCount} onChange={(e) => setGuests(e.target.value)} placeholder="500" /></Field>
              </div>
            </Card>
          </FadeUp>

          {/* Amounts + itemizer */}
          <FadeUp delay={0.09}>
            <Card className="p-5">
              <h3 className="mb-1 font-display text-lg text-gold">Hall Payment</h3>
              <p className="mb-4 text-xs text-[rgb(var(--text-dim))]">The hall/venue charge — the banquet&apos;s core credit. Enter the agreed amount for this booking.</p>
              <Field label="Hall payment (Balance Amount)">
                <Input inputMode="decimal" value={balanceAmount} onChange={(e) => setBalance(e.target.value)} placeholder="400000" />
              </Field>

              {/* Optional banquet services */}
              <div className="mt-6 rounded-xl border border-[rgb(var(--border)/0.5)] p-4">
                <button type="button" onClick={() => setWantsServices((v) => !v)} className="flex w-full items-center justify-between">
                  <div className="text-left">
                    <div className="font-medium text-[rgb(var(--text))]">Add banquet services?</div>
                    <div className="text-xs text-[rgb(var(--text-dim))]">Optional — waiters, generator, decor, cold drinks, etc.</div>
                  </div>
                  {wantsServices ? <ToggleRight className="h-7 w-7 text-gold" /> : <ToggleLeft className="h-7 w-7 text-[rgb(var(--text-dim))]" />}
                </button>

                {wantsServices && (
                  <div className="mt-4 border-t border-[rgb(var(--border)/0.4)] pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-[rgb(var(--text-muted))]">Itemized services</span>
                      <button onClick={addItem} className="flex items-center gap-1 text-xs text-gold hover:underline"><Plus className="h-3.5 w-3.5" /> Add line</button>
                    </div>
                    <div className="space-y-2">
                      {items.map((it, i) => (
                        // Wraps to two lines on a phone: the service name takes
                        // the full width, then qty / rate / subtotal / delete sit
                        // on the second line. Unwrapped, this row ran ~485px wide
                        // and pushed the delete button off a 375px screen.
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <input list="svc-presets" className="w-full min-w-0 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--gold)/0.5)] sm:w-auto sm:flex-1" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Service" />
                          <input className="w-14 shrink-0 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-2 py-2 text-right text-sm tnum outline-none sm:w-16" inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} placeholder="qty" />
                          <input className="w-20 shrink-0 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-2 py-2 text-right text-sm tnum outline-none sm:w-24" inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} placeholder="rate" />
                          <span className="ml-auto min-w-0 flex-1 text-right text-sm tnum text-[rgb(var(--text-dim))] sm:ml-0 sm:w-24 sm:flex-none">{fmtMoney((Number(it.qty) || 0) * (Number(it.rate) || 0), false)}</span>
                          <button onClick={() => removeItem(i)} aria-label="Remove service" className="shrink-0 rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:text-negative"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <datalist id="svc-presets">{SERVICE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-[rgb(var(--border)/0.4)] pt-2 text-sm">
                      <span className="text-[rgb(var(--text-muted))]">Banquet Amount</span>
                      <span className="tnum font-medium text-[rgb(var(--text))]">{fmtMoney(banquet)}</span>
                    </div>
                  </div>
                )}
              </div>

              {isEnquiry ? (
                <div className="mt-5 rounded-xl border border-[rgb(var(--gold)/0.3)] bg-[rgb(var(--gold)/0.06)] px-4 py-3 text-sm text-[rgb(var(--text-muted))]">
                  No advance is collected for an enquiry — it&apos;s a quotation only. You can convert it to a confirmed booking (and take the advance) later.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Advance paid now"><Input inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="150000" /></Field>
                  <Field label="Method"><Select value={advanceMethod} onChange={(e) => setMethod(e.target.value)}><option>CASH</option><option>BANK</option><option>CHEQUE</option><option>ONLINE</option></Select></Field>
                </div>
              )}

              <div className="mt-5">
                <Field label="Notes" hint="Prints on the slip — e.g. AC open 3 hrs, special decor, menu remarks">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    className="w-full rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--gold)/0.5)]"
                    placeholder="Any special requirements or remarks…" />
                </Field>
              </div>
            </Card>
          </FadeUp>
        </div>

        {/* Summary sticky */}
        <div>
          <FadeUp delay={0.12}>
            <Card glass className="sticky top-6 p-5">
              <h3 className="mb-4 font-display text-lg text-gold">Summary</h3>
              <div className="space-y-2 text-sm">
                {bookingDate && <div className="flex items-center justify-between text-xs text-[rgb(var(--text-dim))]"><span>Booking date</span><span className="font-medium text-[rgb(var(--text-muted))]">{fmtDateWithDay(bookingDate)}</span></div>}
                {eventDate && <div className="flex items-center justify-between text-xs text-[rgb(var(--text-dim))]"><span>Event date</span><span className="font-medium text-gold">{fmtDateWithDay(eventDate)}</span></div>}
                <div className="border-t border-[rgb(var(--border)/0.5)] pt-2 space-y-2">
                  <Row label="Balance Amount" value={balance} />
                  <Row label="Banquet Amount" value={banquet} />
                </div>
                <div className="border-t border-[rgb(var(--border)/0.5)] pt-2"><Row label={isEnquiry ? 'Estimated Total' : 'Total'} value={total} strong /></div>
                {!isEnquiry && <Row label="Advance" value={adv} muted />}
                {!isEnquiry && <div className="border-t border-[rgb(var(--gold)/0.4)] pt-2"><Row label="Balance Due" value={due} big /></div>}
              </div>
              {error && <div className="mt-4 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
              <Button className="mt-5 w-full" disabled={pending || !inputOk} onClick={submit}>{pending ? 'Saving…' : <><Check className="h-4 w-4" /> {isEnquiry ? 'Save enquiry' : 'Create booking'}</>}</Button>
              <p className="mt-2 text-center text-xs text-[rgb(var(--text-dim))]">{isEnquiry ? 'Inquiry slip # (INQ-…) is generated automatically' : 'Slip # is generated automatically'}</p>
            </Card>
          </FadeUp>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, big, muted }: { label: string; value: number; strong?: boolean; big?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? 'font-display text-base text-gold' : muted ? 'text-[rgb(var(--text-dim))]' : 'text-[rgb(var(--text-muted))]'}>{label}</span>
      <span className={`tnum ${big ? 'font-display text-lg text-gold' : strong ? 'font-semibold text-[rgb(var(--text))]' : 'text-[rgb(var(--text))]'}`}>{fmtMoney(value)}</span>
    </div>
  );
}
