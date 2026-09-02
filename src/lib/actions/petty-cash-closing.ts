'use server';

/**
 * Confirming a day's petty cash.
 *
 * Confirming freezes what the manager spent on a date and rolls whatever is
 * still in his hand onto the next day as that day's opening float, so the cash
 * he is carrying is always accounted for rather than re-counted from scratch.
 *
 * Ported from the Sarah Palace build, minus its venue-setup neighbours.
 */

import { execute, query, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

type VenueResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * What the manager holds on a date, before anything is confirmed.
 *
 * Opening float = whatever the last confirmed day left in his hand, plus
 * anything handed out on this date. Expenses are the day's petty cash, and
 * `returned` is cash physically given back.
 */
export async function getDayCashPosition(date: string) {
  const [carried] = await query<any>(
    `SELECT closing_balance FROM petty_cash_closings
      WHERE close_date < ? ORDER BY close_date DESC LIMIT 1`,
    [date],
  );
  const [today] = await query<any>(
    `SELECT COALESCE(SUM(amount_disbursed),0) AS disbursed,
            COALESCE(SUM(amount_returned),0)  AS returned
       FROM manager_disbursements WHERE date_disbursed = ?`,
    [date],
  );
  const [spent] = await query<any>(
    `SELECT COALESCE(SUM(amount),0) AS expenses FROM petty_cash_entries WHERE entry_date = ?`,
    [date],
  );

  const broughtForward = Number(carried?.closing_balance ?? 0);
  const disbursed = Number(today?.disbursed ?? 0);
  const returned = Number(today?.returned ?? 0);
  const expenses = Number(spent?.expenses ?? 0);
  return {
    broughtForward,
    disbursed,
    expenses,
    returned,
    opening: broughtForward + disbursed,
    closing: broughtForward + disbursed - expenses - returned,
  };
}

/**
 * Confirm a day: freeze its figures and carry the remaining float forward.
 *
 * Re-confirming the same date updates the row rather than adding a second —
 * a day is closed once, and a correction should not create a duplicate that
 * silently doubles the amount carried on.
 */
export async function confirmPettyCashDay(date: string): Promise<VenueResult> {
  const actor = await assertPermission('pettycash.edit');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Pick a valid date.' };

  const p = await getDayCashPosition(date);
  await execute(
    `INSERT INTO petty_cash_closings
       (close_date, brought_forward, disbursed, expenses, returned, closing_balance, confirmed_by)
     VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       brought_forward = VALUES(brought_forward), disbursed = VALUES(disbursed),
       expenses = VALUES(expenses), returned = VALUES(returned),
       closing_balance = VALUES(closing_balance), confirmed_by = VALUES(confirmed_by),
       confirmed_at = CURRENT_TIMESTAMP`,
    [date, p.broughtForward, p.disbursed, p.expenses, p.returned, p.closing, actor.id],
  );
  await audit({ userId: actor.id, action: 'CONFIRM_DAY', entity: 'petty_cash', entityId: date, after: p });
  revalidatePath('/app/petty-cash');
  revalidatePath('/app/float');
  return {
    ok: true,
    message: p.closing > 0
      ? `Day confirmed. Rs. ${p.closing.toLocaleString('en-PK')} carried forward to the next day.`
      : 'Day confirmed. Nothing left to carry forward.',
  };
}

/** Undo a confirmation, so the day can be corrected. */
export async function unconfirmPettyCashDay(date: string): Promise<VenueResult> {
  const actor = await assertPermission('pettycash.edit');
  await execute(`DELETE FROM petty_cash_closings WHERE close_date = ?`, [date]);
  await audit({ userId: actor.id, action: 'UNCONFIRM_DAY', entity: 'petty_cash', entityId: date });
  revalidatePath('/app/petty-cash');
  return { ok: true, message: 'Confirmation removed — the day is open again.' };
}
