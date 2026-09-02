import { requirePermission, can } from '@/lib/session';
import { getBookings, getBookingCounts } from '@/lib/data';
import { SectionTitle, Button, FadeUp } from '@/components/ui';
import { BookingsClient } from './bookings-client';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Bookings — Skylight Ballroom & Catering' };

export default async function BookingsPage() {
  const user = await requirePermission('bookings.view');
  const canCreate = can(user.permissions, 'bookings.create');
  const [rows, counts] = await Promise.all([
    getBookings({ limit: 200 }),
    getBookingCounts(),
  ]);

  const initialRows = rows.map((b: any) => ({
    id: b.id, slip_no: b.slip_no, party_name: b.party_name, phone: b.phone,
    event_date: b.event_date, shift: b.shift, hall: b.hall, guest_count: b.guest_count,
    total_amount: Number(b.total_amount), balance_due: Number(b.balance_due),
    status: b.status, payment_status: b.payment_status,
  }));

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle
          sub={`${counts.bookings} bookings · ${counts.enquiries} enquiries`}
          right={canCreate ? <Link href="/app/bookings/new"><Button><Plus className="h-4 w-4" /> New booking</Button></Link> : undefined}
        >
          Bookings
        </SectionTitle>
      </FadeUp>

      <BookingsClient initialRows={initialRows} counts={counts} />
    </div>
  );
}
