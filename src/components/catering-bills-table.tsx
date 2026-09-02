import Link from 'next/link';
import { Card, Badge, EmptyState, TableScroll } from '@/components/ui';
import { fmtMoney, fmtDate } from '@/lib/format';
import type { CateringBillRow } from '@/lib/types';
import { Receipt } from 'lucide-react';

/**
 * Bills across events.
 *
 * Shared by the all-bills listing and a single vendor's history, because the
 * two want exactly the same columns; only the heading and which column is
 * redundant differ. `hideVendor` drops the vendor column on a vendor's own
 * page, where every row would repeat the same name.
 */
export function BillsTable({ bills, hideVendor = false }: { bills: CateringBillRow[]; hideVendor?: boolean }) {
  if (bills.length === 0) {
    return (
      <Card className="p-5">
        <EmptyState icon={<Receipt className="h-8 w-8" />} title="No bills here" sub="Bills are added from an event's ledger." />
      </Card>
    );
  }

  const total = bills.reduce((s, b) => s + b.amount, 0);
  const paid = bills.reduce((s, b) => s + b.paidAmount, 0);

  return (
    <Card className="p-0">
      <TableScroll>
        <table className="w-full text-sm">
          <thead className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2))] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">
            <tr>
              {!hideVendor && <th className="px-4 py-2.5 font-medium">Vendor</th>}
              <th className="px-4 py-2.5 font-medium">Event</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 text-right font-medium">Paid</th>
              <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b border-[rgb(var(--border)/0.2)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                {!hideVendor && (
                  <td className="px-4 py-2.5">
                    {b.vendorId
                      ? <Link href={`/catering/vendors/${b.vendorId}`} className="text-[rgb(var(--text))] hover:text-gold">{b.vendorName}</Link>
                      : <span className="text-[rgb(var(--text-dim))]">No vendor</span>}
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <Link href={`/catering/ledger/${b.eventId}`} className="text-[rgb(var(--text))] hover:text-gold">
                    {b.customerName || 'Unnamed'}
                  </Link>
                  <div className="text-xs text-[rgb(var(--text-dim))]">
                    {b.quotaNo}{b.eventDate ? ` · ${fmtDate(b.eventDate)}` : ''}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">
                  {b.description || '—'}
                  {b.settled ? <Badge tone="green">Paid</Badge> : <Badge tone="amber">Unpaid</Badge>}
                </td>
                <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{b.dueDate ? fmtDate(b.dueDate) : '—'}</td>
                <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(b.amount, false)}</td>
                <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(b.paidAmount, false)}</td>
                <td className={`px-4 py-2.5 text-right tnum ${b.outstanding > 0 ? 'text-negative' : 'text-[rgb(var(--text-dim))]'}`}>
                  {b.outstanding > 0 ? fmtMoney(b.outstanding, false) : '—'}
                </td>
              </tr>
            ))}
            <tr className="bg-[rgb(var(--surface-2)/0.5)] font-medium">
              <td className="px-4 py-2.5" colSpan={hideVendor ? 3 : 4}>
                {bills.length} bill{bills.length === 1 ? '' : 's'}
              </td>
              <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(total, false)}</td>
              <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(paid, false)}</td>
              <td className={`px-4 py-2.5 text-right tnum ${total - paid > 0 ? 'text-negative' : 'text-[rgb(var(--text-dim))]'}`}>
                {fmtMoney(Math.max(0, total - paid), false)}
              </td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
    </Card>
  );
}
