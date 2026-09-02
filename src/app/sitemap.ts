import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * Served at /sitemap.xml.
 *
 * Only the two pages a search engine should ever see. Everything else in this
 * app is either behind a session (the staff portal, the catering portal, the
 * print views), a private tokenised link (the review pages), or has no
 * standalone value (the sign-in screen, the PWA offline fallback). Listing any
 * of those would invite crawls that end in redirects and waste crawl budget on
 * a small site.
 *
 * `robots.ts` blocks the same set, so the two files cannot drift into
 * disagreeing about what is public.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/gallery`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
