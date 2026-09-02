import { fmtMoney, fmtDate, fmtPhone, parseDate, monthLabelFull } from '@/lib/format';
import { BRAND_DEFAULTS, type BrandInfo } from '@/lib/brand-info';
import {
  REVIEW_CATEGORIES, RATING_VALUES, type Rating, type ReviewCategoryKey,
} from '@/lib/reviews';

// ── Shared bits ────────────────────────────────────────
/** Light-ray divider — the print twin of `<Rays>` in src/components/brand.tsx. */
function Flourish({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 240 24" width="150" height="15" className="rgb-flourish" style={{ display: 'block', margin: '0 auto', transform: flip ? 'rotate(180deg)' : undefined }} fill="none" aria-hidden>
      <path d="M120 5 l4.5 7 -4.5 7 -4.5 -7 z" fill="currentColor" />
      <rect x="60" y="11.2" width="48" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="132" y="11.2" width="48" height="1.6" rx="0.8" fill="currentColor" />
      <path d="M108 12 l-14 -4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M108 12 l-14 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M132 12 l14 -4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M132 12 l14 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M60 12 h-22" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
      <path d="M180 12 h22" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

/**
 * The wordmark line. When the tagline is the last word of the business name
 * ("Skylight Ballroom & Catering Service" / "Ballroom & Catering Service") it is dropped from the big line, since it
 * already prints underneath — otherwise the whole name is used.
 */
function wordmark(brand: BrandInfo): string {
  const name = (brand.name ?? '').trim();
  const tag = (brand.tagline ?? '').trim();
  if (tag && name.toLowerCase().endsWith(' ' + tag.toLowerCase())) {
    return name.slice(0, name.length - tag.length).trim();
  }
  return name;
}

/**
 * The dark bar behind the header and footer, drawn as an SVG rect rather than
 * a CSS background.
 *
 * Chrome's print dialog has a "Background graphics" checkbox that is OFF by
 * default on many setups. With it off, a CSS `background` is simply not
 * printed — which left the gold wordmark sitting on white paper, effectively
 * invisible, and is why the header and footer came out missing. An SVG rect is
 * a foreground graphic, so it prints either way.
 */
function BandFill() {
  return (
    <svg
      className="rgb-band-fill"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect x="0" y="0" width="100" height="100" fill="#0B0B0D" />
    </svg>
  );
}

/**
 * The letterhead band.
 *
 * A horizontal lockup: the monogram on the left, the business name beside it,
 * matching the mark used on screen. Deliberately typeset rather than a flat
 * image of the whole logo, for two reasons.
 *
 * The name is per-document. The ballroom's slips say Skylight Ballroom, and
 * the catering arm's say whatever its own profile says, so one baked-in image
 * cannot serve both. And typeset text stays crisp at any size and prints
 * cleanly even when a printer drops images.
 *
 * The band is dark, so the type is gold and the transparent monogram sits on
 * it without a halo.
 */
function LogoBand({ size = 'md', brand }: { size?: 'md' | 'lg'; brand: BrandInfo }) {
  const word = size === 'lg' ? '34px' : '28px';
  const sub = size === 'lg' ? '13px' : '11px';
  const mark = size === 'lg' ? '62px' : '52px';

  return (
    <div className="rgb-band">
      <BandFill />
      <div className="rgb-lockup">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark.png"
          alt=""
          aria-hidden
          className="rgb-lockup-mark"
          style={{ height: mark, width: 'auto' }}
          loading="eager"
          decoding="sync"
        />
        <div className="rgb-lockup-text">
          <div className="rgb-logo-word rgb-logo-gold" style={{ fontSize: word, lineHeight: 1.05 }}>
            {wordmark(brand)}
          </div>
          {brand.tagline && (
            <div className="rgb-lockup-sub" style={{ fontSize: sub }}>{brand.tagline}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The footer band on every printed document.
 *
 * Address and phone only. Social handles are for the website, where they are
 * clickable; on paper they are noise a customer cannot act on, and they crowd
 * the line that carries the details someone actually needs to reach you.
 *
 * `brand.facebook` and `brand.instagram` are untouched and still drive the
 * site's own links and its structured data.
 */
function FooterBand({ brand }: { brand: BrandInfo }) {
  return (
    <div className="rgb-band-footer">
      <BandFill />
      <span>📍 {brand.address}</span>
      <span>Phone: {brand.footerPhone}</span>
    </div>
  );
}

// Retained for reference; contact details now appear only in the footer band.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Contact({ brand }: { brand: BrandInfo }) {
  return (
    <div className="rgb-contact">
      {brand.address}<br />
      Ph: {brand.phone} &nbsp;·&nbsp; fb/{brand.facebook}
    </div>
  );
}

/**
 * The slip prints the shift NAME only — "DINNER", "LUNCH".
 *
 * The standard service windows used to be appended in brackets, but the times
 * are negotiated per booking and a fixed window printed on a signed slip is a
 * promise the venue has not actually made.
 */
const shiftLabel = (s: string) => s;

/**
 * Included free with every booking. Printed on the slip so the customer knows
 * exactly what the hall charge already covers and doesn't get billed for it.
 */
const COMPLEMENTARY_ITEMS = [
  'GENTS WAITER',
  'WATER DISPENSER',
  '3HRS AIRCONDITION AND LIGHTING',
  'SOUND SYSTEM',
  'DJ ENTRY',
  'VALET PARKING',
  'DECORATIONS'

];

function ComplementaryBlock() {
  return (
    <>
      <div className="rgb-sec">Complementary — Included Free</div>
      <ul className="rgb-comp">
        {COMPLEMENTARY_ITEMS.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </>
  );
}

/** 1 -> 1st, 2 -> 2nd, 3 -> 3rd (only ever 1..3 here). */
function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekday(s: string) { const d = parseDate(s); return isNaN(d.getTime()) ? '—' : WEEKDAYS[d.getDay()]; }

// ── Invoice ────────────────────────────────────────────
export interface InvoiceData {
  slip_no: string; party_name: string; phone: string | null;
  phone2?: string | null; address?: string | null; hall: string; event_date: string; booking_date: string; shift: string;
  guest_count: number; balance_amount: number; banquet_amount: number; total_amount: number; paid_amount: number;
  notes?: string | null;
  /** Per-booking rules; when empty the standard terms below are printed. */
  rules?: string[];
  /** Event-date reschedules, so the slip shows 1st/2nd/3rd date + amount. */
  dateChanges?: { seq: number; from_date: string; to_date: string; amount: number }[];
  status?: string;
  refunded_amount?: number;
  /** Staff member who took the booking — signs the slip. Null on an older
   *  booking taken before the app recorded who entered it. */
  booked_by?: string | null;
  items: { label: string; qty: number; rate: number; subtotal: number }[];
  payments: { amount: number; payment_date: string; method: string; note: string | null }[];
}

/** True when the text contains Arabic-script characters (Urdu, Arabic, Farsi). */
function isRtl(s: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);
}

/**
 * Terms printed ON the invoice itself, in two columns, so the slip is a single
 * page. Replaces the separate overleaf sheet.
 *
 * Each line is direction-detected independently: the client's rules may be in
 * Urdu, which must render right-to-left in a Nastaliq face, but an English
 * rule mixed into the same list still has to read left-to-right.
 */
function InlineTerms({ rules, notes }: { rules?: string[]; notes?: string | null }) {
  // Every term on every slip comes from the database — the booking's own rules,
  // the portal library, or the catering rules. Nothing is compiled in, so with
  // nothing to print the whole block (heading included) is omitted rather than
  // falling back to wording nobody can edit.
  const list = rules ?? [];
  if (list.length === 0 && !notes) return null;
  // A long list would otherwise grow the sheet past A4 and spill onto a second
  // page, which is the whole thing this layout exists to avoid. Tighten the
  // columns instead — measured: 7 rules fit comfortably, 16 need three columns.
  const density = list.length > 12 ? ' rgb-inline-terms--x' : list.length > 8 ? ' rgb-inline-terms--dense' : '';
  return (
    <div className={`rgb-inline-terms${density}`}>
      {list.length > 0 && (
        <>
          <div className="rgb-inline-terms-head">
            The undersigned hereby agree to: <span className="rgb-urdu">شرائط و ضوابط</span>
          </div>
          <ul className="rgb-inline-terms-list">
            {list.map((t, i) => (
              <li key={i} className={isRtl(t) ? 'rgb-urdu' : undefined} dir={isRtl(t) ? 'rtl' : 'ltr'}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {notes && (
        <div className={`rgb-inline-notes ${isRtl(notes) ? 'rgb-urdu' : ''}`} dir={isRtl(notes) ? 'rtl' : 'ltr'}>
          <strong>Notes:</strong> {notes}
        </div>
      )}
    </div>
  );
}
/**
 * The booking invoice — ONE page. Terms are printed on the invoice itself
 * rather than overleaf, so the whole slip is a single sheet to hand over,
 * print, or send as a one-page PDF.
 */
export function InvoiceDoc({ b, brand }: { b: InvoiceData; brand: BrandInfo }) {
  return <InvoiceFront b={b} brand={brand} />;
}

function InvoiceFront({ b, brand }: { b: InvoiceData; brand: BrandInfo }) {
  const due = b.total_amount - b.paid_amount;
  const isCancelled = b.status === 'CANCELLED';
  const isReturned = b.status === 'RETURNED';

  const badge = isCancelled
    ? { c: 'rgb-badge-cancelled', t: 'CANCELLED' }
    : isReturned
      ? { c: 'rgb-badge-returned', t: 'RETURNED' }
      : due <= 0
        ? { c: 'rgb-badge-paid', t: 'Paid' }
        : b.paid_amount > 0
          ? { c: 'rgb-badge-partial', t: 'Partially Paid' }
          : { c: 'rgb-badge-due', t: 'Outstanding' };

  return (
    // No `rgb-frontsheet`: that class forces a page break AFTER the sheet,
    // which on a one-page invoice prints a trailing blank page. The enquiry
    // slip keeps it, because its terms still print overleaf.
    <div className="rgb-sheet rgb-onepage">
      <LogoBand brand={brand} />
      <div className="rgb-body">
        <div className="rgb-meta">
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">{isCancelled ? 'CANCELLED INVOICE' : isReturned ? 'RETURNED INVOICE' : 'Booking Invoice'}</div>
            <div className="rgb-slipno">Slip # {b.slip_no}</div>
            <div style={{ fontSize: '11px', color: '#6b6455', marginTop: '2px', fontWeight: 600 }}>Booking Date: {fmtDate(b.booking_date)} ({weekday(b.booking_date)})</div>
            <div style={{ marginTop: '4px' }}><span className={`rgb-badge ${badge.c}`}>{badge.t}</span></div>
          </div>
        </div>

        {/* Client & event details */}
        <table className="rgb-kv"><tbody>
          <tr><td className="k">Party Name</td><td>{b.party_name}</td><td className="k">Booking Date</td><td>{fmtDate(b.booking_date)} ({weekday(b.booking_date)})</td></tr>
          <tr><td className="k">Phone</td><td>{fmtPhone(b.phone)}</td><td className="k">Event Date</td><td>{fmtDate(b.event_date)} ({weekday(b.event_date)})</td></tr>
          <tr><td className="k">Secondary Phone</td><td>{fmtPhone(b.phone2)}</td><td className="k">Shift</td><td>{shiftLabel(b.shift)}</td></tr>
          <tr><td className="k">Address</td><td>{b.address || '—'}</td><td className="k">Hall / Lawn</td><td>{b.hall}</td></tr>
          <tr><td className="k">Guests</td><td>{b.guest_count}</td><td className="k"></td><td></td></tr>
        </tbody></table>

        {/* Services */}
        <div className="rgb-sec">Banquet Services</div>
        <table className="rgb-table">
          <thead><tr><th style={{ width: '8%' }}>S.No</th><th>Description</th><th className="r" style={{ width: '10%' }}>Qty</th><th className="r" style={{ width: '18%' }}>Rate</th><th className="r" style={{ width: '20%' }}>Amount</th></tr></thead>
          <tbody>
            {b.items.length === 0
              ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8a8574' }}>Hall booking only — no additional services.</td></tr>
              : b.items.map((it, i) => (
                <tr key={i}><td>{i + 1}</td><td>{it.label}</td><td className="r">{it.qty}</td><td className="r">{fmtMoney(it.rate, false)}</td><td className="r">{fmtMoney(it.subtotal, false)}</td></tr>
              ))}
          </tbody>
          <tfoot><tr><td colSpan={4} className="r">Banquet Amount</td><td className="r">{fmtMoney(b.banquet_amount, false)}</td></tr></tfoot>
        </table>

        <ComplementaryBlock />

        {/* Payments + Account summary */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
          <div style={{ flex: 1 }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Payment History</div>
            {b.payments.length === 0
              ? <div style={{ fontSize: '10px', color: '#a49c88', padding: '4px 0' }}>No payments recorded.</div>
              : (
                <table className="rgb-table">
                  <thead><tr><th>Date</th><th>Method</th><th>Note</th><th className="r">Amount</th></tr></thead>
                  <tbody>{b.payments.map((p, i) => (
                    <tr key={i}><td>{fmtDate(p.payment_date)}</td><td>{p.method}</td><td>{p.note ?? '—'}</td><td className="r">{fmtMoney(p.amount, false)}</td></tr>
                  ))}</tbody>
                </table>
              )}
          </div>
          <div style={{ width: '42%' }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Account Summary</div>
            <table className="rgb-sum"><tbody>
              <tr><td className="lbl">Balance (Hall) Amount</td><td className="val">{fmtMoney(b.balance_amount, false)}</td></tr>
              <tr><td className="lbl">Banquet Amount</td><td className="val">{fmtMoney(b.banquet_amount, false)}</td></tr>
              <tr className="total"><td>Total</td><td className="val">{fmtMoney(b.total_amount, false)}</td></tr>
              <tr><td className="lbl">Advance Paid</td><td className="val" style={{ color: '#2E7D32' }}>{fmtMoney(b.paid_amount, false)}</td></tr>
              <tr className="grand"><td>Balance Due</td><td className="val" style={{ color: due > 0 ? '#C62828' : '#2E7D32' }}>{fmtMoney(due, false)}</td></tr>
            </tbody></table>
          </div>
        </div>

        {!isCancelled && !isReturned && (
          <div className={`rgb-banner ${due > 0 ? 'rgb-banner-due' : 'rgb-banner-paid'}`}>
            {due > 0 ? `BALANCE DUE:  ${fmtMoney(due)}` : '✓  FULLY PAID — THANK YOU'}
          </div>
        )}

        {/* Reschedule history — the customer should see every date this
            booking has been moved to, and what it was worth at the time. */}
        {b.dateChanges && b.dateChanges.length > 0 && (
          <>
            <div className="rgb-sec">Event Date Changes</div>
            <table className="rgb-table">
              <thead><tr><th style={{ width: '18%' }}>Change</th><th>Previous Date</th><th>New Date</th><th className="r" style={{ width: '22%' }}>Amount</th></tr></thead>
              <tbody>
                {b.dateChanges.map((d) => (
                  <tr key={d.seq}>
                    <td>{ordinal(d.seq)} change</td>
                    <td>{fmtDate(d.from_date)}</td>
                    <td>{fmtDate(d.to_date)}</td>
                    <td className="r">{fmtMoney(d.amount, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Terms sit on the invoice itself — the slip is deliberately ONE
            page, so there is no reverse side to point the customer at. */}
        <InlineTerms rules={b.rules} notes={b.notes} />

        <div className="rgb-signs" style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <div className="rgb-sign-line">Customer Signature</div>
          <div className="rgb-stamp">STAMP</div>
          <div className="rgb-sign-line">{b.booked_by || 'Authorised Signature'}</div>
        </div>
      </div>
      <FooterBand brand={brand} />
    </div>
  );
}

// ── Enquiry / Quotation ────────────────────────────────
function addDays(s: string, days: number): string {
  const d = parseDate(s);
  if (isNaN(d.getTime())) return '—';
  d.setDate(d.getDate() + days);
  return fmtDate(d.toISOString().slice(0, 10));
}

/**
 * The enquiry / quotation — ONE page, same as the invoice. Terms print on the
 * slip itself rather than overleaf.
 */
export function InquiryDoc({ b, brand, note }: { b: InvoiceData; brand: BrandInfo; note?: string[] }) {
  return <InquiryFront b={b} brand={brand} note={note} />;
}

function InquiryFront({ b, brand, note }: { b: InvoiceData; brand: BrandInfo; note?: string[] }) {
  // Edited from Settings → Enquiry slip note. Empty means the client cleared
  // it, so the block is dropped rather than substituting wording of our own.
  const points = note ?? [];
  return (
    // One sheet, so no `rgb-frontsheet` page break — see the invoice above.
    <div className="rgb-sheet rgb-onepage">
      <LogoBand brand={brand} />
      <div className="rgb-body">
        <div className="rgb-meta">
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">Booking Enquiry</div>
            <div className="rgb-slipno">Enquiry # {b.slip_no}</div>
            <div style={{ fontSize: '11px', color: '#6b6455', marginTop: '2px', fontWeight: 600 }}>Enquiry Date: {fmtDate(b.booking_date)} ({weekday(b.booking_date)})</div>
            <div style={{ marginTop: '4px' }}><span className="rgb-badge rgb-badge-enquiry">Quotation</span></div>
          </div>
        </div>

        {/* Client & event details */}
        <table className="rgb-kv"><tbody>
          <tr><td className="k">Party Name</td><td>{b.party_name}</td><td className="k">Enquiry Date</td><td>{fmtDate(b.booking_date)} ({weekday(b.booking_date)})</td></tr>
          <tr><td className="k">Phone</td><td>{fmtPhone(b.phone)}</td><td className="k">Event Date</td><td>{fmtDate(b.event_date)} ({weekday(b.event_date)})</td></tr>
          <tr><td className="k">Secondary Phone</td><td>{fmtPhone(b.phone2)}</td><td className="k">Shift</td><td>{shiftLabel(b.shift)}</td></tr>
          <tr><td className="k">Address</td><td>{b.address || '—'}</td><td className="k">Hall / Lawn</td><td>{b.hall}</td></tr>
          <tr><td className="k">Guests</td><td>{b.guest_count}</td><td className="k">Valid Until</td><td>{addDays(b.booking_date, 7)}</td></tr>
        </tbody></table>

        {/* Estimated services */}
        <div className="rgb-sec">Estimated Services</div>
        <table className="rgb-table">
          <thead><tr><th style={{ width: '8%' }}>S.No</th><th>Description</th><th className="r" style={{ width: '10%' }}>Qty</th><th className="r" style={{ width: '18%' }}>Rate</th><th className="r" style={{ width: '20%' }}>Amount</th></tr></thead>
          <tbody>
            {b.items.length === 0
              ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8a8574' }}>Hall booking only — no additional services.</td></tr>
              : b.items.map((it, i) => (
                <tr key={i}><td>{i + 1}</td><td>{it.label}</td><td className="r">{it.qty}</td><td className="r">{fmtMoney(it.rate, false)}</td><td className="r">{fmtMoney(it.subtotal, false)}</td></tr>
              ))}
          </tbody>
          <tfoot><tr><td colSpan={4} className="r">Banquet Amount</td><td className="r">{fmtMoney(b.banquet_amount, false)}</td></tr></tfoot>
        </table>

        <ComplementaryBlock />

        {/* Estimate summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
          <div style={{ width: '42%' }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Estimate Summary</div>
            <table className="rgb-sum"><tbody>
              <tr><td className="lbl">Balance (Hall) Amount</td><td className="val">{fmtMoney(b.balance_amount, false)}</td></tr>
              <tr><td className="lbl">Banquet Amount</td><td className="val">{fmtMoney(b.banquet_amount, false)}</td></tr>
              <tr className="grand"><td>Estimated Total</td><td className="val">{fmtMoney(b.total_amount, false)}</td></tr>
            </tbody></table>
          </div>
        </div>

        <div className="rgb-banner rgb-banner-enquiry">
          ESTIMATED TOTAL:  {fmtMoney(b.total_amount)}
        </div>

        {/* The quotation disclaimer is the whole point of an enquiry slip, so
            it leads; the terms follow inline. Both on page 1 — the slip is
            deliberately ONE page. */}
        {points.length > 0 && (
          <div className="rgb-terms">
            <strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Please Note</strong><br />
            {points.map((t, i) => (
              <span key={i} className={isRtl(t) ? 'rgb-urdu' : undefined} dir={isRtl(t) ? 'rtl' : 'ltr'}>
                {i + 1}. {t} &nbsp;
              </span>
            ))}
          </div>
        )}

        <InlineTerms rules={b.rules} notes={b.notes} />

        <div className="rgb-signs" style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <div className="rgb-sign-line">Customer Signature</div>
          <div className="rgb-stamp">STAMP</div>
          <div className="rgb-sign-line">{b.booked_by || 'Authorised Signature'}</div>
        </div>
      </div>
      <FooterBand brand={brand} />
    </div>
  );
}

// ── Income Statement ───────────────────────────────────
export interface IncomeData {
  dateFrom: string; dateTo: string;
  balanceAmount: number; banquetAmount: number; advanceBookingSale: number; total: number;
  lines: { name: string; total: number; qty_note?: string | null }[];
  totalExpenses: number; showProfit: boolean;
  footer: { sale: number; expenses: number; total: number; naseemReturn: number; naseemReturn2: number; totalNetProfit: number };
}

export function IncomeDoc({ d, brand }: { d: IncomeData; brand: BrandInfo }) {
  const active = d.lines.filter((l) => l.total !== 0);
  const mid = Math.ceil(active.length / 2);
  const cols = [active.slice(0, mid), active.slice(mid)];

  return (
    <div className="rgb-sheet rgb-onepage">
      <LogoBand brand={brand} />
      <div className="rgb-body">
        <div className="rgb-meta">
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">Income Statement</div>
            <div className="rgb-slipno">{fmtDate(d.dateFrom)} — {fmtDate(d.dateTo)}</div>
          </div>
        </div>

        <div className="rgb-kpis">
          <div className="rgb-kpi"><div className="rgb-kpi-lbl">Balance Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(d.balanceAmount)}</div></div>
          <div className="rgb-kpi"><div className="rgb-kpi-lbl">Banquet Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(d.banquetAmount)}</div></div>
          <div className="rgb-kpi"><div className="rgb-kpi-lbl">Advance Booking</div><div className="rgb-kpi-val tnum2">{fmtMoney(d.advanceBookingSale)}</div></div>
          <div className="rgb-kpi rgb-kpi-gold"><div className="rgb-kpi-lbl">Total Sale</div><div className="rgb-kpi-val tnum2" style={{ color: '#8a6d15' }}>{fmtMoney(d.total)}</div></div>
        </div>

        <div className="rgb-sec">Expenses by Head</div>
        <div style={{ display: 'flex', gap: '14px' }}>
          {cols.map((col, ci) => (
            <table key={ci} className="rgb-table" style={{ flex: 1 }}>
              <tbody>
                {col.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}{l.qty_note ? <span style={{ color: '#a49c88' }}> ({l.qty_note})</span> : ''}</td>
                    <td className="r" style={{ width: '34%' }}>{fmtMoney(l.total, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        <table className="rgb-table" style={{ marginTop: '8px' }}>
          <tfoot><tr><td style={{ fontWeight: 700 }}>TOTAL EXPENSES</td><td className="r" style={{ width: '20%' }}>{fmtMoney(d.totalExpenses, false)}</td></tr></tfoot>
        </table>

        {d.showProfit && (
          <>
            <div className="rgb-sec">Summary</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <table className="rgb-sum" style={{ width: '55%' }}><tbody>
                <tr><td className="lbl">SALE</td><td className="val">{fmtMoney(d.footer.sale, false)}</td></tr>
                <tr><td className="lbl">EXPENSES</td><td className="val" style={{ color: '#C62828' }}>-{fmtMoney(d.footer.expenses, false)}</td></tr>
                <tr className="total"><td>TOTAL</td><td className="val">{fmtMoney(d.footer.total, false)}</td></tr>
                <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(float held)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(d.footer.naseemReturn, false)}</td></tr>
                <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(returned)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(d.footer.naseemReturn2, false)}</td></tr>
                <tr className="grand"><td>TOTAL NET PROFIT</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(d.footer.totalNetProfit, false)}</td></tr>
              </tbody></table>
            </div>
          </>
        )}

        <div className="rgb-signs" style={{ justifyContent: 'flex-end' }}>
          <div className="rgb-sign-line" style={{ flex: 'none', width: '200px' }}>Owner Signature</div>
        </div>
      </div>
      <FooterBand brand={brand} />
    </div>
  );
}


// ── Monthly Report (4 pages: cover · petty cash · income · sale) ──
export interface ReportData {
  salary?: SalarySheetData;
  label: string; generated: string; showProfit: boolean;
  kpis: { totalSale: number; totalExpenses: number; netProfit: number; bookings: number };
  petty: { days: number; heads: { id: number; name: string }[]; cells: Record<string, number> };
  income: IncomeData;
  /** Margin on stock issued against the month's events. Omitted when none. */
  stockProfit?: { revenue: number; cost: number; profit: number;
    rows: { name: string; qty: number; revenue: number; cost: number; profit: number }[] };
  saleRows: { sNo: number; date: string; party: string; slip: string; balance: number; banquet: number; total: number }[];
  saleTotals: { balance: number; banquet: number; total: number };
  newBookingRows: { sNo: number; date: string; party: string; slip: string; eventDate: string; advance: number }[];
  newBookingTotal: number;
  pnl: { balanceAmount: number; banquetAmount: number; advanceBookingAmount: number; totalSale: number; expenses: number; total: number; naseemReturn: number; totalNetProfit: number };
  recon: { slip: string; disbursed: number; recorded: number; returned: number; outstanding: number; status: string }[];
}


// ── Salary sheet (mirrors the owner's paper sheet) ─────
export interface SalarySheetData {
  label: string;                     // e.g. "June 2026"
  rows: {
    id: number; name: string; position: string;
    /** Portal role, when this staff member also has a login. Printed beside the position. */
    userRole?: string | null;
    basic: number; workDays: number; attend: number; absent: number;
    advDeduction: number; loanDeduction: number; absenceDeduction: number;
    net: number; extraPay: number; payable: number;
  }[];
  loan: {
    columns: string[];
    rows: { id: number; name: string; position: string; opening: number; cells: number[]; total: number; balance: number }[];
  };
}

/** Blank cell for a zero — the paper sheet leaves these empty, not "0". */
function cell(n: number, dash = true) {
  if (!n) return dash ? '-' : '';
  // Negatives are shown in brackets, the way the accountant writes them.
  return n < 0 ? `(${fmtMoney(Math.abs(n), false)})` : fmtMoney(n, false);
}

export function SalarySheetDoc({ d, brand }: { d: SalarySheetData; brand: BrandInfo }) {
  const t = d.rows.reduce((a, r) => ({
    basic: a.basic + r.basic, adv: a.adv + r.advDeduction, loan: a.loan + r.loanDeduction,
    absent: a.absent + r.absenceDeduction, net: a.net + r.net,
    extra: a.extra + r.extraPay, payable: a.payable + r.payable,
  }), { basic: 0, adv: 0, loan: 0, absent: 0, net: 0, extra: 0, payable: 0 });

  const loanTotal = d.loan.rows.reduce((a, r) => a + r.balance, 0);

  return (
    <div className="rgb-landwrap"><div className="rgb-sheet rgb-sheet-land rgb-report-sheet">
      <LogoBand brand={brand} />
      <div className="rgb-body">
        <div className="rgb-salary-title">
          SKYLIGHT &nbsp;–&nbsp; <strong>SALARY SHEET</strong> &nbsp; MONTH OF {d.label.toUpperCase()}
        </div>

        <table className="rgb-table rgb-salary">
          <thead>
            <tr>
              <th>NAME</th><th>POSITION</th><th className="r">BASIC SALARY</th>
              <th className="c">WORK DAYS</th><th className="c">ATTEND</th><th className="c">ABSENT DAYS</th>
              <th className="r">ADV DEDUCTION</th><th className="r">LOAN DEDUCTION</th><th className="r">ABSENT DEDUCTION</th>
              <th className="r">NET SALARY</th><th className="r">EXTRA PAY DAY</th><th className="r">PAYABLE</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', color: '#8a8574' }}>No active staff.</td></tr>
            ) : d.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="rgb-pos">
                  {r.position}
                  {/* Skip when it would just repeat the designation — a manager
                      whose job title is "Manager" doesn't need it twice. */}
                  {r.userRole && r.userRole.toLowerCase() !== (r.position ?? '').trim().toLowerCase()
                    ? <span className="rgb-userrole">{r.userRole}</span>
                    : null}
                </td>
                <td className="r">{cell(r.basic)}</td>
                <td className="c">{r.workDays || ''}</td>
                <td className="c">{r.attend || ''}</td>
                <td className="c">{r.absent || ''}</td>
                <td className="r">{cell(r.advDeduction)}</td>
                <td className="r">{cell(r.loanDeduction)}</td>
                <td className="r">{cell(r.absenceDeduction)}</td>
                <td className="r">{cell(r.net)}</td>
                <td className="r">{cell(r.extraPay)}</td>
                <td className="r">{cell(r.payable)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}></td>
              <td className="r">{cell(t.basic)}</td>
              <td colSpan={3}></td>
              <td className="r">{cell(t.adv)}</td>
              <td className="r">{cell(t.loan)}</td>
              <td className="r">{cell(t.absent)}</td>
              <td className="r">{cell(t.net)}</td>
              <td className="r">{cell(t.extra)}</td>
              <td className="r">{cell(t.payable)}</td>
            </tr>
          </tfoot>
        </table>

        {/* ── Loan ledger block ── */}
        <div className="rgb-salary-sub">SKYLIGHT LOAN</div>
        <table className="rgb-table rgb-salary">
          <thead>
            <tr>
              <th>NAME</th><th className="r">OPENING BAL</th>
              {d.loan.columns.map((c, i) => <th key={c + i} className="r">{i + 1}-{c}</th>)}
              <th className="r">TOTAL</th><th className="r">BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {d.loan.rows.length === 0 ? (
              <tr><td colSpan={d.loan.columns.length + 4} style={{ textAlign: 'center', color: '#8a8574' }}>No staff loans outstanding.</td></tr>
            ) : d.loan.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}{r.position ? ` ${r.position}` : ''}</td>
                <td className="r">{cell(r.opening)}</td>
                {r.cells.map((v, i) => <td key={i} className="r">{cell(v)}</td>)}
                <td className="r">{cell(r.total)}</td>
                <td className="r">{cell(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={d.loan.columns.length + 1}></td>
              <td className="r">TOTAL LOAN</td>
              <td className="r">{cell(d.loan.rows.reduce((a, r) => a + r.total, 0))}</td>
              <td className="r">{cell(loanTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="rgb-owner-sign">
          <div className="rgb-owner-line"></div>
          <div className="rgb-owner-label"><em>Owner</em><br /><span>Signature</span></div>
        </div>
      </div>
      <FooterBand brand={brand} />
    </div>
    </div>
  );
}

export function ReportDoc({ r, brand }: { r: ReportData; brand: BrandInfo }) {
  const days = Array.from({ length: r.petty.days }, (_, i) => i + 1);
  const cell = (day: number, hid: number) => r.petty.cells[`${day}|${hid}`] ?? 0;
  const rowTotal = (hid: number) => days.reduce((s, d) => s + cell(d, hid), 0);
  const colTotal = (day: number) => r.petty.heads.reduce((s, h) => s + cell(day, h.id), 0);
  const grand = r.petty.heads.reduce((s, h) => s + rowTotal(h.id), 0);
  const inc = r.income;
  const active = inc.lines.filter((l) => l.total !== 0);
  const mid = Math.ceil(active.length / 2);
  const incCols = [active.slice(0, mid), active.slice(mid)];

  return (
    <>
      {/* ── Page 1 — Cover ── */}
      <div className="rgb-sheet rgb-report-sheet">
        <LogoBand size="lg" brand={brand} />
        <div className="rgb-body" style={{ display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
          <div style={{ marginTop: '30mm' }}>
            <div style={{ letterSpacing: '0.35em', fontSize: '11px', color: '#8a6d15', textTransform: 'uppercase' }}>Monthly Report</div>
            <div className="rgb-display" style={{ fontSize: '42px', color: '#1a1a1a', margin: '8px 0' }}>{r.label}</div>
            <div style={{ fontSize: '11px', color: '#6b6455' }}>Generated {r.generated} &nbsp;·&nbsp; Prepared for Owner</div>
          </div>
          <div className="rgb-kpis" style={{ maxWidth: '160mm', margin: '26px auto 0' }}>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Total Sale</div><div className="rgb-kpi-val tnum2">{fmtMoney(r.kpis.totalSale)}</div></div>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Total Expenses</div><div className="rgb-kpi-val tnum2">{fmtMoney(r.kpis.totalExpenses)}</div></div>
            {r.showProfit
              ? <div className="rgb-kpi rgb-kpi-gold"><div className="rgb-kpi-lbl">Net Profit</div><div className="rgb-kpi-val tnum2" style={{ color: '#8a6d15' }}>{fmtMoney(r.kpis.netProfit)}</div></div>
              : <div className="rgb-kpi"><div className="rgb-kpi-lbl">Advance</div><div className="rgb-kpi-val tnum2">{fmtMoney(r.newBookingTotal)}</div></div>}
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Bookings</div><div className="rgb-kpi-val tnum2">{r.kpis.bookings}</div></div>
          </div>
          <div style={{ marginTop: 'auto', fontSize: '9.5px', color: '#8a8574', letterSpacing: '0.05em' }}>
            CONTENTS &nbsp; 1. Summary &nbsp;·&nbsp; 2. Petty Cash Sheet &nbsp;·&nbsp; 3. Income Statement &nbsp;·&nbsp; 4. Monthly Sale
          </div>
        </div>
        <FooterBand brand={brand} />
      </div>

      {/* ── Page 2 — Petty Cash matrix (landscape) ── */}
      <div className="rgb-landwrap"><div className="rgb-sheet rgb-sheet-land rgb-report-sheet">
        <LogoBand brand={brand} />
        <div className="rgb-body">
          <div className="rgb-meta"><div style={{ textAlign: 'right' }}><div className="rgb-doc-title">Petty Cash Sheet</div><div className="rgb-slipno">{r.label}</div></div></div>
          <table className="rgb-table" style={{ fontSize: '6px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '30mm', fontSize: '6px' }}>Expense Head</th>
                {days.map((d) => <th key={d} className="r" style={{ padding: '3px 0.5px', fontSize: '5.5px' }}>{d}</th>)}
                <th className="r" style={{ width: '13mm', fontSize: '6px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {r.petty.heads.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontSize: '6.5px', padding: '2px 4px' }}>{h.name}</td>
                  {days.map((d) => { const v = cell(d, h.id); return <td key={d} className="r" style={{ padding: '2px 0.5px', fontSize: '5.5px' }}>{v ? fmtMoney(v, false) : ''}</td>; })}
                  <td className="r" style={{ padding: '2px 3px', fontSize: '6.5px', fontWeight: 700 }}>{rowTotal(h.id) ? fmtMoney(rowTotal(h.id), false) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontSize: '6.5px', fontWeight: 700 }}>TOTAL</td>
                {days.map((d) => <td key={d} className="r" style={{ padding: '2px 0.5px', fontSize: '5px' }}>{colTotal(d) ? fmtMoney(colTotal(d), false) : ''}</td>)}
                <td className="r" style={{ fontSize: '7px', fontWeight: 800 }}>{fmtMoney(grand, false)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="rgb-note" style={{ textAlign: 'left', marginTop: '6px' }}>All figures in rupees. Grand total: {fmtMoney(grand)}.</div>
        </div>
        <FooterBand brand={brand} />
      </div>
      </div>

      {/* ── Page 3 — Income Statement ── */}
      <div className="rgb-sheet rgb-report-sheet">
        <LogoBand brand={brand} />
        <div className="rgb-body">
          <div className="rgb-meta"><div style={{ textAlign: 'right' }}><div className="rgb-doc-title">Income Statement</div><div className="rgb-slipno">{fmtDate(inc.dateFrom)} — {fmtDate(inc.dateTo)}</div></div></div>
          <div className="rgb-kpis">
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Balance Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(inc.balanceAmount)}</div></div>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Banquet Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(inc.banquetAmount)}</div></div>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Advance Booking</div><div className="rgb-kpi-val tnum2">{fmtMoney(inc.advanceBookingSale)}</div></div>
            <div className="rgb-kpi rgb-kpi-gold"><div className="rgb-kpi-lbl">Total Sale</div><div className="rgb-kpi-val tnum2" style={{ color: '#8a6d15' }}>{fmtMoney(inc.total)}</div></div>
          </div>
          {r.stockProfit && r.stockProfit.rows.length > 0 && (
            <>
              <div className="rgb-sec">Stock Profit</div>
              <table className="rgb-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="r" style={{ width: '12%' }}>Qty</th>
                    <th className="r" style={{ width: '18%' }}>Billed</th>
                    <th className="r" style={{ width: '18%' }}>Cost</th>
                    <th className="r" style={{ width: '18%' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {r.stockProfit.rows.map((sr) => (
                    <tr key={sr.name}>
                      <td>{sr.name}</td>
                      <td className="r">{sr.qty}</td>
                      <td className="r">{fmtMoney(sr.revenue, false)}</td>
                      <td className="r">{fmtMoney(sr.cost, false)}</td>
                      <td className="r" style={{ color: sr.profit >= 0 ? '#2E7D32' : '#C62828' }}>{fmtMoney(sr.profit, false)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>TOTAL</td>
                    <td className="r">{fmtMoney(r.stockProfit.revenue, false)}</td>
                    <td className="r">{fmtMoney(r.stockProfit.cost, false)}</td>
                    <td className="r">{fmtMoney(r.stockProfit.profit, false)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          <div className="rgb-sec">Expenses by Head</div>
          <div style={{ display: 'flex', gap: '14px' }}>
            {incCols.map((col, ci) => (
              <table key={ci} className="rgb-table" style={{ flex: 1 }}><tbody>
                {col.map((l, i) => (
                  <tr key={i}><td>{l.name}{l.qty_note ? <span style={{ color: '#a49c88' }}> ({l.qty_note})</span> : ''}</td><td className="r" style={{ width: '34%' }}>{fmtMoney(l.total, false)}</td></tr>
                ))}
              </tbody></table>
            ))}
          </div>
          <table className="rgb-table" style={{ marginTop: '8px' }}><tfoot><tr><td style={{ fontWeight: 700 }}>TOTAL EXPENSES</td><td className="r" style={{ width: '20%' }}>{fmtMoney(inc.totalExpenses, false)}</td></tr></tfoot></table>
          {inc.showProfit && (
            <>
              <div className="rgb-sec">Summary</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <table className="rgb-sum" style={{ width: '55%' }}><tbody>
                  <tr><td className="lbl">SALE</td><td className="val">{fmtMoney(inc.footer.sale, false)}</td></tr>
                  <tr><td className="lbl">EXPENSES</td><td className="val" style={{ color: '#C62828' }}>-{fmtMoney(inc.footer.expenses, false)}</td></tr>
                  <tr className="total"><td>TOTAL</td><td className="val">{fmtMoney(inc.footer.total, false)}</td></tr>
                  <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(float held)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(inc.footer.naseemReturn, false)}</td></tr>
                  <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(returned)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(inc.footer.naseemReturn2, false)}</td></tr>
                  <tr className="grand"><td>TOTAL NET PROFIT</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(inc.footer.totalNetProfit, false)}</td></tr>
                </tbody></table>
              </div>
            </>
          )}
        </div>
        <FooterBand brand={brand} />
      </div>

      {/* ── Page 4 — Monthly Sale ── */}
      <div className="rgb-sheet rgb-report-sheet">
        <LogoBand brand={brand} />
        <div className="rgb-body">
          <div className="rgb-meta"><div style={{ textAlign: 'right' }}><div className="rgb-doc-title">Monthly Sale</div><div className="rgb-slipno">{r.label}</div></div></div>
          <div className="rgb-sec" style={{ marginTop: 0 }}>Settled Events</div>
          <table className="rgb-table">
            <thead><tr><th style={{ width: '6%' }}>#</th><th>Date</th><th>Party</th><th>Slip</th><th className="r">Balance</th><th className="r">Banquet</th><th className="r">Total</th></tr></thead>
            <tbody>{r.saleRows.map((s) => (
              <tr key={s.slip}><td>{s.sNo}</td><td>{fmtDate(s.date)}</td><td>{s.party}</td><td>{s.slip}</td><td className="r">{fmtMoney(s.balance, false)}</td><td className="r">{fmtMoney(s.banquet, false)}</td><td className="r">{fmtMoney(s.total, false)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={4}>TOTAL</td><td className="r">{fmtMoney(r.saleTotals.balance, false)}</td><td className="r">{fmtMoney(r.saleTotals.banquet, false)}</td><td className="r">{fmtMoney(r.saleTotals.total, false)}</td></tr></tfoot>
          </table>
          <div className="rgb-sec">New Bookings (Advances Received)</div>
          <table className="rgb-table">
            <thead><tr><th style={{ width: '6%' }}>#</th><th>Booked</th><th>Party</th><th>Slip</th><th>Event</th><th className="r">Advance</th></tr></thead>
            <tbody>{r.newBookingRows.map((s) => (
              <tr key={s.slip}><td>{s.sNo}</td><td>{fmtDate(s.date)}</td><td>{s.party}</td><td>{s.slip}</td><td>{fmtDate(s.eventDate)}</td><td className="r">{fmtMoney(s.advance, false)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={5}>TOTAL ADVANCE</td><td className="r">{fmtMoney(r.newBookingTotal, false)}</td></tr></tfoot>
          </table>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            {r.showProfit && (
              <div style={{ flex: 1 }}>
                <div className="rgb-sec">Profit &amp; Loss</div>
                <table className="rgb-sum"><tbody>
                  <tr><td className="lbl">Balance Amount</td><td className="val">{fmtMoney(r.pnl.balanceAmount, false)}</td></tr>
                  <tr><td className="lbl">Banquet Amount</td><td className="val">{fmtMoney(r.pnl.banquetAmount, false)}</td></tr>
                  <tr><td className="lbl">Advance Booking</td><td className="val">{fmtMoney(r.pnl.advanceBookingAmount, false)}</td></tr>
                  <tr className="total"><td>Total Sale</td><td className="val">{fmtMoney(r.pnl.totalSale, false)}</td></tr>
                  <tr><td className="lbl">Expenses</td><td className="val" style={{ color: '#C62828' }}>-{fmtMoney(r.pnl.expenses, false)}</td></tr>
                  <tr><td className="lbl">Naseem Return</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(r.pnl.naseemReturn, false)}</td></tr>
                  <tr className="grand"><td>Net Profit</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(r.pnl.totalNetProfit, false)}</td></tr>
                </tbody></table>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div className="rgb-sec">Manager Reconciliation</div>
              {r.recon.length === 0 ? <div style={{ fontSize: '10px', color: '#a49c88' }}>No float disbursed this month.</div> : (
                <table className="rgb-table">
                  <thead><tr><th>Slip</th><th className="r">Disbursed</th><th className="r">Recorded</th><th className="r">Outstanding</th></tr></thead>
                  <tbody>{r.recon.map((x, i) => (
                    <tr key={i}><td>{x.slip}</td><td className="r">{fmtMoney(x.disbursed, false)}</td><td className="r">{fmtMoney(x.recorded, false)}</td><td className="r">{fmtMoney(x.outstanding, false)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
          <div className="rgb-signs" style={{ justifyContent: 'space-between' }}>
            <div className="rgb-sign-line" style={{ flex: 'none', width: '200px' }}>Manager (Naseem)</div>
            <div className="rgb-sign-line" style={{ flex: 'none', width: '200px' }}>Owner (Usama)</div>
          </div>
        </div>
        <FooterBand brand={brand} />
      </div>

      {/* Salary sheet — mirrors the owner's paper sheet. */}
      {r.salary && <SalarySheetDoc d={r.salary} brand={brand} />}

    </>
  );
}

// ── Comments Card ──────────────────────────────────────
// A faithful reproduction of the printed feedback card Skylight hands to
// guests: seven categories, three boxes each, a comments panel and the guest's
// own details. Prints blank for hand-filling, or ticked when the guest has
// already submitted it online.

export interface CommentsCardData {
  guestName: string | null;
  guestPhone: string | null;
  eventDate: string | null;
  slipNo: string | null;
  comments: string | null;
  ratings: Partial<Record<ReviewCategoryKey, Rating>>;
  submitted: boolean;
  /** Public link printed at the foot so the guest can fill it in on a phone. */
  link?: string | null;
}

function TickBox({ on }: { on: boolean }) {
  return (
    <span className="rgb-cc-box">
      {on && (
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
          <path d="M2.5 8.5 L6.2 12 L13.5 4" fill="none" stroke="#1a1a1a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export function CommentsCardDoc({ d, brand }: { d: CommentsCardData; brand: BrandInfo }) {
  return (
    <div className="rgb-sheet rgb-onepage">
      <LogoBand brand={brand} />
      <div className="rgb-body">
        <div className="rgb-cc-title">Comments Card</div>

        <table className="rgb-cc-grid"><tbody>
          {REVIEW_CATEGORIES.map((c) => (
            <tr key={c.key}>
              <td className="rgb-cc-cat"><span className="rgb-cc-catlabel">{c.label}</span></td>
              <td className="rgb-cc-colon">:</td>
              {RATING_VALUES.map((v) => (
                <td key={v} className="rgb-cc-opt">
                  <span className="rgb-cc-optlabel">
                    {v.charAt(0) + v.slice(1).toLowerCase()}
                  </span>
                  <TickBox on={d.ratings[c.key] === v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody></table>

        <div className="rgb-cc-panel">
          <div className="rgb-cc-panelhead">Comments / Suggestion / Complaint</div>
          <div className="rgb-cc-panelbody">
            {d.comments
              ? <div className="rgb-cc-written">{d.comments}</div>
              : <><div className="rgb-cc-rule" /><div className="rgb-cc-rule" /><div className="rgb-cc-rule" /></>}
          </div>
        </div>

        <div className="rgb-cc-panel">
          <div className="rgb-cc-panelhead">Customer Information</div>
          <div className="rgb-cc-panelbody">
            <div className="rgb-cc-field"><span className="rgb-cc-flabel">Name</span><span className="rgb-cc-fval">{d.guestName || ''}</span></div>
            <div className="rgb-cc-field"><span className="rgb-cc-flabel">Event Date</span><span className="rgb-cc-fval">{d.eventDate ? fmtDate(d.eventDate) : ''}</span></div>
            <div className="rgb-cc-field"><span className="rgb-cc-flabel">Cell # :</span><span className="rgb-cc-fval">{d.guestPhone ? fmtPhone(d.guestPhone) : ''}</span></div>
          </div>
        </div>

        {d.link && !d.submitted && (
          <div className="rgb-cc-link">
            Prefer your phone? Fill this card online at <b>{d.link}</b>
          </div>
        )}
        {d.slipNo && <div className="rgb-cc-slip">Slip # {d.slipNo}</div>}
      </div>
      <FooterBand brand={brand} />
    </div>
  );
}

// ── Catering monthly report ────────────────────────────

export interface CateringReportDocData {
  label: string;
  generated: string;
  rows: {
    sNo: number; date: string; customer: string; docNo: string; invoiced: boolean;
    items: number; meat: number; total: number; vendor: number; received: number;
    profit: number; paymentType: string;
  }[];
  totals: { items: number; meat: number; total: number; vendor: number; received: number; profit: number };
  byMethod: { method: string; amount: number }[];
}

/**
 * The catering month, on the ballroom's paper.
 *
 * Same sheet, same bands, same table treatment as the monthly sale page, so
 * the two businesses file identically. The columns mirror it too: the
 * ballroom prints Balance / Banquet / Total, and catering's equivalent three
 * are Items / Meat / Total, followed by what the event cost and what it made.
 *
 * Landscape, because eleven columns will not sit on a portrait A4 without
 * shrinking the type past reading size.
 */
export function CateringReportDoc({ r, p, brand }: {
  r: CateringReportDocData;
  p: CateringDocProfile;
  brand: BrandInfo;
}) {
  const cateringName = p.name || brand.name;
  const cateringBrand: BrandInfo = {
    ...brand,
    name: cateringName,
    tagline: cateringName.split(' ').slice(1).join(' ') || brand.tagline,
    address: p.address || brand.address,
    footerPhone: p.phone || brand.footerPhone,
  };

  const money = (n: number) => fmtMoney(n, false);

  return (
    <div className="rgb-landwrap"><div className="rgb-sheet rgb-sheet-land rgb-report-sheet">
      <LogoBand brand={cateringBrand} />
      <div className="rgb-body">
        <div className="rgb-meta">
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">Catering Report</div>
            <div className="rgb-slipno">{r.label}</div>
            <div style={{ fontSize: '11px', color: '#6b6455', marginTop: '2px', fontWeight: 600 }}>
              Generated: {fmtDate(r.generated)}
            </div>
          </div>
        </div>

        <div className="rgb-sec" style={{ marginTop: 0 }}>Events</div>
        <table className="rgb-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>#</th>
              <th style={{ width: '9%' }}>Date</th>
              <th>Customer</th>
              <th style={{ width: '10%' }}>Document</th>
              <th className="r" style={{ width: '10%' }}>Items</th>
              <th className="r" style={{ width: '9%' }}>Meat</th>
              <th className="r" style={{ width: '10%' }}>Total</th>
              <th className="r" style={{ width: '10%' }}>Vendor</th>
              <th className="r" style={{ width: '10%' }}>Received</th>
              <th className="r" style={{ width: '10%' }}>Profit</th>
              <th style={{ width: '10%' }}>Payment</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((e) => (
              <tr key={e.docNo}>
                <td>{e.sNo}</td>
                <td>{fmtDate(e.date)}</td>
                <td>{e.customer || '—'}</td>
                <td>
                  {e.docNo}
                  {!e.invoiced && <span style={{ color: '#a49c88' }}> (quote)</span>}
                </td>
                <td className="r">{money(e.items)}</td>
                <td className="r">{money(e.meat)}</td>
                <td className="r">{money(e.total)}</td>
                <td className="r">{money(e.vendor)}</td>
                <td className="r">{money(e.received)}</td>
                <td className="r" style={{ color: e.profit >= 0 ? '#2E7D32' : '#C62828' }}>{money(e.profit)}</td>
                <td>{e.paymentType || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>TOTAL</td>
              <td className="r">{money(r.totals.items)}</td>
              <td className="r">{money(r.totals.meat)}</td>
              <td className="r">{money(r.totals.total)}</td>
              <td className="r">{money(r.totals.vendor)}</td>
              <td className="r">{money(r.totals.received)}</td>
              <td className="r">{money(r.totals.profit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
          <div style={{ width: '46%' }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Receipts by Method</div>
            <table className="rgb-table">
              <thead><tr><th>Method</th><th className="r" style={{ width: '40%' }}>Amount</th></tr></thead>
              <tbody>
                {r.byMethod.length === 0
                  ? <tr><td colSpan={2} style={{ color: '#a49c88' }}>No receipts in this period</td></tr>
                  : r.byMethod.map((m) => (
                    <tr key={m.method}><td>{m.method}</td><td className="r">{money(m.amount)}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ width: '40%' }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Summary</div>
            <table className="rgb-sum"><tbody>
              <tr><td className="lbl">Events</td><td className="val">{r.rows.length}</td></tr>
              <tr><td className="lbl">Revenue</td><td className="val">{money(r.totals.total)}</td></tr>
              <tr><td className="lbl">Vendor Cost</td><td className="val">{money(r.totals.vendor)}</td></tr>
              <tr className="total"><td>Profit Earned</td><td className="val">{money(r.totals.profit)}</td></tr>
              <tr><td className="lbl">Received</td><td className="val" style={{ color: '#2E7D32' }}>{money(r.totals.received)}</td></tr>
              <tr className="grand">
                <td>Balance Due</td>
                <td className="val" style={{ color: r.totals.total - r.totals.received > 0 ? '#C62828' : '#2E7D32' }}>
                  {money(Math.max(0, r.totals.total - r.totals.received))}
                </td>
              </tr>
            </tbody></table>
          </div>
        </div>

        <div className="rgb-signs" style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <div className="rgb-sign-line">Prepared By</div>
          <div className="rgb-stamp">STAMP</div>
          <div className="rgb-sign-line">Authorised Signature</div>
        </div>
      </div>
      <FooterBand brand={cateringBrand} />
    </div></div>
  );
}

// ── Catering quotation ─────────────────────────────────
export interface CateringDocData {
  quotaNo: string;
  customerName: string;
  contactNo: string;
  placeOfFunction: string;
  quotationDate: string;
  deliveryDate: string | null;
  persons: number;
  itemsTotal: number;
  meatTotal: number;
  grandTotal: number;
  paidAmount: number;
  status: string;
  note: string | null;
  /** Quotation or invoice. Changes the title, the labels and the number's name. */
  docType?: 'QUOTATION' | 'INVOICE';
  lines: {
    section: 'DISH' | 'CHARGE' | 'MEAT';
    description: string;
    category: string;
    qty: number;
    unit: string;
    rate: number;
    amount: number;
  }[];
}

export interface CateringDocProfile {
  name: string; person: string; phone: string; address: string; terms: string; note: string;
  /** Printed in the header beside the status. Blank hides the line entirely. */
  taxNote?: string;
}

/**
 * The catering quotation slip.
 *
 * Carries every field the client's existing paper form does — quota number,
 * place of function, event date, headcount, the dish grid with its
 * CATEGORIES and KG/PCS columns, the transport/service charges, the meat
 * supplied under its own subtotal, and the terms — but wears the SAME design
 * as the booking invoice. One house style across both businesses.
 */
export function CateringQuotationDoc({ d, p, rules = [], brand }: {
  d: CateringDocData; p: CateringDocProfile; rules?: string[]; brand: BrandInfo;
}) {
  const dishes = d.lines.filter((l) => l.section === 'DISH');
  const charges = d.lines.filter((l) => l.section === 'CHARGE');
  const meat = d.lines.filter((l) => l.section === 'MEAT');
  const balance = d.grandTotal - d.paidAmount;

  const badge = d.status === 'CANCELLED'
    ? { c: 'rgb-badge-cancelled', t: 'Cancelled' }
    : d.status === 'QUOTATION'
      ? { c: 'rgb-badge-enquiry', t: 'Quotation' }
      : balance <= 0.01
        ? { c: 'rgb-badge-paid', t: 'Fully Paid' }
        : d.paidAmount > 0
          ? { c: 'rgb-badge-partial', t: 'Partially Paid' }
          : { c: 'rgb-badge-due', t: 'Outstanding' };

  // The catering arm trades under its own name and shop address, so the bands
  // carry those rather than the ballroom's.
  // `wordmark()` drops the tagline from the big line when the name ends with
  // it, so these two must agree or the letterhead prints the name twice over.
  const cateringName = p.name || brand.name;
  const cateringBrand: BrandInfo = {
    ...brand,
    name: cateringName,
    tagline: cateringName.split(' ').slice(1).join(' ') || brand.tagline,
    address: p.address || brand.address,
    footerPhone: p.phone || brand.footerPhone,
  };

  /**
   * The catering slip carries TWO tables plus a summary where the invoice
   * carries one, so the shared one-page tuning is not enough on a long
   * quotation — past roughly a dozen lines the sheet grows beyond the printable
   * strip and throws the footer band onto a second page.
   *
   * Tighten by line count rather than letting it spill. Thresholds were set by
   * measuring the rendered sheet in a browser against the real quotations —
   * see the matching block in print.css for the numbers.
   */
  // An invoice is billed after the event; a quotation is the estimate before
  // it. Same layout, different wording, so a customer holding both can tell
  // instantly which one they are looking at.
  const isInvoice = d.docType === 'INVOICE';

  const rowCount = dishes.length + charges.length + meat.length;
  const density = rowCount > 13 ? ' rgb-cater--xx'
    : rowCount > 10 ? ' rgb-cater--x'
      : rowCount > 6 ? ' rgb-cater--dense' : '';

  return (
    <div className={`rgb-sheet rgb-onepage rgb-cater${density}`}>
      <LogoBand brand={cateringBrand} />
      <div className="rgb-body">
        <div className="rgb-meta">
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">{isInvoice ? 'Catering Invoice' : 'Catering Quotation'}</div>
            <div className="rgb-slipno">{isInvoice ? 'Invoice' : 'Quota'} # {d.quotaNo}</div>
            <div style={{ fontSize: '11px', color: '#6b6455', marginTop: '2px', fontWeight: 600 }}>
              {isInvoice ? 'Invoice' : 'Quotation'} Date: {fmtDate(d.quotationDate)}
            </div>
            {/* Money terms read top-down: the tax condition sits directly
                above the status, so it is met before the balance. */}
            {p.taxNote && <div className="rgb-taxnote">{p.taxNote}</div>}
            <div style={{ marginTop: '4px' }}><span className={`rgb-badge ${badge.c}`}>{badge.t}</span></div>
          </div>
        </div>

        <table className="rgb-kv">
          <tbody>
            <tr>
              <td className="k">Name</td><td>{d.customerName || '—'}</td>
              <td className="k">Quotation Date</td><td>{fmtDate(d.quotationDate)}</td>
            </tr>
            <tr>
              <td className="k">Contact No.</td><td>{fmtPhone(d.contactNo)}</td>
              <td className="k">Event Date</td><td>{d.deliveryDate ? fmtDate(d.deliveryDate) : '—'}</td>
            </tr>
            <tr>
              <td className="k">Place of Function</td><td>{d.placeOfFunction || '—'}</td>
              <td className="k">Persons</td><td>{d.persons || '—'}</td>
            </tr>
          </tbody>
        </table>

        <div className="rgb-sec">Required Items (Making Price)</div>
        <table className="rgb-table">
          <thead>
            <tr>
              <th className="c" style={{ width: '6%' }}>S.No</th>
              <th style={{ width: '34%' }}>Description</th>
              <th style={{ width: '20%' }}>Categories</th>
              <th className="r" style={{ width: '13%' }}>Quantity</th>
              <th className="r" style={{ width: '13%' }}>Rate</th>
              <th className="r" style={{ width: '14%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((l, i) => (
              <tr key={`d${i}`}>
                <td className="c">{i + 1}</td>
                <td>{l.description}</td>
                <td>{l.category || '—'}</td>
                <td className="r">{l.qty ? `${fmtMoney(l.qty, false)} ${l.unit}` : '—'}</td>
                <td className="r">{l.rate ? fmtMoney(l.rate, false) : '—'}</td>
                <td className="r">{fmtMoney(l.amount, false)}</td>
              </tr>
            ))}
            {/* Transport / service — an amount with no qty or rate. */}
            {charges.map((l, i) => (
              <tr key={`c${i}`}>
                <td className="c" />
                <td>{l.description}</td>
                <td colSpan={3} style={{ color: '#a49c88' }}>Charge</td>
                <td className="r">{fmtMoney(l.amount, false)}</td>
              </tr>
            ))}
            <tr className="rgb-row-total">
              <td colSpan={5} className="r">Items Total</td>
              <td className="r">{fmtMoney(d.itemsTotal, false)}</td>
            </tr>
          </tbody>
        </table>

        {meat.length > 0 && (
          <>
            <div className="rgb-sec">Meat Price</div>
            <table className="rgb-table">
              <thead>
                <tr>
                  <th style={{ width: '46%' }}>Description</th>
                  <th style={{ width: '20%' }}>Categories</th>
                  <th className="r" style={{ width: '13%' }}>KG / PCS</th>
                  <th className="r" style={{ width: '13%' }}>Rate</th>
                  <th className="r" style={{ width: '14%' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {meat.map((l, i) => (
                  <tr key={`m${i}`}>
                    <td>{l.description}</td>
                    <td>{l.category || '—'}</td>
                    <td className="r">{l.qty ? `${fmtMoney(l.qty, false)} ${l.unit}` : '—'}</td>
                    <td className="r">{l.rate ? fmtMoney(l.rate, false) : '—'}</td>
                    <td className="r">{fmtMoney(l.amount, false)}</td>
                  </tr>
                ))}
                <tr className="rgb-row-total">
                  <td colSpan={4} className="r">Meat Total</td>
                  <td className="r">{fmtMoney(d.meatTotal, false)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
          <div style={{ flex: 1 }} />
          <div style={{ width: '46%' }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Account Summary</div>
            <table className="rgb-sum"><tbody>
              <tr><td className="lbl">Items Total</td><td className="val">{fmtMoney(d.itemsTotal, false)}</td></tr>
              <tr><td className="lbl">Meat Price</td><td className="val">{fmtMoney(d.meatTotal, false)}</td></tr>
              <tr className="total"><td>Grand Total</td><td className="val">{fmtMoney(d.grandTotal, false)}</td></tr>
              <tr><td className="lbl">Advance Received</td><td className="val" style={{ color: '#2E7D32' }}>{fmtMoney(d.paidAmount, false)}</td></tr>
              <tr className="grand"><td>Balance</td><td className="val" style={{ color: balance > 0 ? '#C62828' : '#2E7D32' }}>{fmtMoney(balance, false)}</td></tr>
            </tbody></table>
          </div>
        </div>

        {d.status !== 'CANCELLED' && (
          <div className={`rgb-banner ${balance > 0 ? 'rgb-banner-due' : 'rgb-banner-paid'}`}>
            {balance > 0 ? `BALANCE:  ${fmtMoney(balance)}` : '✓  FULLY PAID — THANK YOU'}
          </div>
        )}

        {/* Payment terms first, then the standing rules from Catering → Rules,
            then the meat-price disclaimer, then anything typed on this one
            quotation. */}
        <InlineTerms
          rules={[p.terms, ...rules, p.note, ...(d.note ? [d.note] : [])].filter(Boolean) as string[]}
          notes={null}
        />

        <div className="rgb-signs" style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <div className="rgb-sign-line">{p.person || 'Customer Signature'}</div>
          <div className="rgb-stamp">STAMP</div>
          <div className="rgb-sign-line">Authorised Signature</div>
        </div>
      </div>
      <FooterBand brand={cateringBrand} />
    </div>
  );
}
