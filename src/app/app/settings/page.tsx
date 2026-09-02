import { requirePermission } from '@/lib/session';
import { getSetting, getBrand } from '@/lib/data';
import { query } from '@/lib/db';
import { SettingsClient } from './settings-client';
import { DangerZone } from './danger-zone';
import { getDangerCounts } from '@/lib/actions/danger';
import { BrandProfileCard } from '@/components/brand-profile-card';

export const metadata = { title: 'Settings — Skylight Ballroom & Catering' };

export default async function SettingsPage() {
  const user = await requirePermission('settings.manage');
  const [attribution, name, city, enquiryNote, heads, brand] = await Promise.all([
    getSetting('sale_attribution', 'EVENT_MONTH'),
    getSetting('banquet_name', 'Skylight Ballroom & Catering Service'),
    getSetting('banquet_city', 'Karachi'),
    getSetting('enquiry.note', ''),
    query<any>(`
      SELECT h.id, h.name, h.has_qty_note, h.is_active,
             (SELECT COUNT(*) FROM petty_cash_entries e WHERE e.expense_head_id = h.id)
             + (SELECT COUNT(*) FROM income_adjustments a WHERE a.expense_head_id = h.id) AS usage_count
        FROM expense_heads h
       ORDER BY h.is_active DESC, h.sort_order, h.name
    `),
    getBrand(),
  ]);

  // Danger zone is OWNER-only — a manager with settings.manage never sees it,
  // and every action re-checks the role server-side regardless.
  const isOwner = user.role === 'OWNER' || user.role === 'SUPER_ADMIN';
  const dangerCounts = isOwner ? await getDangerCounts() : null;

  return (
    <>
      {/* First on the page: it is the section that reaches printed paper. */}
      <div className="mb-6">
        <BrandProfileCard brand={brand} />
      </div>

      <SettingsClient
        attribution={attribution}
        name={name}
        city={city}
        enquiryNote={enquiryNote}
        heads={heads.map((h: any) => ({
          id: h.id,
          name: h.name,
          hasQtyNote: h.has_qty_note === 1,
          active: h.is_active === 1,
          usageCount: Number(h.usage_count ?? 0),
        }))}
      />
      {isOwner && dangerCounts && (
        <div className="mt-6">
          <DangerZone counts={dangerCounts} />
        </div>
      )}
    </>
  );
}
