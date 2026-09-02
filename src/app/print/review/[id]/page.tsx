import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { getReviewById, getBrand } from '@/lib/data';
import { PrintShell } from '@/components/print/print-shell';
import { CommentsCardDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Comments Card — Skylight Ballroom & Catering' };

export default async function ReviewPrint({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('bookings.view');
  const { id } = await params;
  const [r, brand] = await Promise.all([getReviewById(Number(id)), getBrand()]);
  if (!r) notFound();

  // Printed on the blank card so a guest who'd rather use their phone can.
  const h = await headers();
  const host = h.get('host');
  const link = host ? `${h.get('x-forwarded-proto') ?? 'https'}://${host}/review/${r.token}` : null;

  return (
    <PrintShell backHref={r.bookingId ? `/app/bookings/${r.bookingId}` : '/app/reviews'}>
      <CommentsCardDoc brand={brand}
        d={{
          guestName: r.guestName,
          guestPhone: r.guestPhone,
          eventDate: r.eventDate,
          slipNo: r.slipNo,
          comments: r.comments,
          ratings: r.ratings,
          submitted: !!r.submittedAt,
          link,
        }}
      />
    </PrintShell>
  );
}
