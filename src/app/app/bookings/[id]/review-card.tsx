'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, FadeUp } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { toWaNumber } from '@/lib/brand-info';

import { issueReviewCard } from '@/lib/actions/reviews';
import { REVIEW_CATEGORIES, ratingTone, type ReviewRow } from '@/lib/reviews';
import {
  MessageSquareQuote, Copy, Check, Printer, ExternalLink, Star, Loader2,
} from 'lucide-react';

/**
 * The Comments Card panel on a booking. Staff tap once to create the guest's
 * link, then hand it over — by WhatsApp, on a phone, or printed on paper.
 */
export function BookingReviewCard({
  bookingId, partyName, phone, reviews, brandName,
}: { bookingId: number; partyName: string; phone: string | null; reviews: ReviewRow[]; brandName: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const open = reviews.find((r) => !r.submittedAt);
  const filled = reviews.filter((r) => r.submittedAt);

  const url = (token: string) =>
    `${typeof window === 'undefined' ? '' : window.location.origin}/review/${token}`;

  function copy(token: string) {
    navigator.clipboard?.writeText(url(token)).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => setErr(url(token)),
    );
  }

  function waHref(token: string) {
    const msg =
      `Assalam-o-Alaikum ${partyName},\n\n` +
      `Thank you for choosing ${brandName}. We would be grateful if you could ` +
      `share your feedback on our comments card:\n${url(token)}`;
    return `https://wa.me/${toWaNumber(phone) ?? ''}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <FadeUp delay={0.1}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg text-gold">
              <MessageSquareQuote className="h-5 w-5" /> Comments Card
            </h3>
            <p className="mt-0.5 text-sm text-[rgb(var(--text-muted))]">
              Hand this to the guest after the event to collect their feedback.
            </p>
          </div>
          {!open && filled.length === 0 && (
            <Button
              disabled={pending}
              onClick={() => start(async () => {
                const r = await issueReviewCard(bookingId);
                if (r.ok) { copy(r.token); router.refresh(); } else setErr(r.error);
              })}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareQuote className="h-4 w-4" />}
              Create card
            </Button>
          )}
        </div>

        {err && (
          <div className="mt-3 break-all rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
            {err}
          </div>
        )}

        {/* ── Issued, waiting on the guest ── */}
        {open && (
          <div className="mt-4 rounded-xl border border-[rgb(var(--border)/0.5)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">Waiting for the guest</Badge>
              <code className="min-w-0 flex-1 truncate text-xs text-[rgb(var(--text-dim))]">
                /review/{open.token}
              </code>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" className="py-2 text-sm" onClick={() => copy(open.token)}>
                {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
              </Button>
              {phone && (
                <a href={waHref(open.token)} target="_blank" rel="noreferrer">
                  <Button variant="ghost" className="py-2 text-sm"><ExternalLink className="h-4 w-4" /> Send on WhatsApp</Button>
                </a>
              )}
              <a href={`/print/review/${open.id}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" className="py-2 text-sm"><Printer className="h-4 w-4" /> Print card</Button>
              </a>
              <a href={`/review/${open.token}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" className="py-2 text-sm"><ExternalLink className="h-4 w-4" /> Open form</Button>
              </a>
            </div>
          </div>
        )}

        {/* ── Filled in ── */}
        {filled.map((r) => (
          <div key={r.id} className="mt-4 rounded-xl border border-[rgb(var(--border)/0.5)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-[rgb(var(--text))]">
                Submitted {r.submittedAt ? fmtDate(r.submittedAt.slice(0, 10)) : ''}
                {r.isPublished
                  ? <span className="ml-2 text-xs text-positive">· showing on website</span>
                  : <span className="ml-2 text-xs text-[rgb(var(--text-dim))]">· hidden from website</span>}
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

            <div className="mt-3 flex flex-wrap gap-1.5">
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
              <p className="mt-3 rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2.5 text-sm italic text-[rgb(var(--text-muted))]">
                &ldquo;{r.comments}&rdquo;
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/print/review/${r.id}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" className="py-2 text-sm"><Printer className="h-4 w-4" /> Print</Button>
              </a>
            </div>
          </div>
        ))}

        {!open && filled.length === 0 && (
          <p className="mt-4 text-sm text-[rgb(var(--text-dim))]">
            No card issued for this booking yet.
          </p>
        )}
      </Card>
    </FadeUp>
  );
}
