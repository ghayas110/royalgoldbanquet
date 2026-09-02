import Link from 'next/link';
import { SearchX, ArrowLeft, LayoutDashboard } from 'lucide-react';

/**
 * 404 for the authenticated area.
 *
 * Living at `app/app/` means it renders INSIDE the app shell, so the sidebar
 * and bottom nav stay put and the user is never stranded. The common way to
 * land here is following a stale link to a booking that has since been deleted
 * (e.g. after a bulk delete or factory reset), so the copy says so.
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgb(var(--border)/0.7)] bg-[rgb(var(--surface-2))]">
        <SearchX className="h-7 w-7 text-gold" />
      </div>

      <h1 className="mt-6 font-display text-2xl text-[rgb(var(--text))]">This record no longer exists</h1>
      <p className="mt-2 max-w-md text-sm text-[rgb(var(--text-muted))]">
        The page you opened couldn&apos;t be found. It was most likely deleted — for example
        by a bulk delete or a factory reset in Settings — or the link is out of date.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app/bookings"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-white/15 hover:bg-gold-light"
        >
          <ArrowLeft className="h-4 w-4" /> All bookings
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border)/0.7)] px-5 py-2.5 text-sm text-[rgb(var(--text-muted))] hover:border-[rgb(var(--gold)/0.5)] hover:text-[rgb(var(--text))]"
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>
      </div>
    </div>
  );
}
