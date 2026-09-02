/**
 * Comments Card — the printed feedback slip Skylight has always handed to
 * guests after an event, reproduced digitally.
 *
 * The seven categories, their order and their wording all come from the paper
 * card, so a guest who has filled the paper version recognises this one.
 */

export const RATING_VALUES = ['EXCELLENT', 'GOOD', 'POOR'] as const;
export type Rating = (typeof RATING_VALUES)[number];

/** `key` doubles as the DB column suffix (`r_services`, `r_crockery`, …). */
export const REVIEW_CATEGORIES = [
  { key: 'services', label: 'Services' },
  { key: 'crockery', label: 'Crockery' },
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'atmosphere', label: 'Atmosphere' },
  { key: 'manager', label: 'Manager Attitude' },
  { key: 'head_waiter', label: 'Head Waiter Attitude' },
  { key: 'overall', label: 'Overall Experience' },
] as const;

export type ReviewCategoryKey = (typeof REVIEW_CATEGORIES)[number]['key'];

export interface ReviewRow {
  id: number;
  bookingId: number | null;
  slipNo: string | null;
  token: string;
  guestName: string | null;
  guestPhone: string | null;
  eventDate: string | null;
  hall: string | null;
  ratings: Partial<Record<ReviewCategoryKey, Rating>>;
  comments: string | null;
  submittedAt: string | null;
  isPublished: boolean;
  createdAt: string;
  /** 1–5, derived from the answered categories. Null when nothing answered. */
  stars: number | null;
}

/**
 * The card has three levels, the landing page shows five stars. POOR sits at 1
 * rather than 0 so a single bad category can't zero out an otherwise good card.
 */
const STAR_OF: Record<Rating, number> = { EXCELLENT: 5, GOOD: 3.5, POOR: 1 };

export function starsFor(ratings: Partial<Record<ReviewCategoryKey, Rating>>): number | null {
  const vals = Object.values(ratings).filter(Boolean) as Rating[];
  if (vals.length === 0) return null;
  const avg = vals.reduce((s, r) => s + STAR_OF[r], 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

/** Overall Experience is what the guest actually rated the venue on. */
export function headlineRating(r: ReviewRow): Rating | null {
  return r.ratings.overall ?? r.ratings.services ?? null;
}

export function ratingTone(r: Rating): 'green' | 'amber' | 'red' {
  return r === 'EXCELLENT' ? 'green' : r === 'GOOD' ? 'amber' : 'red';
}

export function isRating(v: unknown): v is Rating {
  return typeof v === 'string' && (RATING_VALUES as readonly string[]).includes(v);
}
