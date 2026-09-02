/**
 * The venue films.
 *
 * Client-supplied phone footage, re-encoded for the web (720p H.264, faststart)
 * with a poster frame lifted from 40% through each clip. The first second of
 * several of them is someone walking in or a lift door, which made a poor
 * still, so the poster is deliberately not frame one.
 *
 * `ratio` is the intrinsic aspect. All five are 9:16 vertical, shot for
 * Instagram, and the layouts below are built around that rather than fighting
 * it with letterboxing.
 */
export interface Reel {
  id: string;
  src: string;
  poster: string;
  /** Seconds. Shown so a visitor knows what they are committing to. */
  duration: number;
  /** Describes the frame for screen readers. Kept factual. */
  alt: string;
}

export const REELS: Reel[] = [
  {
    id: 'reel-1',
    src: '/gallery/reel-1.mp4',
    poster: '/gallery/reel-1.jpg',
    duration: 44,
    alt: 'A guest speaking to camera in front of the floral stage, under hanging blossom',
  },
  {
    id: 'reel-2',
    src: '/gallery/reel-2.mp4',
    poster: '/gallery/reel-2.jpg',
    duration: 34,
    alt: 'A guest speaking to camera at a table, with the hall lit behind her',
  },
  {
    id: 'reel-3',
    src: '/gallery/reel-3.mp4',
    poster: '/gallery/reel-3.jpg',
    duration: 36,
    alt: 'Walking in through the decorated entrance past the balloon arch',
  },
  {
    id: 'reel-4',
    src: '/gallery/reel-4.mp4',
    poster: '/gallery/reel-4.jpg',
    duration: 60,
    alt: 'A walk through the hall during an event',
  },
  {
    id: 'reel-5',
    src: '/gallery/reel-5.mp4',
    poster: '/gallery/reel-5.jpg',
    duration: 49,
    alt: 'A walk through the venue entrance and lobby',
  },
];

/** 0:44 rather than 44. */
export function clipLength(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
