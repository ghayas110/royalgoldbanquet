'use server';

/**
 * Destructive maintenance actions for the Settings → Danger Zone.
 *
 * Every action here is IRREVERSIBLE and owner-only (`assertOwner` checks the
 * role, not a permission, so it can never be delegated to a manager). Each one
 * also requires the caller to echo back an exact confirmation phrase, which
 * stops a mis-click or a stray call from wiping data.
 */

import { query, queryOne, withTransaction, execute } from '@/lib/db';
import { assertOwner } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type DangerResult = { ok: true; message: string } | { ok: false; error: string };

/** Live counts shown next to each button so the owner sees what they'd destroy. */
export async function getDangerCounts(): Promise<{
  bookings: number; enquiries: number; payments: number; parties: number;
  halls: number; employees: number; pettyCash: number; leads: number;
}> {
  await assertOwner();
  const r = await queryOne<any>(`
    SELECT
      (SELECT COUNT(*) FROM bookings WHERE status <> 'ENQUIRY') AS bookings,
      (SELECT COUNT(*) FROM bookings WHERE status =  'ENQUIRY') AS enquiries,
      (SELECT COUNT(*) FROM payments)                           AS payments,
      (SELECT COUNT(*) FROM parties)                            AS parties,
      (SELECT COUNT(*) FROM halls)                              AS halls,
      (SELECT COUNT(*) FROM employees)                          AS employees,
      (SELECT COUNT(*) FROM petty_cash_entries)                 AS pettyCash,
      (SELECT COUNT(*) FROM leads)                              AS leads
  `);
  return {
    bookings: Number(r?.bookings ?? 0), enquiries: Number(r?.enquiries ?? 0),
    payments: Number(r?.payments ?? 0), parties: Number(r?.parties ?? 0),
    halls: Number(r?.halls ?? 0), employees: Number(r?.employees ?? 0),
    pettyCash: Number(r?.pettyCash ?? 0), leads: Number(r?.leads ?? 0),
  };
}

function revalidateAll() {
  for (const p of ['/app', '/app/bookings', '/app/calendar', '/app/income', '/app/sale',
                   '/app/reports', '/app/petty-cash', '/app/float', '/app/leads',
                   '/app/attendance', '/app/halls', '/app/rules', '/app/settings']) {
    revalidatePath(p);
  }
}

/**
 * Delete bookings matching a status set, plus everything hanging off them.
 * booking_service_items / booking_rules / payments cascade on delete; the
 * nullable booking_id on petty cash and manager float does NOT cascade, so it
 * is cleared explicitly to avoid dangling references.
 */
async function deleteBookingsWhere(clause: string): Promise<number> {
  return withTransaction(async (tx) => {
    const ids = await tx.query<{ id: number }>(`SELECT id FROM bookings WHERE ${clause}`);
    if (ids.length === 0) return 0;
    const list = ids.map((r) => r.id).join(',');

    await tx.execute(`UPDATE petty_cash_entries    SET booking_id = NULL WHERE booking_id IN (${list})`);
    await tx.execute(`UPDATE manager_disbursements SET booking_id = NULL WHERE booking_id IN (${list})`);
    await tx.execute(`DELETE FROM bookings WHERE id IN (${list})`);

    // Customers only exist to hang bookings off, so drop the now-orphaned ones.
    await tx.execute(`DELETE FROM parties WHERE id NOT IN (SELECT party_id FROM bookings)`);
    return ids.length;
  });
}

export async function deleteAllEnquiries(confirm: string): Promise<DangerResult> {
  const actor = await assertOwner();
  if (confirm !== 'DELETE ENQUIRIES') return { ok: false, error: 'Confirmation text did not match.' };
  try {
    const n = await deleteBookingsWhere(`status = 'ENQUIRY'`);
    await audit({ userId: actor.id, action: 'DELETE', entity: 'danger', after: { op: 'deleteAllEnquiries', deleted: n } });
    revalidateAll();
    return { ok: true, message: n === 0 ? 'There were no enquiries to delete.' : `Deleted ${n} enquir${n === 1 ? 'y' : 'ies'}.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteAllBookings(confirm: string): Promise<DangerResult> {
  const actor = await assertOwner();
  if (confirm !== 'DELETE BOOKINGS') return { ok: false, error: 'Confirmation text did not match.' };
  try {
    // Enquiries are left alone — they have their own action.
    const n = await deleteBookingsWhere(`status <> 'ENQUIRY'`);
    await audit({ userId: actor.id, action: 'DELETE', entity: 'danger', after: { op: 'deleteAllBookings', deleted: n } });
    revalidateAll();
    return { ok: true, message: n === 0 ? 'There were no bookings to delete.' : `Deleted ${n} booking${n === 1 ? '' : 's'} and their payments.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Full clean slate — every table except `users`, so the owner is never locked
 * out of their own installation. Deletes run child-first because several
 * foreign keys (bookings→parties, *→expense_heads, *→employees) do not cascade.
 */
export async function factoryReset(confirm: string): Promise<DangerResult> {
  const actor = await assertOwner();
  if (confirm !== 'FACTORY RESET') return { ok: false, error: 'Confirmation text did not match.' };

  try {
    await withTransaction(async (tx) => {
      const wipe = [
        // staff ledgers → employees
        'loan_repayments', 'salary_payments', 'attendance', 'employee_loans',
        'employee_advances', 'employees',
        // stock: movements reference bookings and items, so they go first
        'stock_movements', 'stock_items', 'stock_categories',
        // day-close records
        'petty_cash_closings',
        // guest feedback and alerts (both hang off bookings)
        'reviews', 'notifications',
        // booking tree (children cascade, but be explicit and ordered)
        'booking_rules', 'booking_service_items', 'payments', 'bookings', 'parties',
        // money
        'petty_cash_entries', 'income_adjustments', 'manager_disbursements', 'monthly_locks', 'expense_heads',
        // config + misc
        'leads', 'rules', 'halls',
      ];
      for (const t of wipe) await tx.execute(`DELETE FROM ${t}`);

      // Settings are wiped too, but NOT the push keypair: deleting it would
      // silently break every device that has already enabled notifications,
      // and it is infrastructure rather than business data.
      await tx.execute(
        `DELETE FROM settings WHERE \`key\` NOT IN ('vapid_public_key', 'vapid_private_key')`,
      );

      // Staff must unlink employees themselves; the records are gone, so clear
      // the dangling pointers rather than leaving them to fail the FK.
      await tx.execute(`UPDATE users SET employee_id = NULL`);
      // Audit log last: it is the record of everything being removed.
      await tx.execute(`DELETE FROM audit_log`);
    });

    // Logged after the wipe so this entry survives as the first row.
    await audit({ userId: actor.id, action: 'DELETE', entity: 'danger', after: { op: 'factoryReset' } });
    revalidateAll();
    return { ok: true, message: 'Factory reset complete. Add your halls and staff to start again — your login still works.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
