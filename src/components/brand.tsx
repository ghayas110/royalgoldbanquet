import { cn } from '@/lib/format';
import Image from 'next/image';
import logoMark from '../../public/logo-mark.png';
import logoLockup from '../../public/logo.png';

/**
 * Skylight Ballroom & Catering Service identity.
 *
 * The mark is a skylight seen from below: an octagonal glass roof with eight
 * mullions running out to the frame and a burst of light at the centre. It is
 * drawn as pure vector (no image asset) so it stays crisp in the sidebar, on
 * the printed slip and inside the generated PWA icons, which are rasterised
 * from this same geometry by `scripts/gen-icons.mjs`.
 */

/** Light-ray divider used above/below the wordmark. */
function Rays({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 24" className={className} aria-hidden fill="none">
      {/* centre gem — the light source */}
      <path d="M120 5 l4.5 7 -4.5 7 -4.5 -7 z" fill="currentColor" />
      {/* tapering beams */}
      <rect x="60" y="11.2" width="48" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="132" y="11.2" width="48" height="1.6" rx="0.8" fill="currentColor" />
      {/* secondary rays, fanning out */}
      <path d="M108 12 l-14 -4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M108 12 l-14 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M132 12 l14 -4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M132 12 l14 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      {/* end taper */}
      <path d="M60 12 h-22" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
      <path d="M180 12 h22" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

/**
 * The house monogram, in the sidebar and anywhere the lockup is too wide.
 *
 * This is the client's own artwork rather than drawn geometry, so it stays in
 * step with the printed slips and the app icon: all three come from the same
 * source file through `npm run icons`.
 *
 * The PNG is transparent, so it sits on light and dark surfaces alike. The
 * full lockup is `/logo.png`; this is the monogram alone.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={logoMark}
      alt=""
      aria-hidden
      // No placeholder: it is a small transparent PNG, and asking for one
      // sends Next to the /_next/image endpoint that `unoptimized` disables.
      placeholder="empty"
      // The sidebar mark is on screen from the first paint on every signed-in
      // page, so it is not a lazy-load candidate.
      priority
      className={cn('h-9 w-9 object-contain', className)}
      draggable={false}
    />
  );
}

/**
 * The full lockup, centred. Used where the brand is the whole point of the
 * block: the top of a printed report, the customer-facing review page.
 *
 * Same artwork as the monogram and the app icon, so a customer sees one mark
 * everywhere. Transparent, so it sits on either theme.
 */
export function SkylightLogo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const h = size === 'lg' ? 'h-28' : size === 'sm' ? 'h-14' : 'h-20';
  return (
    <Image
      src={logoLockup}
      alt="Skylight Ballroom & Catering Service"
      placeholder="empty"
      priority
      className={cn('mx-auto w-auto object-contain', h, className)}
      draggable={false}
    />
  );
}

export function BrandLockup({
  compact,
  name,
  sub,
}: { compact?: boolean; name?: string; sub?: string }) {
  // Written as fallbacks rather than default parameters so an explicit
  // `undefined` from a caller still lands on the house wordmark.
  const line1 = name ?? 'Skylight';
  const line2 = sub ?? 'Ballroom & Catering';
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-lg text-gold-gradient">{line1}</div>
          <div className="whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-[rgb(var(--text-dim))]">{line2}</div>
        </div>
      )}
    </div>
  );
}
