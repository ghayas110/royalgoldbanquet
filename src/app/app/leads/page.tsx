import { requirePermission } from '@/lib/session';
import { query } from '@/lib/db';
import { fmtDate } from '@/lib/format';
import { Card, SectionTitle, FadeUp, EmptyState } from '@/components/ui';
import { LeadRow } from './lead-row';
import { Sparkles } from 'lucide-react';

export const metadata = { title: 'Leads — Royal Gold Banquet' };

export default async function LeadsPage() {
  await requirePermission('leads.view');
  const leads = await query<any>(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 200`);
  return (
    <div className="space-y-6">
      <FadeUp><SectionTitle sub={`${leads.length} enquiries`}>Leads</SectionTitle></FadeUp>
      {leads.length === 0 ? (
        <Card><EmptyState icon={<Sparkles className="h-8 w-8" />} title="No leads yet" sub="Website enquiries appear here." /></Card>
      ) : (
        <FadeUp delay={0.05}>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Event date</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l: any) => (
                  <LeadRow key={l.id} lead={{ id: l.id, name: l.name, phone: l.phone, event_date: l.event_date, message: l.message, source: l.source, status: l.status }} />
                ))}
              </tbody>
            </table>
          </Card>
        </FadeUp>
      )}
    </div>
  );
}
