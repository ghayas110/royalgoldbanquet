'use client';

import { useState, useTransition } from 'react';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, Button, Field, Input, Select, FadeUp } from '@/components/ui';
import { recordPayment } from '@/lib/actions/bookings';
import { Printer, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Booking = {
  id: number; slip_no: string; party_name: string; bride_name: string | null; groom_name: string | null;
  phone: string | null; hall: string; event_date: string; booking_date: string; shift: string;
  guest_count: number; balance_amount: number; banquet_amount: number; total_amount: number; paid_amount: number; payment_status: string;
};

export function BookingDetailClient({ booking: b, items, payments, canPay }: {
  booking: Booking; items: { label: string; qty: number; rate: number; subtotal: number }[];
  payments: { amount: number; payment_date: string; method: string; note: string | null }[]; canPay: boolean;
}) {
  const due = b.total_amount - b.paid_amount;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main detail */}
      <div className="space-y-6 lg:col-span-2">
        <FadeUp>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm text-gold">{b.slip_no}</div>
                <h1 className="mt-1 font-display text-2xl text-[rgb(var(--text))]">{b.party_name}</h1>
                <div className="mt-1 text-sm text-[rgb(var(--text-dim))]">
                  {b.bride_name && b.groom_name ? `${b.bride_name} & ${b.groom_name} · ` : ''}{b.phone ?? 'No phone'}
                </div>
              </div>
              <Link href={`/print/booking/${b.id}`} className="no-print inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm hover:bg-[rgb(var(--gold)/0.1)]"><Printer className="h-4 w-4" /> Print slip</Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Info label="Event date" value={fmtDate(b.event_date)} />
              <Info label="Shift" value={b.shift} />
              <Info label="Hall" value={b.hall} />
              <Info label="Guests" value={String(b.guest_count)} />
            </div>
          </Card>
        </FadeUp>

        <FadeUp delay={0.04}>
          <Card className="overflow-hidden">
            <div className="border-b border-[rgb(var(--border)/0.5)] px-5 py-3 font-display text-lg text-gold">Banquet services</div>
            <table className="w-full text-sm">
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
          </Card>
        </FadeUp>

        {/* Payments */}
        <FadeUp delay={0.08}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgb(var(--border)/0.5)] px-5 py-3">
              <span className="font-display text-lg text-gold">Payments</span>
              {canPay && due > 0 && <AddPaymentButton bookingId={b.id} due={due} />}
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-[rgb(var(--text-dim))]">No payments recorded.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={i} className="border-b border-[rgb(var(--border)/0.2)] last:border-0">
                      <td className="px-5 py-2.5 text-[rgb(var(--text-muted))]">{fmtDate(p.payment_date)}</td>
                      <td className="px-5 py-2.5 text-[rgb(var(--text-dim))]">{p.method}</td>
                      <td className="px-5 py-2.5 text-[rgb(var(--text-dim))]">{p.note}</td>
                      <td className="px-5 py-2.5 text-right tnum text-positive">{fmtMoney(p.amount, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </FadeUp>
      </div>

      {/* Amount summary */}
      <div>
        <FadeUp delay={0.06}>
          <Card glass className="sticky top-6 p-5">
            <h3 className="mb-4 font-display text-lg text-gold">Account</h3>
            <div className="space-y-2 text-sm">
              <Row label="Balance Amount" value={b.balance_amount} />
              <Row label="Banquet Amount" value={b.banquet_amount} />
              <div className="border-t border-[rgb(var(--border)/0.5)] pt-2"><Row label="Total" value={b.total_amount} strong /></div>
              <Row label="Paid" value={b.paid_amount} muted />
              <div className="border-t border-[rgb(var(--gold)/0.4)] pt-2"><Row label="Balance Due" value={due} big /></div>
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
