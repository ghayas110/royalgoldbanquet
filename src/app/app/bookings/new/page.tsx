import { requirePermission } from '@/lib/session';
import { getHalls } from '@/lib/data';
import { NewBookingForm } from './new-booking-form';

export const metadata = { title: 'New Booking — Skylight Ballroom & Catering' };

export default async function NewBookingPage() {
  await requirePermission('bookings.create');
  const halls = await getHalls();
  return <NewBookingForm halls={halls.map((h: any) => ({ id: h.id, name: h.name, capacity: h.capacity, baseCharge: Number(h.base_charge) }))} />;
}
