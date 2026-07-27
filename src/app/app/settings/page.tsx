import { requirePermission } from '@/lib/session';
import { getSetting } from '@/lib/data';
import { query } from '@/lib/db';
import { SettingsClient } from './settings-client';

export const metadata = { title: 'Settings — Royal Gold Banquet' };

export default async function SettingsPage() {
  await requirePermission('settings.manage');
  const [attribution, name, city, heads] = await Promise.all([
    getSetting('sale_attribution', 'EVENT_MONTH'),
    getSetting('banquet_name', 'Royal Gold Banquet'),
    getSetting('banquet_city', 'Karachi'),
    query<any>(`SELECT id, name, has_qty_note, is_active FROM expense_heads ORDER BY sort_order`),
  ]);
  return <SettingsClient attribution={attribution} name={name} city={city} heads={heads.map((h: any) => ({ id: h.id, name: h.name, hasQtyNote: h.has_qty_note === 1, active: h.is_active === 1 }))} />;
}
