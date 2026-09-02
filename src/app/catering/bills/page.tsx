import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { getCateringBills } from '@/lib/catering';
import { Card, SectionTitle, FadeUp } from '@/components/ui';
import { BillsTable } from '@/components/catering-bills-table';
import { fmtMoney } from '@/lib/format';
import type { BillFilter } from '@/lib/types';
import { Search } from 'lucide-react';

export const metadata = { title: 'Vendor Bills — Catering' };
export const dynamic = 'force-dynamic';

const FILTERS: { key: BillFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNPAID', label: 'Unpaid' },
  { key: 'PAID', label: 'Paid' },
];

export default async function CateringBillsPage({
  searchParams,
}: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  await requirePermission('catering.reports');
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : 'ALL') as BillFilter;
  const search = sp.q?.trim() || undefined;

  // The counts come from unfiltered data so the tabs can show how much sits
  // behind each one, rather than only describing the tab you are already on.
  const [bills, all] = await Promise.all([
    getCateringBills({ filter, search }),
    getCateringBills({ search }),
  ]);

  const billed = all.reduce((s, b) => s + b.amount, 0);
  const paid = all.reduce((s, b) => s + b.paidAmount, 0);
  const outstanding = all.reduce((s, b) => s + b.outstanding, 0);
  const counts = {
    ALL: all.length,
    UNPAID: all.filter((b) => !b.settled).length,
    PAID: all.filter((b) => b.settled).length,
  };

  const href = (f: BillFilter) => {
    const p = new URLSearchParams();
    if (f !== 'ALL') p.set('filter', f);
    if (search) p.set('q', search);
    const qs = p.toString();
    return `/catering/bills${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Catering" sub="Every vendor bill across every event, paid and unpaid.">
        Vendor Bills
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-3">
        {([
          ['Billed', billed, 'text-[rgb(var(--text))]'],
          ['Paid', paid, 'text-positive'],
          ['Outstanding', outstanding, outstanding > 0 ? 'text-negative' : 'text-positive'],
        ] as const).map(([label, value, tone]) => (
          <Card key={label} className="p-5">
            <div className="text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
            <div className={`mt-1 font-display text-2xl tnum ${tone}`}>{fmtMoney(value)}</div>
          </Card>
        ))}
      </div>

      <FadeUp delay={0.04}>
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  filter === f.key
                    ? 'bg-[rgb(var(--gold)/0.16)] text-gold ring-1 ring-inset ring-[rgb(var(--gold)/0.35)]'
                    : 'text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]'
                }`}
              >
                {f.label}
                <span className="ml-1.5 tnum text-xs text-[rgb(var(--text-dim))]">{counts[f.key]}</span>
              </Link>
            ))}
          </div>

          <form className="ml-auto flex items-center gap-2" action="/catering/bills">
            {filter !== 'ALL' && <input type="hidden" name="filter" value={filter} />}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-dim))]" />
              <input
                name="q"
                defaultValue={search ?? ''}
                placeholder="Vendor, event or description…"
                className="w-64 rounded-xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface-2))] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </form>
        </Card>
      </FadeUp>

      <BillsTable bills={bills} />
    </div>
  );
}
