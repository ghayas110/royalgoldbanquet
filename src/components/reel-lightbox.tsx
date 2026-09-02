'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import { REELS } from '@/lib/gallery';

/**
 * One film, full attention.
 *
 * This is where sound lives. The tiles in the collage are silent by design, so
 * nothing plays audio until a visitor deliberately opens a clip and unmutes it.
 * It still OPENS muted, because every browser blocks autoplay with sound and a
 * clip that refuses to start is worse than one that starts quiet.
 *
 * The films are people talking about the venue, so muting them permanently
 * would throw away the reason they exist. Hence the control rather than a
 * stripped audio track.
 */
export function ReelLightbox({ index, onClose, onIndex }: {
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [muted, setMuted] = useState(true);
  const [mounted, setMounted] = useState(false);
  const reel = REELS[index];

  useEffect(() => setMounted(true), []);

  const go = useCallback((delta: number) => {
    onIndex((index + delta + REELS.length) % REELS.length);
  }, [index, onIndex]);

  // Escape closes, arrows move. Focus lands on the close button so a keyboard
  // user is inside the dialog rather than still behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, go]);

  // A new clip starts from the top, and inherits the sound choice already made.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }, [index]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reel.alt}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(11,11,13,0.92)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-full w-full max-w-[min(92vw,420px)] flex-col">
        <video
          ref={videoRef}
          key={reel.src}
          src={reel.src}
          poster={reel.poster}
          muted={muted}
          loop
          playsInline
          autoPlay
          controls
          className="w-full rounded-2xl bg-black ring-1 ring-[rgb(var(--gold)/0.3)]"
          style={{ aspectRatio: '9 / 16', maxHeight: '82vh' }}
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(240,214,123,0.4)] px-4 py-2 text-sm text-ivory transition-colors hover:bg-[rgba(240,214,123,0.12)]"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {muted ? 'Turn sound on' : 'Sound on'}
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous film"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(240,214,123,0.4)] text-ivory transition-colors hover:bg-[rgba(240,214,123,0.12)]">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[3rem] text-center text-sm tabular-nums text-ivory/70">{index + 1} of {REELS.length}</span>
            <button type="button" onClick={() => go(1)} aria-label="Next film"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(240,214,123,0.4)] text-ivory transition-colors hover:bg-[rgba(240,214,123,0.12)]">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 right-0 inline-flex h-10 w-10 -translate-y-full items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-ivory transition-colors hover:bg-[rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
