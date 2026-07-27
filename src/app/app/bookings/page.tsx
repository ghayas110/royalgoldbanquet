import { requirePermission, can } from '@/lib/session';
import { getBookings } from '@/lib/data';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Badge, Button, FadeUp, EmptyState } from '@/components/ui';
import { Plus, BookMarked, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Bookings — Royal Gold Banquet' };

const statusTone: Record<string, 'gold' | 'green' | 'amber' | 'muted' | 'red'> = {
  ENQUIRY: 'muted', CONFIRMED: 'gold', COMPLETED: 'green', CANCELLED: 'red',
};
const payTone: Record<string, 'green' | 'amber' | 'muted'> = { SETTLED: 'green', PARTIAL: 'amber', PENDING: 'muted' };

export default async function BookingsPage() {
  const user = await requirePermission('bookings.view');
  const canCreate = can(user.permissions, 'bookings.create');
  const bookings = await getBookings({ limit: 100 });

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle sub={`${bookings.length} bookings`} right={canCreate ? <Link href="/app/bookings/new"><Button><Plus className="h-4 w-4" /> New booking</Button></Link> : undefined}>
          Bookings
        </SectionTitle>
      </FadeUp>

      {bookings.length === 0 ? (
        <Card><EmptyState icon={<BookMarked className="h-8 w-8" />} title="No bookings yet" sub="Create your first booking to get started." /></Card>
      ) : (
        <FadeUp delay={0.05}>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                    <th className="px-4 py-3 font-medium">Slip #</th>
                    <th className="px-4 py-3 font-medium">Party</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Hall / Shift</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Balance Due</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <tr key={b.id} className="border-b border-[rgb(var(--border)/0.25)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                      <td className="px-4 py-3 font-mono text-xs text-gold">{b.slip_no}</td>
                      <td className="px-4 py-3">
                        <div className="text-[rgb(var(--text))]">{b.party_name}</div>
                        <div className="text-xs text-[rgb(var(--text-dim))]">{b.guest_count} guests</div>
                      </td>
                      <td className="px-4 py-3 text-[rgb(var(--text-muted))]">{fmtDate(b.event_date)}</td>
                      <td className="px-4 py-3 text-[rgb(var(--text-muted))]">{b.hall}<span className="text-[rgb(var(--text-dim))]"> · {b.shift}</span></td>
                      <td className="px-4 py-3 text-right tnum text-[rgb(var(--text))]">{fmtMoney(b.total_amount, false)}</td>
                      <td className="px-4 py-3 text-right tnum">{b.balance_due > 0 ? <span className="text-negative">{fmtMoney(b.balance_due, false)}</span> : <span className="text-positive">Paid</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge tone={statusTone[b.status]}>{b.status}</Badge>
                          <Badge tone={payTone[b.payment_status]}>{b.payment_status}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/app/bookings/${b.id}`} className="inline-flex rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"><ArrowUpRight className="h-4 w-4" /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </FadeUp>
      )}
    </div>
  );
}
