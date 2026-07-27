import { requirePermission, can } from '@/lib/session';
import { getBooking } from '@/lib/data';
import { notFound } from 'next/navigation';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, Badge, FadeUp } from '@/components/ui';
import { BookingDetailClient } from './detail-client';
import { BrandLockup } from '@/components/brand';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('bookings.view');
  const { id } = await params;
  const data = await getBooking(Number(id));
  if (!data) notFound();
  const { booking: b, items, payments } = data;

  return (
    <div className="space-y-6">
      <FadeUp className="no-print flex items-center justify-between">
        <Link href="/app/bookings" className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] hover:text-gold"><ArrowLeft className="h-4 w-4" /> All bookings</Link>
        <div className="flex items-center gap-2">
          <Badge tone={b.status === 'COMPLETED' ? 'green' : b.status === 'CANCELLED' ? 'red' : 'gold'}>{b.status}</Badge>
          <Badge tone={b.payment_status === 'SETTLED' ? 'green' : b.payment_status === 'PARTIAL' ? 'amber' : 'muted'}>{b.payment_status}</Badge>
        </div>
      </FadeUp>

      <BookingDetailClient
        booking={{
          id: b.id, slip_no: b.slip_no, party_name: b.party_name, bride_name: b.bride_name, groom_name: b.groom_name,
          phone: b.phone, hall: b.hall, event_date: b.event_date, booking_date: b.booking_date, shift: b.shift,
          guest_count: b.guest_count, balance_amount: Number(b.balance_amount), banquet_amount: Number(b.banquet_amount),
          total_amount: Number(b.total_amount), paid_amount: Number(b.paid_amount), payment_status: b.payment_status,
        }}
        items={items.map((it: any) => ({ label: it.label, qty: Number(it.qty), rate: Number(it.rate), subtotal: Number(it.subtotal) }))}
        payments={payments.map((p: any) => ({ amount: Number(p.amount), payment_date: p.payment_date, method: p.method, note: p.note }))}
        canPay={can(user.permissions, 'payments.record')}
      />
    </div>
  );
}
