import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest. This is what makes the app installable and
// controls how it launches from the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skylight Ballroom & Catering Service',
    short_name: 'Skylight',
    description: 'Ballroom booking, catering, enquiries, Live Cooking, POS & accounting for Skylight Ballroom & Catering Service, Karachi.',
    // Installed app opens on the sign-in screen; once a session exists the
    // login page forwards straight through to the dashboard.
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0B0B0D',
    theme_color: '#0B0B0D',
    categories: ['business', 'productivity'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/icons/favicon-32.png?v=2', sizes: '32x32', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-96.png?v=2', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-128.png?v=2', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-256.png?v=2', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-384.png?v=2', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Padded variants so Android's circular/squircle masks don't crop the crest.
      { src: '/icons/icon-maskable-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'New Booking', short_name: 'Book', url: '/app/bookings/new', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
      { name: 'Calendar', short_name: 'Calendar', url: '/app/calendar', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
      { name: 'Bookings', short_name: 'Bookings', url: '/app/bookings', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
      { name: 'Live Cooking', short_name: 'Cooking', url: '/app/live-cooking', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
    ],
  };
}
