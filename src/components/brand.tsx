import { cn } from '@/lib/format';

/** Ornate filigree divider used above/below the wordmark. */
function Flourish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 24" className={className} aria-hidden fill="none">
      {/* center gem */}
      <path d="M120 4 l7 8 -7 8 -7 -8 z" fill="currentColor" />
      {/* tapering lines */}
      <rect x="62" y="11.1" width="44" height="1.8" rx="0.9" fill="currentColor" />
      <rect x="134" y="11.1" width="44" height="1.8" rx="0.9" fill="currentColor" />
      {/* leaf accents beside gem */}
      <path d="M106 12 c-6 -3.4 -12 -3.4 -18 0 c6 3.4 12 3.4 18 0 z" fill="currentColor" opacity="0.85" />
      <path d="M134 12 c6 -3.4 12 -3.4 18 0 c-6 3.4 -12 3.4 -18 0 z" fill="currentColor" opacity="0.85" />
      {/* end curls */}
      <path d="M62 12 c-8 0 -12 -6 -20 -6 c-6 0 -10 4 -10 8 c0 3 2 5 5 5 c4 0 5 -4 2 -6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M178 12 c8 0 12 -6 20 -6 c6 0 10 4 10 8 c0 3 -2 5 -5 5 c-4 0 -5 -4 -2 -6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Compact RG emblem (roundel monogram) — favicon / tight spaces. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-9 w-9', className)} aria-hidden>
      <defs>
        <linearGradient id="rgGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9A227" />
          <stop offset="45%" stopColor="#F0D67B" />
          <stop offset="100%" stopColor="#A6841C" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="none" stroke="url(#rgGold)" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="url(#rgGold)" strokeWidth="0.7" opacity="0.55" />
      <path d="M24 3.4 l2.6 2.6 -2.6 2.6 -2.6 -2.6 z" fill="url(#rgGold)" />
      <path d="M24 39.4 l2.6 2.6 -2.6 2.6 -2.6 -2.6 z" fill="url(#rgGold)" />
      <text x="24" y="30.5" textAnchor="middle" fontFamily="Playfair Display, Georgia, serif" fontSize="19" fontWeight="700" fill="url(#rgGold)" letterSpacing="-1">RG</text>
    </svg>
  );
}

/**
 * The full ornate "Royal Gold Banquet" wordmark — the primary logo.
 * Recreated as crisp vector/type from the client's booking slip.
 * `tone`: 'gold' (on dark) is default; 'onDark' forces gold for print bands.
 */
export function RoyalGoldLogo({ className, size = 'md', flourish = true }: { className?: string; size?: 'sm' | 'md' | 'lg'; flourish?: boolean }) {
  const scale = { sm: { title: 'text-2xl', sub: 'text-[9px]', fl: 'w-24' }, md: { title: 'text-4xl', sub: 'text-[11px]', fl: 'w-36' }, lg: { title: 'text-6xl', sub: 'text-sm', fl: 'w-52' } }[size];
  return (
    <div className={cn('inline-flex flex-col items-center text-gold', className)}>
      {flourish && <Flourish className={cn(scale.fl, 'mb-1 opacity-90')} />}
      <div className={cn('font-display font-semibold leading-none text-gold-gradient', scale.title)}>
        Royal<span className="mx-[0.06em]">Gold</span>
      </div>
      <div className={cn('mt-1 font-display italic tracking-[0.15em] text-gold-light', scale.sub === 'text-sm' ? 'text-lg' : scale.sub === 'text-[11px]' ? 'text-sm' : 'text-xs')}>
        Banquet
      </div>
      {flourish && <Flourish className={cn(scale.fl, 'mt-1 rotate-180 opacity-90')} />}
    </div>
  );
}

/** Horizontal lockup for app chrome (sidebar / topbar). */
export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-lg text-gold-gradient">Royal Gold</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[rgb(var(--text-dim))]">Banquet · Karachi</div>
        </div>
      )}
    </div>
  );
}
