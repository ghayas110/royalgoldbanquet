import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { RegisterSW } from '@/components/register-sw';
import { getBrand } from '@/lib/data';
import { siteUrl } from '@/lib/site-url';

// `display: 'optional'` (not 'swap') is deliberate: the ornate wordmark is TEXT
// in Playfair with a background-clip gradient, so a swap repaints the logo in a
// mismatched fallback serif first — the "distorted logo" flash. 'optional' gives
// the font a short block window and never swaps afterwards, and the metric-
// matched fallback below keeps the layout from shifting.
const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'optional',
  preload: true,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'optional',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

/**
 * Built per request so the browser tab, the installed-app name and the
 * home-screen label all follow Settings → Business Profile.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
  // Absolute base for canonical URLs and Open Graph images. Without it Next
  // resolves them against the request host, so a shared link previews with
  // whatever hostname the crawler happened to hit.
  metadataBase: new URL(siteUrl()),
  title: `${brand.name}${brand.city ? ` — ${brand.city}` : ''}`,
  description: 'Premium ballroom, catering & Live Cooking booking, POS and accounting platform.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png?v=2', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [{ url: '/icons/favicon-32.png?v=2', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180' }],
  },
  };
}

export const viewport: Viewport = {
  // Matches --bg so the first paint is the app's dark tone, not a white flash.
  themeColor: '#0B0B0D',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} dark`} suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme BEFORE first paint. Without this the provider
          reads localStorage in an effect, so a light-theme user gets a dark
          first paint that flips after hydration — the other half of the
          "wrong-looking page, then the real site" flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('skylight-theme')||'dark';var r=document.documentElement;r.classList.toggle('light',t==='light');r.classList.toggle('dark',t!=='light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased grain">
        <Providers>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
