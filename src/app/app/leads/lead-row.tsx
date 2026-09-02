'use client';

import { toWaNumber } from '@/lib/brand-info';
import { useTransition } from 'react';
import { fmtDate } from '@/lib/format';
import { setLeadStatus } from '@/lib/actions/misc';

const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as const;
const tone: Record<string, string> = {
  NEW: 'text-gold', CONTACTED: 'text-warn', CONVERTED: 'text-positive', CLOSED: 'text-[rgb(var(--text-dim))]',
};

export function LeadRow({ lead }: { lead: { id: number; name: string; phone: string; event_date: string | null; message: string | null; source: string; status: string } }) {
  const [pending, start] = useTransition();
  return (
    <tr className="border-b border-[rgb(var(--border)/0.25)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
      <td className="px-4 py-3 text-[rgb(var(--text))]">{lead.name}</td>
      <td className="px-4 py-3"><a href={`https://wa.me/${toWaNumber(lead.phone) ?? ''}`} className="text-gold hover:underline">{lead.phone}</a></td>
      <td className="px-4 py-3 text-[rgb(var(--text-muted))]">{fmtDate(lead.event_date)}</td>
      <td className="px-4 py-3 max-w-xs truncate text-[rgb(var(--text-dim))]">{lead.message}</td>
      <td className="px-4 py-3 text-[rgb(var(--text-dim))]">{lead.source}</td>
      <td className="px-4 py-3">
        <select
          disabled={pending}
          defaultValue={lead.status}
          onChange={(e) => start(async () => { await setLeadStatus(lead.id, e.target.value as any); })}
          className={`cursor-pointer rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.6)] px-2 py-1 text-xs outline-none ${tone[lead.status]}`}
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    </tr>
  );
}
