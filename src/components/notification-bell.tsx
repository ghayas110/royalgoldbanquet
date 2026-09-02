'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markRead, markAllRead, type NotificationItem } from '@/lib/actions/notifications';
import { Bell, BookMarked, Sparkles, MessageSquareQuote, Wallet, Check } from 'lucide-react';

/** How often the badge is refreshed while the app is open. */
const POLL_MS = 30_000;

const ICON: Record<NotificationItem['type'], React.ComponentType<{ className?: string }>> = {
  BOOKING: BookMarked,
  ENQUIRY: Sparkles,
  LEAD: Sparkles,
  REVIEW: MessageSquareQuote,
  PAYMENT: Wallet,
};

/** Elapsed seconds come from MySQL, so no timezone maths happens here. */
function ago(seconds: number): string {
  const mins = Math.round(Math.max(0, seconds) / 60);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/**
 * `align` decides which way the panel opens. In the 256px desktop sidebar it
 * must extend rightwards into the content area — right-aligned there pushes it
 * off the left edge of the screen.
 */
export function NotificationBell({ className, align = 'right' }: { className?: string; align?: 'left' | 'right' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * Read through the API route, never a server action: a server action makes
   * Next re-render the route, which re-mounts this component and fires the
   * poll again — a loop that hammered the server and the database.
   */
  const refreshCount = useCallback(() => {
    fetch('/api/notifications', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setUnread(Number(d.unread) || 0); })
      .catch(() => undefined);
  }, []);

  // Poll for the badge. Paused while the tab is hidden so a phone left open
  // overnight isn't hitting the database every 30 seconds.
  useEffect(() => {
    refreshCount();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshCount(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [refreshCount]);

  // A push arriving while the app is open should update the badge immediately.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'RGB_PUSH') refreshCount();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      fetch('/api/notifications?list=1&limit=20', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          setItems(d?.items ?? []);
          if (d) setUnread(Number(d.unread) || 0);
        })
        .catch(() => setItems([]));
    }
  }

  function openItem(n: NotificationItem) {
    setOpen(false);
    start(async () => {
      if (!n.read) { await markRead(n.id).catch(() => undefined); refreshCount(); }
      if (n.url) router.push(n.url);
    });
  }

  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      <button
        onClick={toggle}
        className="relative rounded-lg p-2 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"
        aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink ring-2 ring-[rgb(var(--surface))]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--surface))] shadow-2xl`}>
          <div className="flex items-center justify-between border-b border-[rgb(var(--border)/0.5)] px-4 py-3">
            <span className="font-display text-base text-gold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => start(async () => {
                  await markAllRead().catch(() => undefined);
                  setUnread(0);
                  setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
                })}
                className="flex items-center gap-1 text-xs text-[rgb(var(--text-dim))] hover:text-gold"
              >
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {items === null && (
              <div className="px-4 py-6 text-center text-sm text-[rgb(var(--text-dim))]">Loading…</div>
            )}
            {items?.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[rgb(var(--text-dim))]">
                Nothing yet. New bookings and enquiries will show up here.
              </div>
            )}
            {items?.map((n) => {
              const Icon = ICON[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 border-b border-[rgb(var(--border)/0.3)] px-4 py-3 text-left last:border-0 hover:bg-[rgb(var(--surface-2))] ${n.read ? '' : 'bg-[rgb(var(--gold)/0.06)]'}`}
                >
                  <span className={`mt-0.5 shrink-0 ${n.read ? 'text-[rgb(var(--text-dim))]' : 'text-gold'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? 'text-[rgb(var(--text-muted))]' : 'font-medium text-[rgb(var(--text))]'}`}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-xs text-[rgb(var(--text-dim))]">{n.body}</span>
                    )}
                    <span className="mt-1 block text-[11px] text-[rgb(var(--text-dim))]">{ago(n.secondsAgo)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
