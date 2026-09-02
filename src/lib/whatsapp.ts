/**
 * WhatsApp message building for booking confirmations.
 *
 * Messages are handed to WhatsApp through a `wa.me` deep link rather than sent
 * from the server. Sending programmatically would need the WhatsApp Business
 * Cloud API — a Meta business account, a registered number and pre-approved
 * message templates — none of which this deployment has. The deep link works
 * today from any staff phone or WhatsApp Web, and keeps a person in the loop
 * before anything reaches a customer.
 */
import { fmtMoney, fmtDateWithDay } from '@/lib/format';
import { toWaNumber, DEFAULT_CC, type BrandInfo } from '@/lib/brand-info';

// Lives in brand-info.ts, beside digitsOnly, so the Settings form and every
// wa.me link in the app share one definition of "add the country code".
export { toWaNumber };

export interface BookingForMessage {
  slipNo: string;
  partyName: string;
  hall: string;
  eventDate: string;
  shift: string;
  guestCount: number;
  totalAmount: number;
  paidAmount: number;
}

/**
 * The confirmation a guest receives once their booking is held.
 *
 * Deliberately plain text with no links: it is forwarded between family
 * members constantly, and anything clever tends to arrive mangled.
 */
export function bookingConfirmationText(b: BookingForMessage, brand: BrandInfo): string {
  const balance = Math.max(0, b.totalAmount - b.paidAmount);
  const shift = b.shift.charAt(0) + b.shift.slice(1).toLowerCase();

  const lines = [
    `Assalam-o-Alaikum ${b.partyName},`,
    '',
    `Your booking at ${brand.name} is confirmed. Here are the details:`,
    '',
    `Slip #: ${b.slipNo}`,
    `Event: ${fmtDateWithDay(b.eventDate)}`,
    `Shift: ${shift}`,
    `Hall: ${b.hall}`,
    `Guests: ${b.guestCount}`,
    '',
    `Total: ${fmtMoney(b.totalAmount)}`,
    `Received: ${fmtMoney(b.paidAmount)}`,
    balance > 0 ? `Balance due: ${fmtMoney(balance)}` : 'Fully paid — thank you.',
    '',
  ];

  if (brand.address) lines.push(brand.address);
  if (brand.footerPhone || brand.phone) lines.push(`Contact: ${brand.footerPhone || brand.phone}`);

  lines.push('', 'Thank you for choosing us. We look forward to hosting you.');
  return lines.join('\n');
}

/** wa.me link for a number and message, or null when the number is unusable. */
export function waLink(phone: string | null | undefined, text: string, cc: string = DEFAULT_CC): string | null {
  const to = toWaNumber(phone, cc);
  if (!to) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// ── Catering ───────────────────────────────────────────

export interface QuotationForMessage {
  quotaNo: string;
  customerName: string;
  placeOfFunction: string;
  deliveryDate: string | null;
  persons: number;
  itemsTotal: number;
  meatTotal: number;
  grandTotal: number;
  paidAmount: number;
}

export interface CateringBrandForMessage {
  name: string;
  person: string;
  phone: string;
  address: string;
  terms: string;
}

/**
 * The quotation a catering customer receives.
 *
 * Mirrors the printed slip's figures — items, meat supplied, grand total,
 * received, balance — so the message and the PDF cannot tell different
 * stories. Plain text with no links: these get forwarded around families
 * constantly and anything clever arrives mangled.
 */
export function cateringQuotationText(q: QuotationForMessage, b: CateringBrandForMessage): string {
  const balance = Math.max(0, q.grandTotal - q.paidAmount);
  const lines = [
    `Assalam-o-Alaikum ${q.customerName || 'sir'},`,
    '',
    `Thank you for your enquiry. Here is your quotation from ${b.name}:`,
    '',
    `Quotation #: ${q.quotaNo}`,
  ];
  if (q.placeOfFunction) lines.push(`Function: ${q.placeOfFunction}`);
  if (q.deliveryDate) lines.push(`Event: ${fmtDateWithDay(q.deliveryDate)}`);
  if (q.persons) lines.push(`Persons: ${q.persons}`);

  lines.push('');
  lines.push(`Items & charges: ${fmtMoney(q.itemsTotal)}`);
  if (q.meatTotal > 0) lines.push(`Meat supplied: ${fmtMoney(q.meatTotal)}`);
  lines.push(`Grand total: ${fmtMoney(q.grandTotal)}`);
  if (q.paidAmount > 0) lines.push(`Received: ${fmtMoney(q.paidAmount)}`);
  lines.push(balance > 0 ? `Balance: ${fmtMoney(balance)}` : 'Fully paid — thank you.');
  lines.push('');

  if (b.terms) { lines.push(b.terms); lines.push(''); }
  if (b.address) lines.push(b.address);
  const contact = [b.person, b.phone].filter(Boolean).join(' ');
  if (contact) lines.push(`Contact: ${contact}`);

  lines.push('', 'Thank you for considering us.');
  return lines.join('\n');
}
