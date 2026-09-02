import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * Served at /robots.txt.
 *
 * Disallow is not a security control: every private path here is already
 * behind a session check, and this file is publicly readable. It is a crawl
 * instruction, which is why the list names directories rather than spelling
 * out anything sensitive.
 *
 * `/review/` matters most. Those are one-off tokenised links sent to
 * customers; if one is ever pasted somewhere public, this keeps it out of the
 * index.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/app/',       // staff portal
          '/catering/',  // catering portal
          '/print/',     // printable slips and reports
          '/review/',    // private per-customer review links
          '/api/',       // endpoints, including expense attachments
          '/login',      // no standalone value, and it redirects when signed in
          '/offline',    // PWA fallback shell
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
