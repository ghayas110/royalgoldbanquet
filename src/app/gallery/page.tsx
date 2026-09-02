import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getBrand } from '@/lib/data';
import { BrandLockup } from '@/components/brand';
import { FadeUp } from '@/components/ui';
import { REELS } from '@/lib/gallery';
import { GalleryClient } from './gallery-client';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: `Gallery — ${brand.name}`,
    description: 'Films from weddings, valimas and mehndi nights held at Skylight Ballroom in Karachi.',
    openGraph: {
      title: `Gallery — ${brand.name}`,
      description: 'Films from weddings, valimas and mehndi nights held at Skylight Ballroom in Karachi.',
      images: [REELS[0].poster],
    },
  };
}

export default async function GalleryPage() {
  const brand = await getBrand();

  // VideoObject markup: these clips are the page's substance, so they should be
  // eligible for video results rather than invisible to search.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': REELS.map((r) => ({
      '@type': 'VideoObject',
      name: r.alt,
      description: r.alt,
      thumbnailUrl: r.poster,
      contentUrl: r.src,
      uploadDate: '2026-08-29',
      duration: `PT${r.duration}S`,
      publisher: { '@type': 'Organization', name: brand.name },
    })),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <BrandLockup />
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--gold)/0.35)] px-4 py-2 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--gold)/0.12)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
        <FadeUp>
          <h1 className="max-w-3xl font-display text-4xl leading-[1.08] text-[rgb(var(--text))] md:text-6xl">
            Nights at <span className="text-gold-gradient">Skylight</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[rgb(var(--text-muted))]">
            Filmed by the families and creators who celebrated here. Tap any film to watch it with sound.
          </p>
        </FadeUp>

        <div className="mt-14">
          <GalleryClient />
        </div>

        <FadeUp>
          <div className="mt-20 rounded-3xl border border-[rgb(var(--gold)/0.25)] bg-[rgb(var(--surface)/0.6)] p-8 text-center md:p-12">
            <h2 className="font-display text-2xl text-[rgb(var(--text))] md:text-3xl">Planning your own night?</h2>
            <p className="mx-auto mt-3 max-w-md text-[rgb(var(--text-muted))]">
              Tell us the date and the headcount, and we will come back with availability and a quote.
            </p>
            <Link
              href="/#enquire"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 font-semibold text-ink ring-1 ring-inset ring-white/20 transition-colors hover:bg-gold-light"
            >
              Book your date
            </Link>
          </div>
        </FadeUp>
      </main>
    </div>
  );
}
