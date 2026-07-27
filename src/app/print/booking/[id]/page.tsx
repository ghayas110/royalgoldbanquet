import { requirePermission } from '@/lib/session';
import { getBooking } from '@/lib/data';
import { notFound } from 'next/navigation';
import { PrintShell } from '@/components/print/print-shell';
import { InvoiceDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Invoice — Royal Gold Banquet' };

export default async function BookingPrint({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('bookings.view');
  const { id } = await params;
  const data = await getBooking(Number(id));
  if (!data) notFound();
  const { booking: b, items, payments } = data;

  return (
    <PrintShell backHref={`/app/bookings/${id}`}>
      <InvoiceDoc b={{
        slip_no: b.slip_no, party_name: b.party_name, bride_name: b.bride_name, groom_name: b.groom_name,
        phone: b.phone, hall: b.hall, event_date: b.event_date, booking_date: b.booking_date, shift: b.shift,
        guest_count: b.guest_count, balance_amount: Number(b.balance_amount), banquet_amount: Number(b.banquet_amount),
        total_amount: Number(b.total_amount), paid_amount: Number(b.paid_amount),
        items: items.map((it: any) => ({ label: it.label, qty: Number(it.qty), rate: Number(it.rate), subtotal: Number(it.subtotal) })),
        payments: payments.map((p: any) => ({ amount: Number(p.amount), payment_date: p.payment_date, method: p.method, note: p.note })),
      }} />
    </PrintShell>
  );
}
