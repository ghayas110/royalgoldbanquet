import { requirePermission } from '@/lib/session';
import { getAllHalls } from '@/lib/data';
import { HallsClient } from './halls-client';

export const metadata = { title: 'Halls — Skylight Ballroom & Catering' };

export default async function HallsPage() {
  await requirePermission('halls.manage');
  const halls = await getAllHalls();
  return <HallsClient halls={halls.map((h: any) => ({
    id: h.id, name: h.name, capacity: h.capacity, baseCharge: Number(h.base_charge),
    description: h.description, active: h.is_active === 1, bookingCount: Number(h.booking_count),
  }))} />;
}
