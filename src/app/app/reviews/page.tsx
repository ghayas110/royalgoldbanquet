import { requirePermission } from '@/lib/session';
import { getReviews, getReviewStats } from '@/lib/data';
import { ReviewsClient } from './reviews-client';

export const metadata = { title: 'Guest Reviews — Skylight Ballroom & Catering' };

export default async function ReviewsPage() {
  await requirePermission('reviews.manage');
  const [reviews, stats] = await Promise.all([getReviews(), getReviewStats()]);
  return <ReviewsClient reviews={reviews} stats={stats} />;
}
