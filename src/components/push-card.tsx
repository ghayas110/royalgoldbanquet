'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, Button, FadeUp } from '@/components/ui';
import {
  getVapidPublicKey, subscribePush, unsubscribePush, isPushSubscribed, sendTestNotification,
} from '@/lib/actions/notifications';
import { BellRing, BellOff, Send, Loader2, Info } from 'lucide-react';

/** VAPID keys travel as base64url; the Push API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

export function PushCard() {
  const [state, setState] = useState<State>('checking');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      // iOS only exposes the Push API to apps installed to the home screen.
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') { setState('blocked'); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) { setState('off'); return; }
        // The browser can hold a subscription the server has since dropped.
        setState((await isPushSubscribed(sub.endpoint)) ? 'on' : 'off');
      } catch {
        setState('off');
      }
    })();
  }, []);

  function enable() {
    setErr('');
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return; }

        const reg = await navigator.serviceWorker.ready;
        const key = await getVapidPublicKey();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
          }));

        const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        const res = await subscribePush({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          deviceLabel: navigator.userAgent.slice(0, 120),
        });
        if (!res.ok) { setErr(res.error); return; }
        setState('on');
        flash('Notifications are on for this device.');
      } catch (e) {
        setErr((e as Error).message || 'Could not turn on notifications.');
      }
    });
  }

  function disable() {
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setState('off');
        flash('Notifications turned off for this device.');
      } catch (e) {
        setErr((e as Error).message || 'Could not turn notifications off.');
      }
    });
  }

  return (
    <FadeUp delay={0.1}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-gold">Booking &amp; enquiry alerts</h3>
            <p className="mt-0.5 max-w-lg text-sm text-[rgb(var(--text-muted))]">
              Get a notification on this device the moment a booking, enquiry or website
              message comes in — even when the app is closed.
            </p>
          </div>

          {state === 'on' && (
            <Button variant="ghost" className="py-2 text-sm" disabled={pending} onClick={disable}>
              <BellOff className="h-4 w-4" /> Turn off
            </Button>
          )}
          {state === 'off' && (
            <Button className="py-2 text-sm" disabled={pending} onClick={enable}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Turn on
            </Button>
          )}
        </div>

        {msg && <div className="mt-3 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">{msg}</div>}
        {err && <div className="mt-3 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{err}</div>}

        {state === 'checking' && (
          <p className="mt-3 text-sm text-[rgb(var(--text-dim))]">Checking this device…</p>
        )}

        {state === 'on' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 px-3 py-1 text-xs font-medium text-positive">
              <BellRing className="h-3.5 w-3.5" /> On for this device
            </span>
            <Button
              variant="ghost"
              className="py-1.5 text-xs"
              disabled={pending}
              onClick={() => start(async () => {
                const r = await sendTestNotification();
                if (r.ok) flash('Test sent — check your notifications.');
                else setErr(r.error);
              })}
            >
              <Send className="h-3.5 w-3.5" /> Send a test
            </Button>
          </div>
        )}

        {state === 'blocked' && (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This browser is blocking notifications for the site. Allow them in the browser&apos;s
              site settings (tap the padlock in the address bar), then reload this page.
            </span>
          </div>
        )}

        {state === 'unsupported' && (
          <div className="mt-3 flex gap-2 rounded-lg border border-[rgb(var(--border)/0.6)] px-3 py-2.5 text-sm text-[rgb(var(--text-muted))]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>
              This browser can&apos;t show notifications. On iPhone and iPad you must first add
              Skylight Ballroom & Catering Service to the Home Screen (Share → Add to Home Screen) and open it
              from there.
            </span>
          </div>
        )}

        <p className="mt-3 text-xs text-[rgb(var(--text-dim))]">
          The bell in the top bar always shows recent alerts, whether or not device
          notifications are on.
        </p>
      </Card>
    </FadeUp>
  );
}
