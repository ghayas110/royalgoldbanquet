'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// Statically imported rather than referenced by path. That is what lets Next
// bake in the intrinsic dimensions (so the hero never shifts as it loads) and
// generate the blur placeholder at build time.
import venue1 from '../../public/hero/venue-1.jpg';
import venue2 from '../../public/hero/venue-2.jpg';
import venue3 from '../../public/hero/venue-3.jpg';

const IMAGES = [
  { src: venue1, alt: 'Hall dressed for a reception with teal and gold seating under draped fairy lights' },
  { src: venue2, alt: 'Banquet tables laid out beneath the draped ceiling and chandeliers' },
  { src: venue3, alt: 'The hall set for guests with floral centrepieces and gold detailing' },
];

/**
 * 16px-wide previews, inlined so there is something on screen the instant the
 * HTML parses.
 *
 * Written out rather than left to next/image's own blur generation: with
 * `images.unoptimized` the /_next/image endpoint that produces those in
 * development is switched off, so relying on it means a 404 per image and no
 * placeholder at all. About 340 bytes each.
 *
 * Regenerate after changing a hero image:
 *   node -e "const s=require('sharp');s('public/hero/venue-1.jpg').resize(16).jpeg({quality:40}).toBuffer().then(b=>console.log('data:image/jpeg;base64,'+b.toString('base64')))"
 */
const BLUR = [
  'data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAMABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAwIF/8QAIBAAAgEEAgMBAAAAAAAAAAAAAQIDAAQRIRJBFGFxsf/EABUBAQEAAAAAAAAAAAAAAAAAAAAC/8QAGBEBAAMBAAAAAAAAAAAAAAAAAQACERL/2gAMAwEAAhEDEQA/AM3yIBIJXTkF0OJyAfWe6e2u2aWJLeVUJJwSNLrYyeqm3jVRKVGCqDGPoH4aRY0DKOCnOtgHunOSS5Zwn//Z',
  'data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAMABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAABAX/xAAeEAACAgIDAQEAAAAAAAAAAAABAgMRAAQSITEFUf/EABQBAQAAAAAAAAAAAAAAAAAAAAL/xAAVEQEBAAAAAAAAAAAAAAAAAAABAP/aAAwDAQACEQMRAD8AjRF2W2gLL6TwPmJi2y6hVikALWsQFhm/Lyz8WJDoa8xFuUrvFiGONjwRVs90MAyS/9k=',
  'data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAMABADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMFBv/EACMQAAIABAUFAAAAAAAAAAAAAAECAAMREgQFITFBFCIyUXH/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//EABgRAAIDAAAAAAAAAAAAAAAAAAABESEx/9oADAMBAAIRAxEAPwCZ1ay2aaED6gk6k0rA2LD1CXi7yXYE+/kKlqqi1FCgoK050jT5bhpRyqWSvcVJJ53iac4J0f/Z',
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
        <Image
          key={img.src.src}
          src={img.src}
          alt={img.alt}
          aria-hidden={i !== active}
          fill
          sizes="100vw"
          // The first frame is the Largest Contentful Paint for the whole site.
          // `priority` emits a preload link so it starts downloading with the
          // HTML instead of waiting for React to hydrate. The rest stay lazy:
          // they are not needed until the slider advances five seconds later.
          priority={i === 0}
          loading={i === 0 ? 'eager' : 'lazy'}
          // Baked in at build time from the static import, so there is a real
          // image on screen from the first paint rather than a black gap.
          placeholder="blur"
          blurDataURL={BLUR[i]}
          className={`object-cover transition-opacity duration-[1200ms] ease-in-out ${i === active ? 'opacity-100 animate-hero-zoom' : 'opacity-0'}`}
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
