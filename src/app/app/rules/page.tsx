import { requirePermission } from '@/lib/session';
import { getRules } from '@/lib/data';
import { RulesClient } from './rules-client';

export const metadata = { title: 'Rules — Skylight Ballroom & Catering' };

export default async function RulesPage() {
  await requirePermission('rules.manage');
  const rules = await getRules(false);
  return <RulesClient rules={rules.map((r: any) => ({ id: r.id, title: r.title, body: r.body, category: r.category, active: r.is_active === 1 }))} />;
}
