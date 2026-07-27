'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type FloatResult = { ok: true; message?: string } | { ok: false; error: string };

const disburseSchema = z.object({
  bookingId: z.number().int().positive().optional().nullable(),
  disbursedTo: z.number().int().positive(),
  amount: z.number().positive().max(99999999),
  dateDisbursed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(255).optional().nullable(),
});

export async function disburseFloat(input: unknown): Promise<FloatResult> {
  const actor = await assertPermission('float.disburse');
  const parsed = disburseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { bookingId, disbursedTo, amount, dateDisbursed, note } = parsed.data;

  // Resolve the selected booking (float is disbursed against a booking, not a free-text slip).
  const booking = bookingId
    ? await queryOne<{ id: number; slip_no: string }>(`SELECT id, slip_no FROM bookings WHERE id = ?`, [bookingId])
    : null;

  const res = await execute(
    `INSERT INTO manager_disbursements (slip_no, booking_id, disbursed_by, disbursed_to, amount_disbursed, date_disbursed, amount_returned, status, note)
     VALUES (?,?,?,?,?,?,0,'OPEN',?)`,
    [booking?.slip_no ?? null, booking?.id ?? null, actor.id, disbursedTo, amount, dateDisbursed, note || null],
  );
  await audit({ userId: actor.id, action: 'DISBURSE', entity: 'manager_disbursement', entityId: res.insertId, after: { bookingId, amount, disbursedTo } });
  revalidatePath('/app/float');
  return { ok: true, message: 'Float disbursed.' };
}

export async function markReturned(id: number, amountReturned: number, dateReturned: string): Promise<FloatResult> {
  const actor = await assertPermission('float.reconcile');
  const before = await queryOne<any>(`SELECT * FROM manager_disbursements WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Disbursement not found.' };
  if (amountReturned < 0) return { ok: false, error: 'Amount cannot be negative.' };

  await execute(
    `UPDATE manager_disbursements SET amount_returned = ?, date_returned = ?, status = 'RECONCILED' WHERE id = ?`,
    [amountReturned, dateReturned, id],
  );
  await audit({
    userId: actor.id, action: 'MARK_RETURNED', entity: 'manager_disbursement', entityId: id,
    before: { amount_returned: before.amount_returned, status: before.status },
    after: { amount_returned: amountReturned, status: 'RECONCILED' },
  });
  revalidatePath('/app/float');
  return { ok: true, message: 'Marked returned — posted to income statement.' };
}

export async function disputeFloat(id: number, note: string): Promise<FloatResult> {
  const actor = await assertPermission('float.reconcile');
  await execute(`UPDATE manager_disbursements SET status = 'DISPUTED', note = ? WHERE id = ?`, [note, id]);
  await audit({ userId: actor.id, action: 'DISPUTE', entity: 'manager_disbursement', entityId: id });
  revalidatePath('/app/float');
  return { ok: true };
}
