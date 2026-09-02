'use server';

/**
 * Comments Card actions.
 *
 * Two audiences share this file:
 *  - staff (issue a card, publish/hide, delete) — permission-gated;
 *  - the guest filling the form — no session at all, authenticated only by the
 *    random token in their link, and allowed to write exactly one row once.
 */

import { z } from 'zod';
import { queryOne, execute } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { REVIEW_CATEGORIES, RATING_VALUES } from '@/lib/reviews';

/**
 * The credential for the guest's link. 16 random bytes — not guessable, and
 * minted here rather than in the shared module so `node:crypto` never has to
 * reach the client bundle.
 */
function newReviewToken(): string {
  return randomBytes(16).toString('hex');
}

type Ok<T = {}> = { ok: true } & T;
type Err = { ok: false; error: string };

/**
 * Issue a card for a booking. Reuses an unfilled card rather than piling up
 * dead links when staff tap the button twice.
 */
export async function issueReviewCard(
  bookingId: number,
): Promise<Ok<{ token: string }> | Err> {
  const actor = await assertPermission('bookings.view');

  const booking = await queryOne<any>(
    `SELECT b.id, b.event_date, p.party_name, p.phone
       FROM bookings b JOIN parties p ON p.id = b.party_id
      WHERE b.id = ?`,
    [bookingId],
  );
  if (!booking) return { ok: false, error: 'Booking not found.' };

  const open = await queryOne<{ token: string }>(
    `SELECT token FROM reviews WHERE booking_id = ? AND submitted_at IS NULL LIMIT 1`,
    [bookingId],
  );
  if (open) return { ok: true, token: open.token };

  const token = newReviewToken();
  await execute(
    `INSERT INTO reviews (booking_id, token, guest_name, guest_phone, event_date, issued_by)
     VALUES (?,?,?,?,?,?)`,
    [bookingId, token, booking.party_name, booking.phone, booking.event_date, actor.id],
  );
  await audit({ userId: actor.id, action: 'ISSUE_REVIEW', entity: 'review', entityId: bookingId });
  revalidatePath(`/app/bookings/${bookingId}`);
  revalidatePath('/app/reviews');
  return { ok: true, token };
}

/** A blank card not tied to any booking — for walk-in guests. */
export async function issueBlankReviewCard(): Promise<Ok<{ token: string }> | Err> {
  const actor = await assertPermission('reviews.manage');
  const token = newReviewToken();
  await execute(`INSERT INTO reviews (token, issued_by) VALUES (?,?)`, [token, actor.id]);
  revalidatePath('/app/reviews');
  return { ok: true, token };
}

const ratingField = z.enum(RATING_VALUES).nullish();
const submitSchema = z.object({
  token: z.string().min(8).max(64),
  guestName: z.string().trim().max(120).optional(),
  guestPhone: z.string().trim().max(40).optional(),
  eventDate: z.string().trim().max(10).optional(),
  comments: z.string().trim().max(1000).optional(),
  ratings: z.record(z.string(), ratingField).optional(),
});

/**
 * The guest submits their own card. Deliberately unauthenticated — the token is
 * the credential. Rejected once already submitted so a shared link can't be
 * used to overwrite what the guest wrote.
 */
export async function submitReview(input: unknown): Promise<Ok | Err> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the form and try again.' };
  const d = parsed.data;

  const row = await queryOne<any>(
    `SELECT id, submitted_at FROM reviews WHERE token = ? LIMIT 1`,
    [d.token],
  );
  if (!row) return { ok: false, error: 'This feedback link is not valid.' };
  if (row.submitted_at) return { ok: false, error: 'This card has already been submitted. Thank you!' };

  // Whitelisted against REVIEW_CATEGORIES — the keys come from the client.
  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const c of REVIEW_CATEGORIES) {
    const v = d.ratings?.[c.key];
    cols.push(`r_${c.key} = ?`);
    vals.push(v ?? null);
  }

  await execute(
    `UPDATE reviews SET
       guest_name  = COALESCE(NULLIF(?,''), guest_name),
       guest_phone = COALESCE(NULLIF(?,''), guest_phone),
       event_date  = COALESCE(NULLIF(?,''), event_date),
       comments    = NULLIF(?,''),
       ${cols.join(', ')},
       submitted_at = NOW()
     WHERE id = ? AND submitted_at IS NULL`,
    [d.guestName ?? '', d.guestPhone ?? '', d.eventDate ?? '', d.comments ?? '', ...vals, row.id],
  );

  revalidatePath('/app/reviews');
  revalidatePath('/');
  return { ok: true };
}

/** Show or hide a card on the public landing page. */
export async function setReviewPublished(id: number, published: boolean): Promise<Ok | Err> {
  const actor = await assertPermission('reviews.manage');
  const res = await execute(`UPDATE reviews SET is_published = ? WHERE id = ?`, [published ? 1 : 0, id]);
  if (res.affectedRows === 0) return { ok: false, error: 'Review not found.' };
  await audit({
    userId: actor.id, action: published ? 'PUBLISH_REVIEW' : 'HIDE_REVIEW',
    entity: 'review', entityId: id,
  });
  revalidatePath('/app/reviews');
  revalidatePath('/');
  return { ok: true };
}

/** Remove a card entirely. */
export async function deleteReview(id: number): Promise<Ok | Err> {
  const actor = await assertPermission('reviews.manage');
  const before = await queryOne<any>(`SELECT * FROM reviews WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Review not found.' };
  await execute(`DELETE FROM reviews WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE_REVIEW', entity: 'review', entityId: id, before });
  revalidatePath('/app/reviews');
  revalidatePath('/');
  if (before.booking_id) revalidatePath(`/app/bookings/${before.booking_id}`);
  return { ok: true };
}

/** Clear out links that were issued but never filled in. */
export async function deleteUnusedReviewCards(): Promise<Ok<{ count: number }> | Err> {
  const actor = await assertPermission('reviews.manage');
  const res = await execute(`DELETE FROM reviews WHERE submitted_at IS NULL`);
  await audit({ userId: actor.id, action: 'DELETE_REVIEW_LINKS', entity: 'review', after: { count: res.affectedRows } });
  revalidatePath('/app/reviews');
  return { ok: true, count: res.affectedRows };
}
