'use server';

import { z } from 'zod';
import { execute, queryOne } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type RuleResult = { ok: true; message?: string } | { ok: false; error: string };

const ruleSchema = z.object({
  title: z.string().min(2, 'Title required').max(200),
  body: z.string().min(2, 'Description required').max(1000),
  category: z.string().max(60).default('GENERAL'),
});

export async function createRule(input: unknown): Promise<RuleResult> {
  const actor = await assertPermission('rules.manage');
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { title, body, category } = parsed.data;
  const max = await queryOne<{ m: number }>(`SELECT COALESCE(MAX(sort_order),0) m FROM rules`);
  const res = await execute(`INSERT INTO rules (title, body, category, sort_order, is_active) VALUES (?,?,?,?,1)`,
    [title, body, category, (max?.m ?? 0) + 1]);
  await audit({ userId: actor.id, action: 'CREATE', entity: 'rule', entityId: res.insertId, after: { title } });
  revalidatePath('/app/rules');
  return { ok: true, message: 'Rule added.' };
}

export async function updateRule(id: number, input: unknown): Promise<RuleResult> {
  const actor = await assertPermission('rules.manage');
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { title, body, category } = parsed.data;
  const before = await queryOne(`SELECT * FROM rules WHERE id = ?`, [id]);
  if (!before) return { ok: false, error: 'Rule not found.' };
  await execute(`UPDATE rules SET title=?, body=?, category=? WHERE id=?`, [title, body, category, id]);
  await audit({ userId: actor.id, action: 'UPDATE', entity: 'rule', entityId: id, before, after: { title, body, category } });
  revalidatePath('/app/rules');
  return { ok: true, message: 'Rule updated.' };
}

export async function deleteRule(id: number): Promise<RuleResult> {
  const actor = await assertPermission('rules.manage');
  await execute(`DELETE FROM rules WHERE id = ?`, [id]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'rule', entityId: id });
  revalidatePath('/app/rules');
  return { ok: true, message: 'Rule deleted.' };
}

export async function toggleRule(id: number, active: boolean): Promise<RuleResult> {
  const actor = await assertPermission('rules.manage');
  await execute(`UPDATE rules SET is_active = ? WHERE id = ?`, [active ? 1 : 0, id]);
  await audit({ userId: actor.id, action: active ? 'ACTIVATE' : 'DEACTIVATE', entity: 'rule', entityId: id });
  revalidatePath('/app/rules');
  return { ok: true };
}
