'use server';

import { z } from 'zod';
import { withTransaction, queryOne, execute } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

const serviceItem = z.object({
  label: z.string().min(1).max(160),
  qty: z.number().min(0).max(100000),
  rate: z.number().min(0).max(99999999),
});

const bookingSchema = z.object({
  partyName: z.string().min(2, 'Party name required'),
  brideName: z.string().max(120).optional().nullable(),
  groomName: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  hallId: z.number().int().positive(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.enum(['LUNCH', 'DINNER']),
  guestCount: z.number().int().min(0).max(100000),
  balanceAmount: z.number().min(0).max(999999999),
  serviceItems: z.array(serviceItem),
  advanceAmount: z.number().min(0).max(999999999),
  advanceMethod: z.string().max(40).default('CASH'),
});

export type BookingResult = { ok: true; slip: string; id: number } | { ok: false; error: string };

async function nextSlip(): Promise<string> {
  const year = new Date().getFullYear();
  const row = await queryOne<{ slip_no: string }>(
    `SELECT slip_no FROM bookings WHERE slip_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`RGB-${year}-%`],
  );
  let n = 0;
  if (row?.slip_no) { const parts = row.slip_no.split('-'); n = Number(parts[2]) || 0; }
  return `RGB-${year}-${String(n + 1).padStart(2, '0')}`;
}

export async function createBooking(input: unknown): Promise<BookingResult> {
  const actor = await assertPermission('bookings.create');
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  // Conflict detection: same hall + date + shift
  const conflict = await queryOne(
    `SELECT id FROM bookings WHERE hall_id = ? AND event_date = ? AND shift = ? AND status != 'CANCELLED'`,
    [d.hallId, d.eventDate, d.shift],
  );
  if (conflict) return { ok: false, error: `That hall is already booked for ${d.shift.toLowerCase()} on this date.` };

  const banquet = d.serviceItems.reduce((s, it) => s + it.qty * it.rate, 0);
  const total = d.balanceAmount + banquet;
  if (d.advanceAmount > total) return { ok: false, error: 'Advance cannot exceed the total.' };
  const paymentStatus = d.advanceAmount >= total && total > 0 ? 'SETTLED' : d.advanceAmount > 0 ? 'PARTIAL' : 'PENDING';
  const status = paymentStatus === 'SETTLED' ? 'COMPLETED' : 'CONFIRMED';

  try {
    const result = await withTransaction(async (tx) => {
      const slip = await nextSlip();
      const pr = await tx.execute(
        `INSERT INTO parties (party_name, bride_name, groom_name, phone) VALUES (?,?,?,?)`,
        [d.partyName, d.brideName || null, d.groomName || null, d.phone || null],
      );
      const partyId = pr.insertId;

      const br = await tx.execute(
        `INSERT INTO bookings (slip_no, party_id, hall_id, booking_date, event_date, shift, guest_count,
           balance_amount, banquet_amount, total_amount, advance_amount, paid_amount, status, payment_status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [slip, partyId, d.hallId, d.bookingDate, d.eventDate, d.shift, d.guestCount,
          d.balanceAmount, banquet, total, d.advanceAmount, d.advanceAmount, status, paymentStatus, actor.id],
      );
      const bookingId = br.insertId;

      for (const it of d.serviceItems) {
        await tx.execute(
          `INSERT INTO booking_service_items (booking_id, label, qty, rate, subtotal) VALUES (?,?,?,?,?)`,
          [bookingId, it.label, it.qty, it.rate, it.qty * it.rate],
        );
      }
      if (d.advanceAmount > 0) {
        await tx.execute(
          `INSERT INTO payments (booking_id, amount, payment_date, method, received_by, note) VALUES (?,?,?,?,?,?)`,
          [bookingId, d.advanceAmount, d.bookingDate, d.advanceMethod, actor.id, 'Advance at booking'],
        );
      }
      return { bookingId, slip };
    });

    await audit({ userId: actor.id, action: 'CREATE', entity: 'booking', entityId: result.bookingId, after: { slip: result.slip, total, party: d.partyName } });
    revalidatePath('/app/bookings');
    revalidatePath('/app/calendar');
    return { ok: true, slip: result.slip, id: result.bookingId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const paymentSchema = z.object({
  bookingId: z.number().int().positive(),
  amount: z.number().positive().max(999999999),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().max(40).default('CASH'),
  note: z.string().max(255).optional().nullable(),
});

export async function recordPayment(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('payments.record');
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, amount, paymentDate, method, note } = parsed.data;

  const booking = await queryOne<any>(`SELECT total_amount, paid_amount FROM bookings WHERE id = ?`, [bookingId]);
  if (!booking) return { ok: false, error: 'Booking not found.' };
  const newPaid = Number(booking.paid_amount) + amount;
  if (newPaid > Number(booking.total_amount) + 0.01) return { ok: false, error: 'Payment exceeds the outstanding balance.' };
  const payStatus = newPaid >= Number(booking.total_amount) ? 'SETTLED' : 'PARTIAL';

  await execute(`INSERT INTO payments (booking_id, amount, payment_date, method, received_by, note) VALUES (?,?,?,?,?,?)`,
    [bookingId, amount, paymentDate, method, actor.id, note || 'Payment']);
  await execute(`UPDATE bookings SET paid_amount = ?, payment_status = ?, status = IF(?='SETTLED','COMPLETED',status) WHERE id = ?`,
    [newPaid, payStatus, payStatus, bookingId]);
  await audit({ userId: actor.id, action: 'PAYMENT', entity: 'booking', entityId: bookingId, after: { amount, newPaid, payStatus } });
  revalidatePath('/app/bookings');
  revalidatePath(`/app/bookings/${bookingId}`);
  return { ok: true };
}

export async function setBookingStatus(id: number, status: 'ENQUIRY' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  await execute(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'booking', entityId: id, after: { status } });
  revalidatePath('/app/bookings');
  return { ok: true };
}
