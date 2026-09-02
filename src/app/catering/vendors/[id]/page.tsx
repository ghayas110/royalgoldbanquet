import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { getVendorWithBills } from '@/lib/catering';
import { Card, SectionTitle, Button, Badge } from '@/components/ui';
import { BillsTable } from '@/components/catering-bills-table';
import { fmtMoney } from '@/lib/format';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Vendor — Catering' };
export const dynamic = 'force-dynamic';

export default async function VendorHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('catering.view');
  const { id } = await params;
  const data = await getVendorWithBills(Number(id));
  if (!data) notFound();
  const { vendor, bills } = data;

  const billed = bills.reduce((s, b) => s + b.amount, 0);
  const paid = bills.reduce((s, b) => s + b.paidAmount, 0);
  const outstanding = bills.reduce((s, b) => s + b.outstanding, 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering vendor"
        sub={[vendor.category, vendor.phone].filter(Boolean).join(' · ') || 'Bill history'}
        right={
          <Link href="/catering/vendors">
            <Button variant="ghost"><ArrowLeft className="mr-1.5 h-4 w-4" /> All vendors</Button>
          </Link>
        }
      >
        {vendor.name}
      </SectionTitle>

      {!vendor.isActive && (
        <Card className="p-3 text-sm text-[rgb(var(--text-muted))]">
          <Badge tone="muted">Archived</Badge> This vendor is archived. Their history is kept.
        </Card>
      )}

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

      {vendor.note && (
        <Card className="p-4 text-sm text-[rgb(var(--text-muted))]">{vendor.note}</Card>
      )}

      <div>
        <div className="mb-3 font-display text-lg text-[rgb(var(--text))]">Bill history</div>
        <BillsTable bills={bills} hideVendor />
      </div>
    </div>
  );
}
