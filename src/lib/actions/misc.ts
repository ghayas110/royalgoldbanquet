'use server';

import { z } from 'zod';
import { execute } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// ── Settings ───────────────────────────────────────────
export async function setSetting(key: string, value: string): Promise<{ ok: boolean }> {
  const actor = await assertPermission('settings.manage');
  await execute(`INSERT INTO settings (\`key\`, \`value\`) VALUES (?,?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [key, value]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'setting', entityId: key, after: { value } });
  revalidatePath('/app/settings');
  return { ok: true };
}

// ── Leads ──────────────────────────────────────────────
export async function setLeadStatus(id: number, status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'): Promise<{ ok: boolean }> {
  const actor = await assertPermission('leads.view');
  await execute(`UPDATE leads SET status = ? WHERE id = ?`, [status, id]);
  await audit({ userId: actor.id, action: 'STATUS', entity: 'lead', entityId: id, after: { status } });
  revalidatePath('/app/leads');
  return { ok: true };
}

// ── Public lead capture (no auth) ──────────────────────
const leadSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(6).max(40),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  source: z.string().max(40).default('WEBSITE'),
});

export async function createLead(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { name, phone, eventDate, message, source } = parsed.data;
  const res = await execute(
    `INSERT INTO leads (name, phone, event_date, message, source, status) VALUES (?,?,?,?,?,'NEW')`,
    [name, phone, eventDate || null, message || null, source],
  );

  // Public form — nobody is signed in, so this is the only way staff hear
  // about it. Never allowed to fail the submission for the visitor.
  const { notifyLead } = await import('@/lib/notify');
  await notifyLead({ leadId: res.insertId, name, phone, eventDate, message }).catch(() => undefined);

  revalidatePath('/app/leads');
  return { ok: true };
}

// ── Public availability check (no auth) ─────────────────
import { getCalendarBookings } from '@/lib/data';
import { monthRange } from '@/lib/format';

export async function fetchPublicAvailability(year: number, month: number) {
  const safeYear = Math.max(2025, Math.min(2035, Number(year) || 2026));
  const safeMonth = Math.max(1, Math.min(12, Number(month) || 1));
  const bookings = await getCalendarBookings(safeYear, safeMonth, true);
  return {
    year: safeYear,
    month: safeMonth,
    days: monthRange(safeYear, safeMonth).days,
    bookings: bookings.map((b: any) => ({
      date: b.event_date,
      shift: b.shift,
      hallId: Number(b.hall_id),
      hallName: b.hall,
    })),
  };
}
