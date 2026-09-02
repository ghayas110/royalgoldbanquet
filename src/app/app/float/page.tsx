import { requirePermission, hasPermission } from '@/lib/session';
import { getFloatLedger, getManagers, getBookingOptions } from '@/lib/data';
import { fmtDate, fmtMoney } from '@/lib/format';
import { FloatClient } from './float-client';

export const metadata = { title: 'Manager Float — Skylight Ballroom & Catering' };

export default async function FloatPage() {
  const user = await requirePermission('float.view');
  const [ledger, managers, bookings] = await Promise.all([getFloatLedger(), getManagers(), getBookingOptions()]);
  return (
    <FloatClient
      ledger={ledger}
      managers={managers.map((m) => ({ id: m.id, name: m.name }))}
      bookings={bookings.map((b: any) => ({
        value: b.id,
        label: `${b.party_name}`,
        sub: `${b.slip_no} · booked ${fmtDate(b.booking_date)} · event ${fmtDate(b.event_date)}`,
        right: fmtMoney(Number(b.total_amount) - Number(b.paid_amount), false) + ' due',
      }))}
      canDisburse={hasPermission(user, 'float.disburse')}
      canReconcile={hasPermission(user, 'float.reconcile')}
    />
  );
}
