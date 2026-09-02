'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { clipLength, type Reel } from '@/lib/gallery';

/**
 * One film in the collage.
 *
 * Loading happens in two stages, and that is what makes playback smooth.
 *
 * A single observer that both fetches AND plays at the same moment is the
 * cause of the stutter you see on a scrolling video wall: the clip is asked to
 * play against a completely cold buffer, so it stalls on its first frames.
 * Here an outer observer with a generous margin starts buffering while the
 * tile is still below the fold, and a second, stricter one starts playback
 * only once it is properly on screen. By then there is something to play.
 *
 * Until a tile is near, it costs one poster image and nothing else. Five
 * posters is roughly 240 KB against 9 MB of video.
 *
 * The tiles are deliberately silent: the audio lives in the lightbox, where
 * one clip has the visitor's attention and five soundtracks cannot collide.
 */
export function ReelTile({
  reel, className = '', onOpen, index, aspect = '9 / 16',
}: {
  reel: Reel;
  className?: string;
  onOpen: () => void;
  index: number;
  /**
   * The tile's own aspect, independent of the film's. The clips are all 9:16;
   * a wide tile at that ratio becomes absurdly tall (a half-width tile on a
   * 1280px page would run to 1100px), so the collage crops to a squarer shape
   * with object-cover and lets the lightbox show the full frame.
   */
  aspect?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Close enough to be worth downloading. */
  const [near, setNear] = useState(false);
  /** On screen enough to be worth playing. */
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // IntersectionObserver rather than a scroll listener: no work on frames
  // where nothing crossed the threshold.
  //
  // Two of them, with different jobs. The buffering one fires a screen-height
  // early; the playback one waits until the tile is over half visible, which
  // also stops a tile that is barely peeking at the edge of the viewport from
  // taking a decoder slot.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const buffer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setNear(true); },  // one way: never un-buffer
      { rootMargin: '600px 0px' },
    );
    const play = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.55 },
    );
    buffer.observe(el);
    play.observe(el);
    return () => { buffer.disconnect(); play.disconnect(); };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView && !reduced) {
      // Autoplay is a promise and rejects on some mobile power-saving modes.
      // The poster stays up in that case, which is a fine outcome.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [inView, reduced]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play film: ${reel.alt}`}
      className={`group relative block w-full overflow-hidden rounded-2xl bg-[rgb(var(--surface))] text-left ring-1 ring-[rgb(var(--gold)/0.18)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:ring-[rgb(var(--gold)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transform-none ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <video
        ref={videoRef}
        // The source is only attached once the tile is near, so a page of
        // clips costs nothing until the visitor scrolls towards it.
        src={near ? reel.src : undefined}
        poster={reel.poster}
        muted
        loop
        playsInline
        preload={near ? 'auto' : 'none'}
        // Nothing here should ever hand playback to an external display or
        // pop out of the page; these are background texture, not a player.
        disablePictureInPicture
        disableRemotePlayback
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transform-none"
      />

      {/* Keeps the caption legible whatever frame is underneath it. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(11,11,13,0) 45%, rgba(11,11,13,0.78) 100%)' }}
      />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <span className="text-[11px] font-medium tabular-nums text-ivory/80">{clipLength(reel.duration)}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--gold))] text-ink opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:opacity-100">
          <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
        </span>
      </div>

      <span className="sr-only">{reel.alt}. Length {clipLength(reel.duration)}.</span>
    </button>
  );
}
