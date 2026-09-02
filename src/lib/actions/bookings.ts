'use server';

import { z } from 'zod';
import { withTransaction, queryOne, execute } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { isLiveCooking } from '@/lib/service-presets';
import { getBookings } from '@/lib/data';
import { revalidatePath } from 'next/cache';
import { notifyBooking } from '@/lib/notify';

const serviceItem = z.object({
  label: z.string().min(1).max(160),
  qty: z.number().min(0).max(100000),
  rate: z.number().min(0).max(99999999),
  /** Draws this line's quantity out of stock when set. */
  stockItemId: z.number().int().positive().nullable().optional(),
});

/**
 * Writes a booking's service lines and, for any line tied to a stock item,
 * the matching ISSUE movement. Movements are tagged `source = 'BOOKING'` so
 * re-saving the booking can replace them without touching manual entries.
 */
async function writeServiceItems(
  tx: { execute: (sql: string, params?: unknown[]) => Promise<{ insertId: number }> },
  bookingId: number,
  eventDate: string,
  items: { label: string; qty: number; rate: number; stockItemId?: number | null }[],
  actorId: number,
): Promise<number> {
  let issued = 0;
  for (const it of items) {
    // Live Cooking is stamped here rather than asked for in the form: staff
    // pick the service by name, and every write path funnels through this
    // helper, so the tag can never be forgotten on one screen and set on
    // another.
    const kind = isLiveCooking(it.label) ? 'LIVE_COOKING' : 'BANQUET';
    const res = await tx.execute(
      `INSERT INTO booking_service_items (booking_id, stock_item_id, label, service_kind, qty, rate, subtotal)
       VALUES (?,?,?,?,?,?,?)`,
      [bookingId, it.stockItemId ?? null, it.label, kind, it.qty, it.rate, it.qty * it.rate],
    );
    if (it.stockItemId && it.qty > 0) {
      // The cost is SNAPSHOTTED onto the movement, not left to be read back
      // from the item later. Stock costs change, and a report of what an event
      // earned must use what the goods cost when they were issued, not what
      // they cost today.
      await tx.execute(
        `INSERT INTO stock_movements
           (item_id, kind, qty, unit_cost, booking_id, service_item_id, moved_on, note, created_by, source)
         SELECT ?, 'ISSUE', ?, si.unit_cost, ?, ?, ?, ?, ?, 'BOOKING'
           FROM stock_items si WHERE si.id = ?`,
        [it.stockItemId, it.qty, bookingId, res.insertId, eventDate,
         `Booked service: ${it.label}`, actorId, it.stockItemId],
      );
      issued++;
    }
  }
  return issued;
}


const bookingSchema = z.object({
  partyName: z.string().min(2, 'Party name required'),
  phone: z.string().max(40).optional().nullable(),
  phone2: z.string().max(40).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  hallId: z.number().int().positive(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.enum(['LUNCH', 'DINNER']),
  guestCount: z.number().int().min(0).max(100000),
  balanceAmount: z.number().min(0).max(999999999),
  serviceItems: z.array(serviceItem),
  advanceAmount: z.number().min(0).max(999999999),
  advanceMethod: z.string().max(40).default('CASH'),
  notes: z.string().max(2000).optional().nullable(),
  // When true the record is saved as a tentative ENQUIRY / quotation:
  // no slot is locked, no advance is taken, and it prints a distinct inquiry slip.
  isEnquiry: z.boolean().optional().default(false),
});

export type BookingResult = { ok: true; slip: string; id: number; enquiry: boolean } | { ok: false; error: string };

/** The transaction helpers `nextSlip` needs — a subset of withTransaction's. */
type SlipTx = {
  queryOne: <R>(sql: string, params?: unknown[]) => Promise<R | null>;
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
};

/**
 * Next slip number in a given series. SKY = confirmed bookings, INQ = enquiries.
 *
 * Backed by a counter in `settings` that only ever goes UP, because an invoice
 * number is not a row id — once it has been printed and handed to a customer
 * it can never be given to a second one.
 *
 * Deriving the number from the bookings table cannot achieve that, however it
 * is written. "Newest row + 1" reissues as soon as the latest booking is
 * deleted, and so does MAX(number) + 1 — delete SKY-2026-18 and both hand
 * SKY-2026-18 straight back out. Only a counter that ignores deletions is safe.
 *
 * The counter seeds itself from the highest slip already in the table, so an
 * existing database carries on from where it was rather than restarting at 1.
 * Runs inside the caller's transaction so two simultaneous bookings cannot be
 * handed the same number.
 */
async function nextSlip(prefix: 'SKY' | 'INQ', tx: SlipTx): Promise<string> {
  const year = new Date().getFullYear();
  const key = `slip_seq.${prefix}.${year}`;

  const seeded = await tx.queryOne<{ n: number | string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(slip_no, '-', -1) AS UNSIGNED)), 0) AS n
       FROM bookings WHERE slip_no LIKE ?`,
    [`${prefix}-${year}-%`],
  );
  // MySQL returns CAST(... AS UNSIGNED) as a STRING, so without Number() the
  // arithmetic below concatenates: '17' + 1 = '171'.
  const floor = Number(seeded?.n ?? 0);

  // Both branches leave `value` holding the number being issued now. GREATEST
  // is what stops a deletion from winding the counter back.
  await tx.execute(
    `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = GREATEST(CAST(\`value\` AS UNSIGNED), ?) + 1`,
    [key, String(floor + 1), floor],
  );
  const row = await tx.queryOne<{ value: string }>(
    `SELECT \`value\` FROM settings WHERE \`key\` = ?`, [key],
  );

  const n = Number(row?.value ?? floor + 1);
  return `${prefix}-${year}-${String(n).padStart(2, '0')}`;
}

/** True when a CONFIRMED/COMPLETED booking already holds this hall/date/shift. */
async function slotTaken(hallId: number, eventDate: string, shift: string, excludeId = 0): Promise<boolean> {
  const conflict = await queryOne(
    `SELECT id FROM bookings
       WHERE hall_id = ? AND event_date = ? AND shift = ?
         AND status NOT IN ('CANCELLED','ENQUIRY') AND id <> ?`,
    [hallId, eventDate, shift, excludeId],
  );
  return !!conflict;
}

export async function createBooking(input: unknown): Promise<BookingResult> {
  const actor = await assertPermission('bookings.create');
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  // Enquiries are tentative and never lock a slot; confirmed bookings do.
  if (!d.isEnquiry && (await slotTaken(d.hallId, d.eventDate, d.shift))) {
    return { ok: false, error: `That hall is already booked for ${d.shift.toLowerCase()} on this date.` };
  }

  const banquet = d.serviceItems.reduce((s, it) => s + it.qty * it.rate, 0);
  const total = d.balanceAmount + banquet;
  // An enquiry carries no advance — it is only a quotation.
  const advance = d.isEnquiry ? 0 : d.advanceAmount;
  if (advance > total) return { ok: false, error: 'Advance cannot exceed the total.' };
  const paymentStatus = advance >= total && total > 0 ? 'SETTLED' : advance > 0 ? 'PARTIAL' : 'PENDING';
  const status = d.isEnquiry ? 'ENQUIRY' : paymentStatus === 'SETTLED' ? 'COMPLETED' : 'CONFIRMED';

  try {
    const result = await withTransaction(async (tx) => {
      const slip = await nextSlip(d.isEnquiry ? 'INQ' : 'SKY', tx);
      const pr = await tx.execute(
        `INSERT INTO parties (party_name, phone, phone2, address) VALUES (?,?,?,?)`,
        [d.partyName, d.phone || null, d.phone2 || null, d.address || null],
      );
      const partyId = pr.insertId;

      const br = await tx.execute(
        `INSERT INTO bookings (slip_no, party_id, hall_id, booking_date, event_date, shift, guest_count,
           balance_amount, banquet_amount, total_amount, advance_amount, paid_amount, status, payment_status, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [slip, partyId, d.hallId, d.bookingDate, d.eventDate, d.shift, d.guestCount,
          d.balanceAmount, banquet, total, advance, advance, status, paymentStatus, d.notes || null, actor.id],
      );
      const bookingId = br.insertId;

      await writeServiceItems(tx, bookingId, d.eventDate, d.serviceItems, actor.id);

      if (advance > 0) {
        await tx.execute(
          `INSERT INTO payments (booking_id, amount, payment_date, method, received_by, note) VALUES (?,?,?,?,?,?)`,
          [bookingId, advance, d.bookingDate, d.advanceMethod, actor.id, 'Advance at booking'],
        );
      }
      const hallRow = await tx.queryOne<{ name: string }>(`SELECT name FROM halls WHERE id = ?`, [d.hallId]);
      return { bookingId, slip, hallName: hallRow?.name ?? 'Hall' };
    });

    await audit({ userId: actor.id, action: 'CREATE', entity: 'booking', entityId: result.bookingId, after: { slip: result.slip, total, party: d.partyName, enquiry: d.isEnquiry } });

    // Alert the rest of the team. Awaited but never allowed to throw, so a
    // push outage can't turn a saved booking into an error for the operator.
    await notifyBooking({
      isEnquiry: !!d.isEnquiry,
      bookingId: result.bookingId,
      slipNo: result.slip,
      partyName: d.partyName,
      hall: result.hallName,
      eventDate: d.eventDate,
      shift: d.shift,
      amount: total,
      createdBy: actor.id,
    }).catch(() => undefined);

    revalidatePath('/app/bookings');
    revalidatePath('/app/calendar');
    return { ok: true, slip: result.slip, id: result.bookingId, enquiry: d.isEnquiry };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const convertSchema = z.object({
  bookingId: z.number().int().positive(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  advanceAmount: z.number().min(0).max(999999999).default(0),
  advanceMethod: z.string().max(40).default('CASH'),
  /**
   * The hall charge, as finally agreed. An enquiry quotes an estimate, and the
   * number that gets shaken hands on is usually not that estimate, so it is
   * settled here rather than forcing a separate edit before converting.
   * Omitted leaves whatever the enquiry carried.
   */
  balanceAmount: z.number().min(0).max(999999999).optional(),
});

/**
 * Convert a tentative ENQUIRY into a real booking in place: assign a proper
 * RGB slip, lock the slot (rejecting if another booking now holds it), and
 * optionally record the confirming advance.
 */
export async function convertEnquiry(input: unknown): Promise<BookingResult> {
  const actor = await assertPermission('bookings.create');
  const parsed = convertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, bookingDate, advanceAmount, advanceMethod, balanceAmount } = parsed.data;

  const b = await queryOne<any>(
    `SELECT id, hall_id, event_date, shift, balance_amount, banquet_amount, total_amount, status
       FROM bookings WHERE id = ?`,
    [bookingId],
  );
  if (!b) return { ok: false, error: 'Enquiry not found.' };
  if (b.status !== 'ENQUIRY') return { ok: false, error: 'This booking is not an enquiry.' };
  if (await slotTaken(b.hall_id, b.event_date, b.shift, bookingId)) {
    return { ok: false, error: `That hall is already booked for ${String(b.shift).toLowerCase()} on this date.` };
  }

  // The services are whatever the enquiry already lists; only the hall charge
  // is settled here, so the total is rebuilt from the new hall figure plus the
  // untouched services rather than taken from the stored estimate.
  const banquet = Number(b.banquet_amount);
  const balance = balanceAmount ?? Number(b.balance_amount);
  const total = balance + banquet;
  if (advanceAmount > total) return { ok: false, error: 'Advance cannot exceed the total.' };
  const paymentStatus = advanceAmount >= total && total > 0 ? 'SETTLED' : advanceAmount > 0 ? 'PARTIAL' : 'PENDING';
  const status = paymentStatus === 'SETTLED' ? 'COMPLETED' : 'CONFIRMED';

  try {
    const slip = await withTransaction(async (tx) => {
      const newSlip = await nextSlip('SKY', tx);
      await tx.execute(
        `UPDATE bookings SET slip_no = ?, booking_date = ?, balance_amount = ?, total_amount = ?,
           advance_amount = ?, paid_amount = ?, status = ?, payment_status = ? WHERE id = ?`,
        [newSlip, bookingDate, balance, total, advanceAmount, advanceAmount, status, paymentStatus, bookingId],
      );
      if (advanceAmount > 0) {
        await tx.execute(
          `INSERT INTO payments (booking_id, amount, payment_date, method, received_by, note) VALUES (?,?,?,?,?,?)`,
          [bookingId, advanceAmount, bookingDate, advanceMethod, actor.id, 'Advance on confirmation'],
        );
      }
      return newSlip;
    });

    await audit({ userId: actor.id, action: 'CONVERT', entity: 'booking', entityId: bookingId, after: { slip, status, advance: advanceAmount } });

    // An enquiry becoming a real booking is worth an alert of its own.
    const info = await queryOne<any>(
      `SELECT p.party_name, h.name AS hall, b.event_date, b.shift, b.total_amount
         FROM bookings b JOIN parties p ON p.id = b.party_id JOIN halls h ON h.id = b.hall_id
        WHERE b.id = ?`,
      [bookingId],
    );
    if (info) {
      await notifyBooking({
        isEnquiry: false,
        bookingId,
        slipNo: slip,
        partyName: info.party_name,
        hall: info.hall,
        eventDate: info.event_date,
        shift: info.shift,
        amount: Number(info.total_amount ?? 0),
        createdBy: actor.id,
      }).catch(() => undefined);
    }

    revalidatePath('/app/bookings');
    revalidatePath(`/app/bookings/${bookingId}`);
    revalidatePath('/app/calendar');
    return { ok: true, slip, id: bookingId, enquiry: false };
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

const updatePaymentSchema = z.object({
  paymentId: z.number().int().positive(),
  bookingId: z.number().int().positive(),
  amount: z.number().positive().max(999999999),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().max(40).default('CASH'),
  note: z.string().max(255).optional().nullable(),
});

export async function updatePayment(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('payments.record');
  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { paymentId, bookingId, amount, paymentDate, method, note } = parsed.data;

  const b = await queryOne<any>(`SELECT total_amount, paid_amount, status FROM bookings WHERE id = ?`, [bookingId]);
  if (!b) return { ok: false, error: 'Booking not found.' };

  const existingPayment = await queryOne<any>(`SELECT id FROM payments WHERE id = ? AND booking_id = ?`, [paymentId, bookingId]);
  if (!existingPayment) return { ok: false, error: 'Payment record not found.' };

  const otherPaymentsRow = await queryOne<any>(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE booking_id = ? AND id != ?`, [bookingId, paymentId]);
  const otherPaid = Number(otherPaymentsRow?.total ?? 0);
  const newTotalPaid = otherPaid + amount;
  const totalAmount = Number(b.total_amount);

  if (totalAmount > 0 && newTotalPaid > totalAmount + 0.01) {
    return { ok: false, error: `Updated total paid (${newTotalPaid.toLocaleString()}) cannot exceed booking total (${totalAmount.toLocaleString()}).` };
  }

  const payStatus = newTotalPaid >= totalAmount && totalAmount > 0 ? 'SETTLED' : newTotalPaid > 0 ? 'PARTIAL' : 'PENDING';

  try {
    await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE payments SET amount = ?, payment_date = ?, method = ?, note = ? WHERE id = ? AND booking_id = ?`,
        [amount, paymentDate, method, note || null, paymentId, bookingId],
      );
      await tx.execute(
        `UPDATE bookings SET paid_amount = ?, payment_status = ?, status = IF(status IN ('ENQUIRY','CANCELLED','RETURNED'), status, IF(? = 'SETTLED', 'COMPLETED', 'CONFIRMED')) WHERE id = ?`,
        [newTotalPaid, payStatus, payStatus, bookingId],
      );
    });
    await audit({ userId: actor.id, action: 'UPDATE_PAYMENT', entity: 'booking', entityId: bookingId, after: { paymentId, amount, newTotalPaid, payStatus } });
    revalidatePath('/app/bookings');
    revalidatePath(`/app/bookings/${bookingId}`);
    revalidatePath('/app/calendar');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const deletePaymentSchema = z.object({
  paymentId: z.number().int().positive(),
  bookingId: z.number().int().positive(),
});

export async function deletePayment(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('payments.record');
  const parsed = deletePaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { paymentId, bookingId } = parsed.data;

  const b = await queryOne<any>(`SELECT total_amount, paid_amount, status FROM bookings WHERE id = ?`, [bookingId]);
  if (!b) return { ok: false, error: 'Booking not found.' };

  const existingPayment = await queryOne<any>(`SELECT id FROM payments WHERE id = ? AND booking_id = ?`, [paymentId, bookingId]);
  if (!existingPayment) return { ok: false, error: 'Payment record not found.' };

  try {
    let newTotalPaid = 0;
    let payStatus = 'PENDING';

    await withTransaction(async (tx) => {
      await tx.execute(`DELETE FROM payments WHERE id = ? AND booking_id = ?`, [paymentId, bookingId]);
      const res = await tx.queryOne<any>(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE booking_id = ?`, [bookingId]);
      newTotalPaid = Number(res?.total ?? 0);
      const totalAmount = Number(b.total_amount);
      payStatus = newTotalPaid >= totalAmount && totalAmount > 0 ? 'SETTLED' : newTotalPaid > 0 ? 'PARTIAL' : 'PENDING';

      await tx.execute(
        `UPDATE bookings SET paid_amount = ?, payment_status = ?, status = IF(status IN ('ENQUIRY','CANCELLED','RETURNED'), status, IF(? = 'SETTLED', 'COMPLETED', IF(status = 'COMPLETED', 'CONFIRMED', status))) WHERE id = ?`,
        [newTotalPaid, payStatus, payStatus, bookingId],
      );
    });
    await audit({ userId: actor.id, action: 'DELETE_PAYMENT', entity: 'booking', entityId: bookingId, after: { paymentId, newTotalPaid, payStatus } });
    revalidatePath('/app/bookings');
    revalidatePath(`/app/bookings/${bookingId}`);
    revalidatePath('/app/calendar');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const editServicesSchema = z.object({
  bookingId: z.number().int().positive(),
  serviceItems: z.array(serviceItem),
  balanceAmount: z.number().min(0).max(999999999).optional(),
});

/**
 * Replace a booking's banquet services and re-derive the totals.
 *
 * Needed because services are usually agreed AFTER the enquiry is raised, so
 * both enquiries and confirmed bookings must stay editable. Never lets the new
 * total fall below what has already been paid.
 */
export async function updateBookingServices(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  const parsed = editServicesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, serviceItems } = parsed.data;

  const b = await queryOne<any>(
    `SELECT balance_amount, paid_amount, status, event_date, guest_count FROM bookings WHERE id = ?`,
    [bookingId],
  );
  if (!b) return { ok: false, error: 'Booking not found.' };
  const ev = b;

  const balance = parsed.data.balanceAmount ?? Number(b.balance_amount);
  const banquet = serviceItems.reduce((s, it) => s + it.qty * it.rate, 0);
  const total = balance + banquet;
  const paid = Number(b.paid_amount);
  if (total < paid - 0.01) {
    return { ok: false, error: `Total (${total.toLocaleString()}) can't be less than the ${paid.toLocaleString()} already paid.` };
  }
  const paymentStatus = paid >= total && total > 0 ? 'SETTLED' : paid > 0 ? 'PARTIAL' : 'PENDING';

  try {
    await withTransaction(async (tx) => {
      // Drop the lines and the stock they drew, then write both afresh. Only
      // `source = 'BOOKING'` movements go — anything entered by hand stays.
      await tx.execute(
        `DELETE FROM stock_movements WHERE booking_id = ? AND source = 'BOOKING'`, [bookingId],
      );
      await tx.execute(`DELETE FROM booking_service_items WHERE booking_id = ?`, [bookingId]);
      await writeServiceItems(tx, bookingId, ev.event_date, serviceItems, actor.id);
      // An enquiry stays an enquiry — editing its quote must not confirm it.
      await tx.execute(
        `UPDATE bookings SET balance_amount = ?, banquet_amount = ?, total_amount = ?, payment_status = ?,
           status = IF(status = 'ENQUIRY', 'ENQUIRY', IF(? = 'SETTLED', 'COMPLETED', IF(status = 'COMPLETED', 'CONFIRMED', status)))
         WHERE id = ?`,
        [balance, banquet, total, paymentStatus, paymentStatus, bookingId],
      );
    });
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'booking', entityId: bookingId, after: { banquet, total, items: serviceItems.length } });
    revalidatePath(`/app/bookings/${bookingId}`);
    revalidatePath('/app/bookings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const bookingRulesSchema = z.object({
  bookingId: z.number().int().positive(),
  rules: z.array(z.string().min(1).max(500)).max(30),
});

/** Replace the rules printed as this booking's Terms & Conditions. */
export async function updateBookingRules(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  const parsed = bookingRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, rules } = parsed.data;

  try {
    await withTransaction(async (tx) => {
      await tx.execute(`DELETE FROM booking_rules WHERE booking_id = ?`, [bookingId]);
      for (let i = 0; i < rules.length; i++) {
        await tx.execute(`INSERT INTO booking_rules (booking_id, text, sort_order) VALUES (?,?,?)`, [bookingId, rules[i], i]);
      }
    });
    await audit({ userId: actor.id, action: 'UPDATE', entity: 'booking', entityId: bookingId, after: { rules: rules.length } });
    revalidatePath(`/app/bookings/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setBookingStatus(id: number, status: 'ENQUIRY' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  await execute(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'booking', entityId: id, after: { status } });
  revalidatePath('/app/bookings');
  return { ok: true };
}

/** An ISO date, or '' for "no bound on this end". */
const isoDateOrBlank = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Expected YYYY-MM-DD')
  .optional()
  .default('');

const searchSchema = z.object({
  q: z.string().max(120).optional().default(''),
  kind: z.enum(['ALL', 'BOOKINGS', 'ENQUIRIES', 'RETURNED', 'CANCELLED']).optional().default('ALL'),
  from: isoDateOrBlank,
  to: isoDateOrBlank,
});

export type BookingListRow = {
  id: number; slip_no: string; party_name: string; phone: string | null;
  event_date: string; shift: string; hall: string; guest_count: number;
  total_amount: number; balance_due: number; status: string; payment_status: string;
};

/** Debounced search + filter from the bookings page. */
export async function searchBookings(input: unknown): Promise<BookingListRow[]> {
  await assertPermission('bookings.view');
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];
  const { q, kind, from, to } = parsed.data;
  // A backwards range would silently return nothing, which reads as "no
  // bookings" rather than "your dates are the wrong way round" — so swap it.
  const [start, end] = from && to && from > to ? [to, from] : [from, to];
  const rows = await getBookings({ limit: 200, kind, search: q, from: start, to: end });
  return rows.map((b: any) => ({
    id: b.id, slip_no: b.slip_no, party_name: b.party_name, phone: b.phone,
    event_date: b.event_date, shift: b.shift, hall: b.hall, guest_count: b.guest_count,
    total_amount: Number(b.total_amount), balance_due: Number(b.balance_due),
    status: b.status, payment_status: b.payment_status,
  }));
}

// ── Reschedule / refund / cancel ───────────────────────

/** A booking's event date may be moved at most this many times.
 *  NOT exported: a 'use server' module may only export async functions.
 *  The client mirrors this value in detail-client.tsx. */
const MAX_DATE_CHANGES = 3;

const changeDateSchema = z.object({
  bookingId: z.number().int().positive(),
  newEventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(255).optional().nullable(),
});

/**
 * Move a booking's event date. Capped at MAX_DATE_CHANGES; each move is
 * recorded with the booking value at the time so the slip can print the
 * 1st / 2nd / 3rd event date alongside its amount.
 */
export async function changeEventDate(input: unknown): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  const parsed = changeDateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, newEventDate, reason } = parsed.data;

  const b = await queryOne<any>(
    `SELECT id, hall_id, event_date, shift, total_amount, status, date_change_count
       FROM bookings WHERE id = ?`, [bookingId]);
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (b.status === 'CANCELLED' || b.status === 'RETURNED') {
    return { ok: false, error: `This booking is ${String(b.status).toLowerCase()} — its date can no longer be changed.` };
  }

  const used = Number(b.date_change_count);
  if (used >= MAX_DATE_CHANGES) {
    return { ok: false, error: `The date has already been changed ${MAX_DATE_CHANGES} times. You can cancel the event or return the payment instead.` };
  }

  const currentIso = String(b.event_date).slice(0, 10);
  if (currentIso === newEventDate) return { ok: false, error: 'That is already the event date.' };
  if (await slotTaken(b.hall_id, newEventDate, b.shift, bookingId)) {
    return { ok: false, error: `That hall is already booked for ${String(b.shift).toLowerCase()} on the new date.` };
  }

  try {
    await withTransaction(async (tx) => {
      const seq = used + 1;
      await tx.execute(
        `INSERT INTO booking_date_changes (booking_id, seq, from_date, to_date, amount, reason, changed_by)
         VALUES (?,?,?,?,?,?,?)`,
        [bookingId, seq, currentIso, newEventDate, Number(b.total_amount), reason || null, actor.id],
      );
      await tx.execute(
        `UPDATE bookings SET event_date = ?, date_change_count = ? WHERE id = ?`,
        [newEventDate, seq, bookingId],
      );
    });
    await audit({ userId: actor.id, action: 'RESCHEDULE', entity: 'booking', entityId: bookingId,
      before: { event_date: currentIso }, after: { event_date: newEventDate, change: used + 1 } });
    revalidatePath(`/app/bookings/${bookingId}`);
    revalidatePath('/app/bookings');
    revalidatePath('/app/calendar');
    return { ok: true, remaining: MAX_DATE_CHANGES - (used + 1) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const refundSchema = z.object({
  bookingId: z.number().int().positive(),
  amount: z.number().min(0).max(999999999),
  refundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(255).optional().nullable(),
});

/**
 * Return the customer's money and close the booking as RETURNED.
 *
 * The refund is real cash leaving the business, so it is also posted to petty
 * cash under "Booking Refund" — otherwise the month's expenses (and therefore
 * profit) would silently ignore it.
 */
export async function refundBooking(input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, amount, refundDate, reason } = parsed.data;

  const b = await queryOne<any>(`SELECT id, paid_amount, refunded_amount, status FROM bookings WHERE id = ?`, [bookingId]);
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (b.status === 'RETURNED') return { ok: false, error: 'This booking has already been returned.' };

  const paid = Number(b.paid_amount);
  if (amount > paid + 0.01) {
    return { ok: false, error: `Can't return more than the ${paid.toLocaleString()} received.` };
  }

  try {
    await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE bookings SET status = 'RETURNED', refunded_amount = ?, refunded_at = NOW() WHERE id = ?`,
        [amount, bookingId],
      );
      if (amount > 0) {
        const head = await tx.queryOne<{ id: number }>(
          `SELECT id FROM expense_heads WHERE name = 'Booking Refund' AND is_active = 1 LIMIT 1`);
        let headId = head?.id;
        if (!headId) {
          // Head missing on older installs — create it so the cash is never lost.
          const r = await tx.execute(
            `INSERT INTO expense_heads (name, sort_order, has_qty_note, is_active)
             VALUES ('Booking Refund', (SELECT COALESCE(MAX(sort_order),0)+1 FROM expense_heads eh), 0, 1)`);
          headId = r.insertId;
        }
        await tx.execute(
          `INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, booking_id, entered_by)
           VALUES (?,?,?,?,?,?)`,
          [refundDate, headId, amount, `Refund — booking #${bookingId}`, bookingId, actor.id],
        );
      }
    });
    await audit({ userId: actor.id, action: 'REFUND', entity: 'booking', entityId: bookingId, after: { amount, reason } });
    revalidatePath(`/app/bookings/${bookingId}`);
    revalidatePath('/app/bookings');
    revalidatePath('/app/petty-cash');
    revalidatePath('/app/calendar');
    return { ok: true, message: amount > 0
      ? `Rs. ${amount.toLocaleString('en-PK')} returned and posted to petty cash.`
      : 'Booking marked as returned.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Cancel the event without returning money (frees the hall slot). */
export async function cancelBooking(bookingId: number, reason?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await assertPermission('bookings.edit');
  const b = await queryOne<any>(`SELECT status FROM bookings WHERE id = ?`, [bookingId]);
  if (!b) return { ok: false, error: 'Booking not found.' };
  if (b.status === 'RETURNED') return { ok: false, error: 'This booking was returned; it cannot be cancelled again.' };
  await execute(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`, [bookingId]);
  await audit({ userId: actor.id, action: 'CANCEL', entity: 'booking', entityId: bookingId, after: { reason: reason ?? null } });
  revalidatePath(`/app/bookings/${bookingId}`);
  revalidatePath('/app/bookings');
  revalidatePath('/app/calendar');
  return { ok: true };
}
