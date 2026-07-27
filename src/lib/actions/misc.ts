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
  await execute(
    `INSERT INTO leads (name, phone, event_date, message, source, status) VALUES (?,?,?,?,?,'NEW')`,
    [name, phone, eventDate || null, message || null, source],
  );
  revalidatePath('/app/leads');
  return { ok: true };
}
