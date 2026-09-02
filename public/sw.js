/* Skylight Ballroom — service worker.
 *
 * Deliberately conservative. This app handles bookings, payments and per-user
 * authenticated pages, so the rules are:
 *   • Only ever handle GET. Server actions and API writes are POSTs and must
 *     pass straight through untouched.
 *   • Never cache HTML for authenticated pages or anything under /api — that
 *     risks showing one user stale or another user's data.
 *   • Cache only immutable build assets and icons, which are content-hashed.
 */

// Bump this on every release that changes caching behaviour — `activate`
// deletes every cache that doesn't start with the current VERSION.
const VERSION = 'rgb-v6';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png?v=2',
  '/icons/icon-512.png?v=2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined) // a missing precache entry must not block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Writes (server actions, API mutations) are never touched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only; skip auth and API traffic entirely.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Immutable, content-hashed build output + icons → cache-first.
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/hero/');

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Page navigations → always go to the network so data is fresh; fall back to
  // a static offline page only when the network is genuinely unavailable.
  // Nothing authenticated is written to the cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
  }
});


/* ── Push notifications ────────────────────────────────
 * A new booking or enquiry arrives as a push message from the server. The
 * payload is JSON: { title, body, url, tag }.
 */
self.addEventListener('push', (event) => {
  let data = { title: 'Skylight Ballroom', body: '', url: '/app', tag: 'rgb' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // Some push services deliver plain text; show it rather than nothing.
    try { data.body = event.data ? event.data.text() : ''; } catch (e2) {}
  }

  // Tell any open tab so its bell badge updates without waiting for the poll.
  const ping = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => list.forEach((c) => c.postMessage({ type: 'RGB_PUSH' })))
    .catch(() => undefined);

  event.waitUntil(
    Promise.all([ping, self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png?v=2',
      badge: '/icons/icon-192.png?v=2',
      // Same tag replaces an earlier alert for the same booking instead of
      // stacking duplicates.
      tag: data.tag,
      renotify: true,
      data: { url: data.url },
    })])
  );
});

/* Tapping the notification focuses an open tab if there is one, rather than
 * opening a second copy of the app. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
