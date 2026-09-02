'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'rgb-install-dismissed';

/**
 * "Install app" affordance shown on the sign-in screen.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which we capture and replay
 * on click. iOS Safari never fires it and offers no programmatic install, so
 * there we show the manual Share → Add to Home Screen steps instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Already running as an installed app → nothing to offer.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    // iPadOS 13+ reports as Mac; detect it via touch support.
    const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    if (ios || iPadOS) {
      setIsIOS(true);
      setHidden(false);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's own mini-infobar; we present our own
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => setHidden(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setDeferred(null);
  }

  if (hidden) return null;

  return (
    <div className="mt-4 rounded-xl border border-[rgb(var(--gold)/0.35)] bg-[rgb(var(--gold)/0.07)] p-4">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[rgb(var(--text))]">Install Skylight</div>
          <p className="mt-0.5 text-xs text-[rgb(var(--text-muted))]">
            Add it to your home screen for full-screen, app-like access.
          </p>

          {isIOS ? (
            showIOSHelp ? (
              <ol className="mt-3 space-y-1.5 text-xs text-[rgb(var(--text-muted))]">
                <li className="flex items-center gap-1.5">
                  1. Tap <Share className="inline h-3.5 w-3.5 text-gold" /> Share in Safari&apos;s toolbar
                </li>
                <li className="flex items-center gap-1.5">
                  2. Choose <Plus className="inline h-3.5 w-3.5 text-gold" /> Add to Home Screen
                </li>
                <li>3. Tap <span className="text-gold">Add</span> — done.</li>
              </ol>
            ) : (
              <button onClick={() => setShowIOSHelp(true)} className="mt-2 text-xs font-medium text-gold hover:underline">
                Show me how →
              </button>
            )
          ) : (
            <button
              onClick={install}
              className="mt-2.5 rounded-lg bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink ring-1 ring-inset ring-white/15 hover:bg-gold-light"
            >
              Install app
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss install prompt" className="rounded-lg p-1 text-[rgb(var(--text-dim))] hover:text-[rgb(var(--text))]">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
