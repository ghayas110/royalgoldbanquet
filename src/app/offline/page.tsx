import { BrandLockup } from '@/components/brand';
import Link from 'next/link';

export const metadata = { title: 'Offline — Skylight Ballroom & Catering' };

// Static fallback served by the service worker when a navigation fails.
// Must not touch the database — it has to render with no network at all.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandLockup />
      <h1 className="mt-8 font-display text-3xl text-[rgb(var(--text))]">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-[rgb(var(--text-muted))]">
        Skylight Ballroom & Catering Service needs a connection to load bookings and payments. Check your
        internet and try again.
      </p>
      <Link
        href="/app"
        className="mt-7 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-ink ring-1 ring-inset ring-white/15 hover:bg-gold-light"
      >
        Try again
      </Link>
    </main>
  );
}
