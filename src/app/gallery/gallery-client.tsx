'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { REELS } from '@/lib/gallery';
import { ReelTile } from '@/components/reel-tile';
import { ReelLightbox } from '@/components/reel-lightbox';

/**
 * The collage.
 *
 * Five clips, five cells, no filler tile. Every clip is 9:16, so varying the
 * WIDTH of a tile is not available as a compositional tool here: a tile twice
 * as wide is twice as tall, and one wide cell would run past a full screen of
 * height on its own. The rhythm comes from vertical offset and from where a
 * tile starts on the grid instead.
 *
 * Row one runs the full twelve columns. Row two is inset by two columns on
 * each side, so the composition closes inwards rather than trailing off into
 * an empty cell. Below `lg` it is two plain columns, where asymmetry would
 * read as a bug rather than a choice.
 */
const SHAPE = [
  'lg:col-span-4',
  'lg:col-span-4 lg:mt-16',
  'lg:col-span-4 lg:mt-7',
  'lg:col-span-4 lg:col-start-3',
  'lg:col-span-4 lg:mt-16',
];

export function GalleryClient() {
  const [open, setOpen] = useState<number | null>(null);
  const reduce = useReducedMotion();

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-12 lg:gap-6">
        {REELS.map((reel, i) => (
          <motion.div
            key={reel.id}
            className={SHAPE[i] ?? 'lg:col-span-4'}
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            <ReelTile reel={reel} index={i} aspect="3 / 4" onOpen={() => setOpen(i)} />
          </motion.div>
        ))}
      </div>

      {open !== null && (
        <ReelLightbox index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      )}
    </>
  );
}
