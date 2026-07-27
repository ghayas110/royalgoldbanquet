'use client';

import { useState, useEffect, useCallback } from 'react';

const IMAGES = [
  { src: '/hero/hall-2.jpg', alt: 'Elegant wedding banquet hall set with tables, chandeliers and a stage' },
  { src: '/hero/hall-3.jpg', alt: 'Opulent banquet hall with gold seating and luxurious decor' },
  { src: '/hero/hall-4.jpg', alt: 'Grand ballroom set for a celebration with chandeliers and floral centrepieces' },
  { src: '/hero/hall-1.jpg', alt: 'Luxurious banquet hall with grand crystal chandeliers' },
];
const INTERVAL = 5000;

export function HeroSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setActive((i) => (i + 1) % IMAGES.length), []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (paused) return;
    const t = setInterval(next, INTERVAL);
    return () => clearInterval(t);
  }, [next, paused]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Cross-fading images with a slow Ken-Burns zoom on the active one */}
      {IMAGES.map((img, i) => (
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          aria-hidden={i !== active}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${i === active ? 'opacity-100 animate-hero-zoom' : 'opacity-0'}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'auto'}
        />
      ))}

      {/* Legibility scrim + warm gold wash to match the brand */}
      <div aria-hidden className="absolute inset-0" style={{
        background:
          'radial-gradient(70% 55% at 50% 0%, rgba(201,162,39,0.28), transparent 60%),' +
          'linear-gradient(180deg, rgba(11,11,13,0.72) 0%, rgba(11,11,13,0.55) 45%, rgba(11,11,13,0.85) 100%)',
      }} />

      {/* Slide indicators */}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-7 bg-gold' : 'w-2.5 bg-white/45 hover:bg-white/70'}`}
          />
        ))}
      </div>
    </div>
  );
}
