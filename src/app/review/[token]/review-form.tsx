'use client';

import { useState, useTransition } from 'react';
import { SkylightLogo } from '@/components/brand';
import { BRAND_DEFAULTS, type BrandInfo } from '@/lib/brand-info';
import { submitReview } from '@/lib/actions/reviews';
import { REVIEW_CATEGORIES, RATING_VALUES, type Rating, type ReviewCategoryKey } from '@/lib/reviews';
import { CheckCircle2, Loader2 } from 'lucide-react';

const RATING_LABEL: Record<Rating, string> = { EXCELLENT: 'Excellent', GOOD: 'Good', POOR: 'Poor' };

/** Wraps the card in the dark banquet backdrop the guest sees on their phone. */
function Shell({ children, brand = BRAND_DEFAULTS }: { children: React.ReactNode; brand?: BrandInfo }) {
  return (
    <div className="min-h-screen bg-[#0B0B0D] px-4 py-8 text-ivory">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex justify-center">
          <SkylightLogo size="md" />
        </div>
        {children}
        <p className="mt-8 text-center text-[11px] leading-relaxed text-white/35">
          {brand.address}
          <br />
          Phone: {brand.footerPhone}
        </p>
      </div>
    </div>
  );
}

export function ReviewThanks({ brand }: { brand?: BrandInfo }) {
  return (
    <Shell brand={brand}>
      <div className="mt-8 rounded-2xl border border-gold/25 bg-white/[0.04] p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-gold" />
        <h1 className="mt-4 font-display text-2xl text-gold">Thank you</h1>
        <p className="mt-2 text-sm text-white/70">
          Your comments card has been received. We are grateful you chose{' '}
          {(brand ?? BRAND_DEFAULTS).name} for your event, and your feedback helps us serve the next family better.
        </p>
      </div>
    </Shell>
  );
}

export function ReviewForm({
  token, guestName, guestPhone, eventDate, brand,
}: { token: string; guestName: string; guestPhone: string; eventDate: string; brand?: BrandInfo }) {
  const [ratings, setRatings] = useState<Partial<Record<ReviewCategoryKey, Rating>>>({});
  const [name, setName] = useState(guestName);
  const [phone, setPhone] = useState(guestPhone);
  const [date, setDate] = useState(eventDate);
  const [comments, setComments] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (done) return <ReviewThanks brand={brand} />;

  const answered = Object.keys(ratings).length;

  function save() {
    setError('');
    if (answered === 0 && !comments.trim()) {
      setError('Please tick at least one box, or write a comment.');
      return;
    }
    start(async () => {
      const r = await submitReview({
        token, ratings, comments,
        guestName: name, guestPhone: phone, eventDate: date,
      });
      if (r.ok) setDone(true);
      else setError(r.error);
    });
  }

  return (
    <Shell brand={brand}>
      <div className="mt-6 overflow-hidden rounded-2xl border border-gold/25 bg-white/[0.04]">
        <div className="border-b border-gold/20 px-5 py-4 text-center">
          <h1 className="font-display text-xl tracking-wide text-gold underline decoration-gold/40 underline-offset-4">
            Comments Card
          </h1>
          <p className="mt-1.5 text-xs text-white/55">
            How did we do? Tick a box for each, then send.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {REVIEW_CATEGORIES.map((c) => (
            <fieldset key={c.key} className="px-4 py-3.5">
              <legend className="sr-only">{c.label}</legend>
              <div className="mb-2.5 inline-block rounded bg-[#2A2A2E] px-2.5 py-1 text-[13px] font-medium text-ivory">
                {c.label}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RATING_VALUES.map((v) => {
                  const on = ratings[c.key] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setRatings((p) => {
                          // Tapping the chosen box again clears it.
                          const next = { ...p };
                          if (next[c.key] === v) delete next[c.key];
                          else next[c.key] = v;
                          return next;
                        })
                      }
                      className={[
                        'rounded-lg border px-2 py-2.5 text-[13px] font-medium transition',
                        on
                          ? 'border-gold bg-gold text-[#0B0B0D]'
                          : 'border-white/20 text-white/70 hover:border-gold/50 hover:text-ivory',
                      ].join(' ')}
                    >
                      {RATING_LABEL[v]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="border-t border-white/10">
          <div className="bg-[#2A2A2E] px-4 py-2 text-center text-[13px] font-medium text-ivory">
            Comments / Suggestion / Complaint
          </div>
          <div className="p-4">
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Tell us anything you'd like us to know…"
              className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2.5 text-sm text-ivory placeholder:text-white/30 focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="bg-[#2A2A2E] px-4 py-2 text-center text-[13px] font-medium text-ivory">
            Customer Information
          </div>
          <div className="space-y-3 p-4">
            <Line label="Name" value={name} onChange={setName} placeholder="Your name" />
            <Line label="Event Date" value={date} onChange={setDate} type="date" />
            <Line label="Cell #" value={phone} onChange={setPhone} type="tel" placeholder="03XX-XXXXXXX" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        onClick={save}
        disabled={pending}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 font-semibold text-[#0B0B0D] transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send my feedback'}
      </button>
      <p className="mt-2.5 text-center text-[11px] text-white/40">
        You can only send this card once.
      </p>
    </Shell>
  );
}

function Line({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-[86px] shrink-0 text-[13px] text-white/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-b border-white/25 bg-transparent px-1 py-1.5 text-sm text-ivory placeholder:text-white/25 focus:border-gold focus:outline-none"
      />
    </label>
  );
}
