'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, SectionTitle, Button, Badge, Modal, FadeUp, EmptyState } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import {
  REVIEW_CATEGORIES, headlineRating, ratingTone, type ReviewRow,
} from '@/lib/reviews';
import {
  setReviewPublished, deleteReview, deleteUnusedReviewCards, issueBlankReviewCard,
} from '@/lib/actions/reviews';
import {
  MessageSquareQuote, Star, Eye, EyeOff, Trash2, Link2, Copy, Check,
  Plus, Printer, ExternalLink,
} from 'lucide-react';

type Stats = {
  total: number; submitted: number; pending: number; published: number;
  excellent: number; good: number; poor: number; avgStars: number | null;
};

type Filter = 'ALL' | 'PUBLISHED' | 'HIDDEN' | 'POOR' | 'PENDING';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PUBLISHED', label: 'On website' },
  { key: 'HIDDEN', label: 'Hidden' },
  { key: 'POOR', label: 'Needs attention' },
  { key: 'PENDING', label: 'Not filled yet' },
];

export function ReviewsClient({ reviews, stats }: { reviews: ReviewRow[]; stats: Stats }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [confirm, setConfirm] = useState<null | ReviewRow>(null);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [pending, start] = useTransition();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const shown = useMemo(() => reviews.filter((r) => {
    switch (filter) {
      case 'PUBLISHED': return !!r.submittedAt && r.isPublished;
      case 'HIDDEN':    return !!r.submittedAt && !r.isPublished;
      case 'POOR':      return !!r.submittedAt && Object.values(r.ratings).includes('POOR');
      case 'PENDING':   return !r.submittedAt;
      default:          return true;
    }
  }), [reviews, filter]);

  function linkFor(token: string) {
    return `${typeof window === 'undefined' ? '' : window.location.origin}/review/${token}`;
  }

  function copyLink(token: string) {
    const url = linkFor(token);
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(token); setTimeout(() => setCopied(''), 2000); },
      () => flash(url),
    );
  }

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle
          sub="Comments cards filled in by guests after their event"
          right={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => start(async () => {
                const r = await issueBlankReviewCard();
                if (r.ok) { copyLink(r.token); router.refresh(); flash('Blank card created — link copied.'); }
                else flash(r.error);
              })}>
                <Plus className="h-4 w-4" /> Blank card
              </Button>
            </div>
          }
        >
          Guest Reviews
        </SectionTitle>
      </FadeUp>

      {msg && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>}

      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Cards received" value={String(stats.submitted)} />
        <Tile
          label="Average rating"
          value={stats.avgStars !== null ? `${stats.avgStars.toFixed(1)} / 5` : '—'}
          icon={<Star className="h-4 w-4 fill-current" />}
        />
        <Tile label="On the website" value={String(stats.published)} />
        <Tile label="Poor ratings" value={String(stats.poor)} tone={stats.poor > 0 ? 'bad' : undefined} />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f.key === 'ALL' ? reviews.length
            : f.key === 'PENDING' ? stats.pending
            : reviews.filter((r) => {
                if (f.key === 'PUBLISHED') return !!r.submittedAt && r.isPublished;
                if (f.key === 'HIDDEN') return !!r.submittedAt && !r.isPublished;
                return !!r.submittedAt && Object.values(r.ratings).includes('POOR');
              }).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                'rounded-full border px-3.5 py-1.5 text-sm transition',
                filter === f.key
                  ? 'border-gold bg-[rgb(var(--gold)/0.15)] text-gold'
                  : 'border-[rgb(var(--border)/0.6)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
              ].join(' ')}
            >
              {f.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
        {stats.pending > 0 && (
          <button
            onClick={() => start(async () => {
              const r = await deleteUnusedReviewCards();
              if (r.ok) { router.refresh(); flash(`Removed ${r.count} unused link${r.count === 1 ? '' : 's'}.`); }
              else flash(r.error);
            })}
            disabled={pending}
            className="ml-auto rounded-full px-3 py-1.5 text-sm text-[rgb(var(--text-dim))] hover:text-negative disabled:opacity-50"
          >
            Clear unused links
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquareQuote className="h-8 w-8" />}
            title="No cards here yet"
            sub="Open a completed booking and tap “Comments card” to hand one to the guest."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r, i) => {
            const head = headlineRating(r);
            const filled = !!r.submittedAt;
            return (
              <FadeUp key={r.id} delay={0.02 * i}>
                <Card className={`p-5 ${filled && !r.isPublished ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg text-[rgb(var(--text))]">
                          {r.guestName || 'Guest'}
                        </h3>
                        {head && <Badge tone={ratingTone(head)}>{head}</Badge>}
                        {!filled && <Badge tone="muted">Not filled yet</Badge>}
                        {filled && !r.isPublished && <Badge tone="muted">Hidden from website</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">
                        {r.eventDate ? fmtDate(r.eventDate) : 'No event date'}
                        {r.hall ? ` · ${r.hall}` : ''}
                        {r.slipNo ? ` · ${r.slipNo}` : ''}
                        {r.guestPhone ? ` · ${r.guestPhone}` : ''}
                      </div>
                    </div>
                    {r.stars !== null && (
                      <div className="flex items-center gap-1 text-gold">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <Star key={k} className={`h-4 w-4 ${k < Math.round(r.stars!) ? 'fill-current' : 'opacity-25'}`} />
                        ))}
                        <span className="ml-1 text-sm">{r.stars.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {filled ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {REVIEW_CATEGORIES.map((c) => {
                          const v = r.ratings[c.key];
                          if (!v) return null;
                          const tone = ratingTone(v);
                          return (
                            <span
                              key={c.key}
                              className={[
                                'rounded-lg border px-2 py-1 text-[11px]',
                                tone === 'green' ? 'border-positive/30 bg-positive/10 text-positive'
                                  : tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                                  : 'border-negative/30 bg-negative/10 text-negative',
                              ].join(' ')}
                            >
                              {c.label}: {v.charAt(0) + v.slice(1).toLowerCase()}
                            </span>
                          );
                        })}
                      </div>

                      {r.comments && (
                        <p className="mt-3 rounded-xl bg-[rgb(var(--surface-2))] px-4 py-3 text-sm italic text-[rgb(var(--text-muted))]">
                          &ldquo;{r.comments}&rdquo;
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[rgb(var(--surface-2))] px-3 py-2.5">
                      <Link2 className="h-4 w-4 shrink-0 text-gold" />
                      <code className="min-w-0 flex-1 truncate text-xs text-[rgb(var(--text-muted))]">
                        /review/{r.token}
                      </code>
                      <button
                        onClick={() => copyLink(r.token)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface))] hover:text-gold"
                      >
                        {copied === r.token ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
                      </button>
                      <a
                        href={`/review/${r.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface))] hover:text-gold"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border)/0.4)] pt-3">
                    {filled && (
                      <button
                        disabled={pending}
                        onClick={() => start(async () => {
                          const res = await setReviewPublished(r.id, !r.isPublished);
                          if (res.ok) { router.refresh(); flash(r.isPublished ? 'Hidden from the website.' : 'Now showing on the website.'); }
                          else flash(res.error);
                        })}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-50"
                      >
                        {r.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Hide from website</> : <><Eye className="h-3.5 w-3.5" /> Show on website</>}
                      </button>
                    )}
                    {r.bookingId && (
                      <Link
                        href={`/app/bookings/${r.bookingId}`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Booking
                      </Link>
                    )}
                    <a
                      href={`/print/review/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print card
                    </a>
                    <button
                      disabled={pending}
                      onClick={() => setConfirm(r)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-negative disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </Card>
              </FadeUp>
            );
          })}
        </div>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete this review?">
        <p className="text-sm text-[rgb(var(--text-muted))]">
          The comments card from{' '}
          <span className="font-medium text-[rgb(var(--text))]">{confirm?.guestName || 'this guest'}</span>{' '}
          will be permanently removed and will no longer appear on the website.
        </p>
        {confirm?.comments && (
          <p className="mt-3 rounded-xl bg-[rgb(var(--surface-2))] px-4 py-3 text-sm italic text-[rgb(var(--text-muted))]">
            &ldquo;{confirm.comments}&rdquo;
          </p>
        )}
        <p className="mt-3 text-xs text-[rgb(var(--text-dim))]">
          Prefer to keep the record? Use <b>Hide from website</b> instead — the card stays here
          for your reference but never reaches the landing page.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              const id = confirm!.id;
              start(async () => {
                const res = await deleteReview(id);
                setConfirm(null);
                if (res.ok) { router.refresh(); flash('Review deleted.'); } else flash(res.error);
              });
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Tile({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: 'bad' }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
      <div className={`mt-1 flex items-center gap-1.5 font-display text-2xl ${tone === 'bad' ? 'text-negative' : 'text-gold'}`}>
        {value}{icon}
      </div>
    </Card>
  );
}
