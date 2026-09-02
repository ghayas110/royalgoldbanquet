import Link from 'next/link';
import { BrandLockup } from '@/components/brand';

/**
 * Global 404 — covers public routes and the standalone /print pages, which sit
 * outside the app shell. Without this, Next serves its bare black default page
 * with no branding and no way back.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandLockup />
      <h1 className="mt-8 font-display text-3xl text-[rgb(var(--text))]">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-[rgb(var(--text-muted))]">
        The page you&apos;re looking for doesn&apos;t exist, or the record it pointed to has been deleted.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className="rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-ink ring-1 ring-inset ring-white/15 hover:bg-gold-light"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-[rgb(var(--border)/0.7)] px-6 py-3 text-sm text-[rgb(var(--text-muted))] hover:border-[rgb(var(--gold)/0.5)] hover:text-[rgb(var(--text))]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
