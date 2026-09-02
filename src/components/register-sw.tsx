'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (required for the app to be installable).
 *
 * Production only. In dev, Next.js serves `/_next/static/*` at STABLE paths
 * (no content hash), so the SW's cache-first rule for those pins the first
 * chunks it ever saw and the app stops picking up code changes. In production
 * the filenames are content-hashed, so caching them is safe.
 *
 * In development this also actively tears down any SW + caches left over from
 * a previous production visit on the same origin (e.g. localhost), otherwise a
 * stale worker keeps controlling the page and serving old chunks.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        if (!regs.length) return;
        Promise.all(regs.map((r) => r.unregister()))
          .then(() => caches.keys())
          .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rgb-')).map((k) => caches.delete(k))))
          .then(() => {
            // The page is still controlled by the old worker until it reloads.
            if (navigator.serviceWorker.controller) window.location.reload();
          })
          .catch(() => undefined);
      });
      return;
    }

    // Only over HTTPS (or localhost) — SWs are refused elsewhere.
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* non-fatal: the app works fine without offline support */
      });
    };

    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
