import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReviewByToken, getBrand } from '@/lib/data';
import { ReviewForm } from './review-form';
import { ReviewThanks } from './review-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Comments Card — Skylight Ballroom & Catering',
  description: 'Tell us how your event went at Skylight Ballroom & Catering Service.',
  // A private, single-use link — it should never reach a search index.
  robots: { index: false, follow: false },
};

export default async function PublicReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [review, brand] = await Promise.all([getReviewByToken(token), getBrand()]);
  if (!review) notFound();

  if (review.submittedAt) return <ReviewThanks brand={brand} />;

  return (
    <ReviewForm
      token={review.token}
      guestName={review.guestName ?? ''}
      guestPhone={review.guestPhone ?? ''}
      eventDate={review.eventDate ?? ''}
      brand={brand}
    />
  );
}
