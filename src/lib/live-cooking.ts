/**
 * Live Cooking — read layer.
 *
 * Live Cooking is sold as an ordinary banquet service, so its money is already
 * inside the booking total and the banquet income statement. What is separate
 * is the VIEW: these queries pull the Live Cooking lines back out on their own
 * so a Super Admin can see exactly what that one service brings in, and nobody
 * else can. The gate is `livecooking.view` — see permissions.ts.
 */
import { query, queryOne } from '@/lib/db';
import { monthRange, monthLabel } from '@/lib/format';
import type { LiveCookingLineRow, LiveCookingSummary } from '@/lib/types';

const num = (v: unknown) => Number(v ?? 0);

/**
 * Bookings that never happened must not count as revenue. Enquiries are
 * quotes and cancellations are nothing, so both are excluded everywhere here.
 */
const LIVE_STATUSES = `'CONFIRMED','COMPLETED'`;

/** Every Live Cooking line sold in the period, newest event first. */
export async function getLiveCookingLines(from: string, to: string, limit = 300): Promise<LiveCookingLineRow[]> {
  // LIMIT will not bind through mysql2's binary protocol, so it is inlined
  // after being coerced to a safe integer.
  const n = Math.max(1, Math.min(1000, Math.trunc(limit) || 300));
  const rows = await query<any>(
    `SELECT s.id, s.booking_id, s.label, s.qty, s.rate, s.subtotal,
            b.slip_no, b.event_date, b.shift, b.status AS booking_status, b.guest_count,
            p.party_name, p.phone, h.name AS hall
       FROM booking_service_items s
       JOIN bookings b ON b.id = s.booking_id
       JOIN parties  p ON p.id = b.party_id
       JOIN halls    h ON h.id = b.hall_id
      WHERE s.service_kind = 'LIVE_COOKING'
        AND b.status IN (${LIVE_STATUSES})
        AND b.event_date BETWEEN ? AND ?
      ORDER BY b.event_date DESC, s.id
      LIMIT ${n}`,
    [from, to],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    bookingId: Number(r.booking_id),
    slipNo: r.slip_no,
    partyName: r.party_name,
    phone: r.phone ?? null,
    hall: r.hall,
    eventDate: r.event_date,
    shift: r.shift,
    bookingStatus: r.booking_status,
    guestCount: Number(r.guest_count ?? 0),
    label: r.label,
    qty: num(r.qty),
    rate: num(r.rate),
    subtotal: num(r.subtotal),
  }));
}

/** Headline Live Cooking figures for a period, with banquet context. */
export async function getLiveCookingSummary(from: string, to: string): Promise<LiveCookingSummary> {
  const r = await queryOne<any>(
    `SELECT
       COUNT(DISTINCT CASE WHEN s.service_kind = 'LIVE_COOKING' THEN b.id END)        AS bookings,
       COALESCE(SUM(CASE WHEN s.service_kind = 'LIVE_COOKING' THEN s.qty END), 0)     AS qty,
       COALESCE(SUM(CASE WHEN s.service_kind = 'LIVE_COOKING' THEN s.subtotal END),0) AS revenue,
       COALESCE(SUM(s.subtotal), 0)                                                   AS all_services
     FROM booking_service_items s
     JOIN bookings b ON b.id = s.booking_id
     WHERE b.status IN (${LIVE_STATUSES}) AND b.event_date BETWEEN ? AND ?`,
    [from, to],
  );

  // Guests are counted per BOOKING, so they cannot be summed in the query
  // above — two Live Cooking lines on one booking would double the headcount.
  const g = await queryOne<any>(
    `SELECT COALESCE(SUM(b.guest_count), 0) AS guests
       FROM bookings b
      WHERE b.status IN (${LIVE_STATUSES})
        AND b.event_date BETWEEN ? AND ?
        AND EXISTS (
          SELECT 1 FROM booking_service_items s
           WHERE s.booking_id = b.id AND s.service_kind = 'LIVE_COOKING'
        )`,
    [from, to],
  );

  const bookings = Number(r?.bookings ?? 0);
  const revenue = num(r?.revenue);
  const allServices = num(r?.all_services);
  return {
    bookings,
    qty: num(r?.qty),
    revenue,
    guests: Number(g?.guests ?? 0),
    avgPerBooking: bookings > 0 ? Math.round(revenue / bookings) : 0,
    sharePct: allServices > 0 ? Math.round((revenue / allServices) * 1000) / 10 : 0,
    allServicesRevenue: allServices,
  };
}

/** Month-by-month Live Cooking trend, oldest first. */
export async function getLiveCookingTrend(year: number, month: number, months = 6) {
  const out: { label: string; revenue: number; bookings: number; allServices: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const { from, to } = monthRange(y, m);
    const s = await getLiveCookingSummary(from, to);
    out.push({ label: monthLabel(y, m), revenue: s.revenue, bookings: s.bookings, allServices: s.allServicesRevenue });
  }
  return out;
}

/**
 * How Live Cooking compares with every other banquet service in the period.
 * Gives the Super Admin the "is this service worth it?" answer at a glance.
 */
export async function getServiceMix(from: string, to: string) {
  const rows = await query<any>(
    `SELECT s.label, s.service_kind,
            SUM(s.qty)               AS qty,
            SUM(s.subtotal)          AS revenue,
            COUNT(DISTINCT b.id)     AS bookings
       FROM booking_service_items s
       JOIN bookings b ON b.id = s.booking_id
      WHERE b.status IN (${LIVE_STATUSES}) AND b.event_date BETWEEN ? AND ?
      GROUP BY s.label, s.service_kind
      ORDER BY revenue DESC`,
    [from, to],
  );
  return rows.map((r) => ({
    label: r.label as string,
    kind: r.service_kind as 'BANQUET' | 'LIVE_COOKING',
    qty: num(r.qty),
    revenue: num(r.revenue),
    bookings: Number(r.bookings ?? 0),
  }));
}
