import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { getCateringQuotation, getEventPayables, getCateringVendors, getEventLedger } from '@/lib/catering';
import { EventLedgerClient } from './ledger-client';

export const metadata = { title: 'Event Ledger — Catering' };
export const dynamic = 'force-dynamic';

export default async function EventLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('catering.reports');
  const { id } = await params;
  const eventId = Number(id);

  const [event, payables, vendors, ledger] = await Promise.all([
    getCateringQuotation(eventId),
    getEventPayables(eventId),
    getCateringVendors(true),
    getEventLedger(),
  ]);
  if (!event) notFound();

  const summary = ledger.find((e) => e.eventId === eventId) ?? null;

  return (
    <EventLedgerClient
      eventId={eventId}
      quotaNo={event.quotaNo}
      customerName={event.customerName}
      summary={summary}
      payables={payables}
      vendors={vendors}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
