import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { getCateringQuotations } from '@/lib/catering';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Button, Badge, EmptyState, TableScroll, FadeUp } from '@/components/ui';
import { CATERING_STATUS_META, type CateringStatus } from '@/lib/types';
import { FileText, ArrowUpRight, Search } from 'lucide-react';

export const metadata = { title: 'Invoices — Catering' };
export const dynamic = 'force-dynamic';

const STATUSES = ['QUOTATION', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export default async function CateringInvoicesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requirePermission('catering.view');
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? '') ? (sp.status as CateringStatus) : 'ALL';
  const rows = await getCateringQuotations({ status, docType: 'INVOICE', search: sp.q?.trim() || undefined });
  const canManage = user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN';

  const tabs: (CateringStatus | 'ALL')[] = ['ALL', 'QUOTATION', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  const href = (s: string) => `/catering/invoices${s === 'ALL' ? '' : `?status=${s}`}`;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub="Every invoice raised, newest first. An invoice is billed after the event; a quotation is the estimate before it."
        right={canManage ? <Link href="/catering/quotations"><Button variant="ghost">Raise from a quotation</Button></Link> : undefined}
      >
        Invoices
      </SectionTitle>

      <FadeUp delay={0.04}>
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <Link key={t} href={href(t)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  status === t ? 'bg-[rgb(var(--gold)/0.15)] text-gold' : 'text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]'
                }`}>
                {t === 'ALL' ? 'All' : CATERING_STATUS_META[t].label}
              </Link>
            ))}
          </div>
          <form className="ml-auto flex items-center gap-2" action="/catering/quotations">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-dim))]" />
              <input name="q" defaultValue={sp.q ?? ''} placeholder="Quota no, name, phone, place…"
                className="rounded-xl border border-[rgb(var(--border)/0.7)] bg-[rgb(var(--surface-2))] py-2 pl-8 pr-3 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--gold)/0.6)]" />
            </div>
            <Button variant="ghost" type="submit">Search</Button>
          </form>
        </Card>
      </FadeUp>

      <Card className="p-5">
        {rows.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No quotations" sub={sp.q || status !== 'ALL' ? 'Nothing matches this filter.' : 'Create the first one to get started.'} />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Quota no</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 text-right font-medium">Persons</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 text-right font-medium">Balance</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className="border-b border-[rgb(var(--border)/0.3)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                    <td className="py-2.5 pr-3 tnum text-gold">{q.quotaNo}</td>
                    <td className="py-2.5 pr-3">
                      <div className="text-[rgb(var(--text))]">{q.customerName || '—'}</div>
                      <div className="text-xs text-[rgb(var(--text-dim))]">{q.placeOfFunction || '—'}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-muted))]">{q.deliveryDate ? fmtDate(q.deliveryDate) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{q.persons || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text))]">{fmtMoney(q.grandTotal, false)}</td>
                    <td className={`py-2.5 pr-3 text-right tnum ${q.balance > 0 ? 'text-negative' : 'text-positive'}`}>{q.balance > 0 ? fmtMoney(q.balance, false) : 'Paid'}</td>
                    <td className="py-2.5 pr-3"><Badge tone={CATERING_STATUS_META[q.status].tone}>{CATERING_STATUS_META[q.status].label}</Badge></td>
                    <td className="py-2.5 text-right">
                      <Link href={`/catering/quotations/${q.id}`} className="inline-flex rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold">
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
