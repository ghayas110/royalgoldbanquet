'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { REELS } from '@/lib/gallery';
import { ReelTile } from './reel-tile';
import { ReelLightbox } from './reel-lightbox';

/**
 * The films section on the landing page.
 *
 * A scroll-snap rail rather than a grid, for two reasons. The clips are 9:16,
 * so a horizontal run of tall tiles wastes no space where a grid of them would
 * leave deep gutters. And every other section on this page is a stacked grid,
 * so a rail gives the page a rhythm change exactly where the eye needs one.
 */
export function GalleryRail() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="films" className="relative py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Inside a Skylight night</h2>
            <p className="mt-3 max-w-xl text-[rgb(var(--text-muted))]">
              Filmed by the families and creators who celebrated here.
            </p>
          </div>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--gold)/0.4)] px-5 py-2.5 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--gold)/0.12)]"
          >
            View gallery <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Bleeds off the right edge on purpose: a tile cut by the viewport is
          what tells a visitor the rail keeps going. */}
      <div className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:px-[max(1.5rem,calc((100vw-80rem)/2))]">
        {REELS.map((reel, i) => (
          <div key={reel.id} className="w-[62vw] shrink-0 snap-start sm:w-[38vw] lg:w-[19rem]">
            <ReelTile reel={reel} index={i} onOpen={() => setOpen(i)} />
          </div>
        ))}
      </div>

      {open !== null && (
        <ReelLightbox index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      )}
    </section>
  );
}
