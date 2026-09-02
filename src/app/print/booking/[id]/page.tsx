import { requirePermission } from '@/lib/session';
import { getBooking, getRules, getBrand, getEnquiryNote } from '@/lib/data';
import { notFound } from 'next/navigation';
import { PrintShell } from '@/components/print/print-shell';
import { InvoiceDoc, InquiryDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Invoice — Skylight Ballroom & Catering' };

export default async function BookingPrint({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('bookings.view');
  const { id } = await params;
  const [data, portalRules, enquiryNote, brand] = await Promise.all([
    getBooking(Number(id)), getRules(true), getEnquiryNote(), getBrand(),
  ]);
  if (!data) notFound();
  const { booking: b, items, payments, rules: bookingRules, dateChanges } = data;

  // Page 2 prints the booking's own rule list when one has been saved — the
  // owner curated it for this customer, so a rule they removed must NOT come
  // back. With nothing saved, fall back to every active rule in the portal.
  const portal = portalRules.map((r: any) => (r.body ? `${r.title} — ${r.body}` : r.title));
  const rules = bookingRules.length > 0 ? bookingRules : portal;

  const doc = {
    slip_no: b.slip_no, party_name: b.party_name,
    phone: b.phone, phone2: b.phone2 ?? null, address: b.address ?? null, hall: b.hall, event_date: b.event_date, booking_date: b.booking_date, shift: b.shift,
    guest_count: b.guest_count, balance_amount: Number(b.balance_amount), banquet_amount: Number(b.banquet_amount),
    total_amount: Number(b.total_amount), paid_amount: Number(b.paid_amount), notes: b.notes ?? null, rules, dateChanges,
    status: b.status, refunded_amount: Number(b.refunded_amount ?? 0),
    booked_by: b.booked_by ?? null,
    items: items.map((it: any) => ({ label: it.label, qty: Number(it.qty), rate: Number(it.rate), subtotal: Number(it.subtotal) })),
    payments: payments.map((p: any) => ({ amount: Number(p.amount), payment_date: p.payment_date, method: p.method, note: p.note })),
  };

  return (
    <PrintShell backHref={`/app/bookings/${id}`}>
      {b.status === 'ENQUIRY'
        ? <InquiryDoc b={doc} brand={brand} note={enquiryNote} />
        : <InvoiceDoc b={doc} brand={brand} />}
    </PrintShell>
  );
}
