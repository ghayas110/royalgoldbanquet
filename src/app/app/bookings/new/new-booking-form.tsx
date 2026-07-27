'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Field, Input, Select, FadeUp } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
import { createBooking } from '@/lib/actions/bookings';
import { Plus, Trash2, Check, ToggleLeft, ToggleRight } from 'lucide-react';

type Item = { label: string; qty: string; rate: string };
type Hall = { id: number; name: string; capacity: number; baseCharge: number };
const PRESET_SERVICES = ['Gents Waiters', 'Ladies Waiters', 'Petrol', 'Coffee Machine', 'Water Cooler', 'Generator', 'Valet', 'Ice', 'Cold Drinks', 'Tea Hall', 'Decor'];

export function NewBookingForm({ halls }: { halls: Hall[] }) {
  const router = useRouter();
  const [partyName, setPartyName] = useState('');
  const [brideName, setBride] = useState('');
  const [groomName, setGroom] = useState('');
  const [phone, setPhone] = useState('');
  const [hallId, setHallId] = useState(halls[0]?.id ?? 0);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventDate, setEventDate] = useState('');
  const [shift, setShift] = useState<'LUNCH' | 'DINNER'>('DINNER');
  const [guestCount, setGuests] = useState('');
  const [balanceAmount, setBalance] = useState(String(halls[0]?.baseCharge || ''));
  const [wantsServices, setWantsServices] = useState(true);
  const [items, setItems] = useState<Item[]>([{ label: 'Gents Waiters', qty: '10', rate: '800' }]);
  const [advance, setAdvance] = useState('');
  const [advanceMethod, setMethod] = useState('CASH');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function onHallChange(id: number) {
    setHallId(id);
    const h = halls.find((x) => x.id === id);
    // Auto-fill the hall payment from the hall's base charge (still editable).
    if (h && h.baseCharge > 0) setBalance(String(h.baseCharge));
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
        partyName, brideName: brideName || null, groomName: groomName || null, phone: phone || null,
        hallId, bookingDate, eventDate, shift, guestCount: Number(guestCount) || 0,
        balanceAmount: balance,
        serviceItems: wantsServices ? items.filter((it) => it.label).map((it) => ({ label: it.label, qty: Number(it.qty) || 0, rate: Number(it.rate) || 0 })) : [],
        advanceAmount: adv, advanceMethod,
      });
      if (res.ok) router.push(`/app/bookings/${res.id}?created=1`);
      else setError(res.error);
    });
  }

  const inputOk = partyName && eventDate && hallId;

  return (
    <div className="space-y-6">
      <FadeUp><SectionTitle sub="Two-amount model: hall charge + itemized services">New Booking</SectionTitle></FadeUp>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Party details */}
          <FadeUp delay={0.03}>
            <Card className="p-5">
              <h3 className="mb-4 font-display text-lg text-gold">Party details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Party name"><Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g. Ahmed–Zoya Wedding" /></Field>
                <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" /></Field>
                <Field label="Bride name"><Input value={brideName} onChange={(e) => setBride(e.target.value)} /></Field>
                <Field label="Groom name"><Input value={groomName} onChange={(e) => setGroom(e.target.value)} /></Field>
              </div>
            </Card>
          </FadeUp>

          {/* Date & venue */}
          <FadeUp delay={0.06}>
            <Card className="p-5">
              <h3 className="mb-4 font-display text-lg text-gold">Date &amp; venue</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hall" hint="Hall payment auto-fills below"><Select value={hallId} onChange={(e) => onHallChange(Number(e.target.value))}>{halls.map((h) => <option key={h.id} value={h.id}>{h.name} (cap. {h.capacity})</option>)}</Select></Field>
                <Field label="Shift"><Select value={shift} onChange={(e) => setShift(e.target.value as 'LUNCH' | 'DINNER')}><option value="LUNCH">Lunch</option><option value="DINNER">Dinner</option></Select></Field>
                <Field label="Booking date"><Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} /></Field>
                <Field label="Event date"><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></Field>
                <Field label="Guest count"><Input inputMode="numeric" value={guestCount} onChange={(e) => setGuests(e.target.value)} placeholder="500" /></Field>
              </div>
            </Card>
          </FadeUp>

          {/* Amounts + itemizer */}
          <FadeUp delay={0.09}>
            <Card className="p-5">
              <h3 className="mb-1 font-display text-lg text-gold">Hall Payment</h3>
              <p className="mb-4 text-xs text-[rgb(var(--text-dim))]">The hall/venue charge — the banquet&apos;s core credit. Auto-filled from the hall, editable.</p>
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
                        <div key={i} className="flex items-center gap-2">
                          <input list="svc-presets" className="flex-1 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--gold)/0.5)]" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Service" />
                          <input className="w-16 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-2 py-2 text-right text-sm tnum outline-none" inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} placeholder="qty" />
                          <input className="w-24 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-2 py-2 text-right text-sm tnum outline-none" inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} placeholder="rate" />
                          <span className="w-24 text-right text-sm tnum text-[rgb(var(--text-dim))]">{fmtMoney((Number(it.qty) || 0) * (Number(it.rate) || 0), false)}</span>
                          <button onClick={() => removeItem(i)} className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:text-negative"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <datalist id="svc-presets">{PRESET_SERVICES.map((s) => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-[rgb(var(--border)/0.4)] pt-2 text-sm">
                      <span className="text-[rgb(var(--text-muted))]">Banquet Amount</span>
                      <span className="tnum font-medium text-[rgb(var(--text))]">{fmtMoney(banquet)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Advance paid now"><Input inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="150000" /></Field>
                <Field label="Method"><Select value={advanceMethod} onChange={(e) => setMethod(e.target.value)}><option>CASH</option><option>BANK</option><option>CHEQUE</option><option>ONLINE</option></Select></Field>
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
                <Row label="Balance Amount" value={balance} />
                <Row label="Banquet Amount" value={banquet} />
                <div className="border-t border-[rgb(var(--border)/0.5)] pt-2"><Row label="Total" value={total} strong /></div>
                <Row label="Advance" value={adv} muted />
                <div className="border-t border-[rgb(var(--gold)/0.4)] pt-2"><Row label="Balance Due" value={due} big /></div>
              </div>
              {error && <div className="mt-4 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
              <Button className="mt-5 w-full" disabled={pending || !inputOk} onClick={submit}>{pending ? 'Creating…' : <><Check className="h-4 w-4" /> Create booking</>}</Button>
              <p className="mt-2 text-center text-xs text-[rgb(var(--text-dim))]">Slip # is generated automatically</p>
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
