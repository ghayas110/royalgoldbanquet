import { requirePermission, can } from '@/lib/session';
import { getBooking, getRules, getReviewsForBooking, getBrand } from '@/lib/data';
import { notFound } from 'next/navigation';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, Badge, FadeUp } from '@/components/ui';
import { BookingDetailClient } from './detail-client';
import { BookingReviewCard } from './review-card';
import { BookingWhatsAppCard } from './whatsapp-card';
import { BrandLockup } from '@/components/brand';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('bookings.view');
  const { id } = await params;
  const data = await getBooking(Number(id));
  if (!data) notFound();
  const { booking: b, items, payments, rules, dateChanges } = data;
  // Active rules from the library, offered as quick-add chips on the slip terms.
  const ruleLibrary = (await getRules(true)).map((r: any) => (r.body ? `${r.title} — ${r.body}` : r.title));
  const [reviews, brand] = await Promise.all([getReviewsForBooking(Number(id)), getBrand()]);

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
          id: b.id, slip_no: b.slip_no, party_name: b.party_name,
          phone: b.phone, phone2: b.phone2 ?? null, address: b.address ?? null, hall: b.hall, event_date: b.event_date, booking_date: b.booking_date, shift: b.shift,
          guest_count: b.guest_count, balance_amount: Number(b.balance_amount), banquet_amount: Number(b.banquet_amount),
          total_amount: Number(b.total_amount), paid_amount: Number(b.paid_amount), payment_status: b.payment_status,
          status: b.status, notes: b.notes ?? null,
          date_change_count: Number(b.date_change_count ?? 0),
          refunded_amount: Number(b.refunded_amount ?? 0),
        }}
        canConvert={can(user.permissions, 'bookings.create')}
        items={items.map((it: any) => ({ label: it.label, qty: Number(it.qty), rate: Number(it.rate), subtotal: Number(it.subtotal) }))}
        payments={payments.map((p: any) => ({ id: p.id, booking_id: p.booking_id, amount: Number(p.amount), payment_date: p.payment_date, method: p.method, note: p.note }))}
        canPay={can(user.permissions, 'payments.record')}
        canEdit={can(user.permissions, 'bookings.edit')}
        rules={rules}
        ruleLibrary={ruleLibrary}
        dateChanges={dateChanges}
      />

      {/* Confirmation message. Enquiries are quotations, not confirmed
          bookings, and a cancelled one must never be "confirmed" to a guest. */}
      {b.status !== 'ENQUIRY' && b.status !== 'CANCELLED' && (
        <div className="no-print">
          <BookingWhatsAppCard
            booking={{
              bookingId: b.id,
              slipNo: b.slip_no,
              partyName: b.party_name,
              phone: b.phone ?? null,
              hall: b.hall,
              eventDate: b.event_date,
              shift: b.shift,
              guestCount: Number(b.guest_count ?? 0),
              totalAmount: Number(b.total_amount),
              paidAmount: Number(b.paid_amount),
            }}
            brand={brand}
          />
        </div>
      )}

      {/* Guest feedback — enquiries have had no event yet, so no card. */}
      {b.status !== 'ENQUIRY' && (
        <div className="no-print">
          <BookingReviewCard
            bookingId={b.id}
            partyName={b.party_name}
            phone={b.phone ?? null}
            reviews={reviews}
            brandName={brand.name}
          />
        </div>
      )}
    </div>
  );
}
