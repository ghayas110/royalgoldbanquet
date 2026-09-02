/**
 * Suggestions offered in the "Service" box when itemising banquet services
 * (new booking + the edit-services panel on a booking).
 *
 * These are only autocomplete hints — the field stays free text, so staff can
 * type anything. Single source of truth: the new-booking form and the edit
 * panel previously kept their own copies and had drifted out of sync
 * ("Petrol" vs "Petrol / Transport", "Valet" vs "Valet Parking").
 */

/**
 * The Live Cooking service, as it appears in the banquet services list.
 *
 * It is an ordinary banquet service line like any other here — the only thing
 * special about it is that lines carrying this label are stamped
 * `service_kind = 'LIVE_COOKING'` when the booking is saved, which is what
 * lets the Super Admin report on it separately.
 */
export const LIVE_COOKING_SERVICE = 'Live Cooking';

export const SERVICE_PRESETS = [
  LIVE_COOKING_SERVICE,
  'Gents Waiters',
  'Ladies Waiters',
  'Petrol / Transport',
  'Coffee Machine',
  'Water Cooler',
  'Generator',
  'Valet Parking',
  'Ice',
  'Cold Drinks',
  'Tea Hall',
  'Decor',
] as const;

/**
 * Labels that count as Live Cooking, current and historical.
 *
 * Renaming the service is not enough on its own: bookings taken under an
 * earlier name still carry the old label, and re-saving one of those runs its
 * lines back through `writeServiceItems`. Matching only the current name would
 * quietly re-stamp such a line as plain BANQUET and drop it out of the Super
 * Admin's report — a silent hole in the figures, months after the rename.
 * So every name the service has ever had stays listed here.
 */
const LIVE_COOKING_LABELS = [
  'live cooking',
  'live cooking stall',
  'live kitchen',
];

/** True when a service line should be booked as Live Cooking. */
export function isLiveCooking(label: string): boolean {
  return LIVE_COOKING_LABELS.includes((label ?? '').trim().toLowerCase());
}
