'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, FadeUp, Badge } from '@/components/ui';
import {
  touchDevice, revokeDevice, revokeOtherDevices, renameDevice, type DeviceRow,
} from '@/lib/actions/devices';
import { Monitor, Smartphone, Tablet, LogOut, ShieldCheck, Pencil, Check, X, Users } from 'lucide-react';

function iconFor(label: string) {
  if (/iphone|android|phone/i.test(label)) return <Smartphone className="h-4 w-4" />;
  if (/ipad|tablet/i.test(label)) return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

/**
 * "3 minutes ago" style — the owner cares about recency, not timestamps.
 *
 * Takes seconds already measured by the database rather than a timestamp: the
 * stored value has no timezone, so diffing it against the browser's clock
 * reported hours-off nonsense whenever the server and the viewer disagreed.
 */
function ago(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const mins = Math.round(Math.max(0, seconds) / 60);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** One device row, with inline rename and sign-out. */
function DeviceItem({
  d, showUser, onMsg,
}: { d: DeviceRow; showUser?: boolean; onMsg: (m: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.customLabel ?? '');
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await renameDevice(d.sid, draft);
      setEditing(false);
      if (r.ok) { onMsg(draft.trim() ? 'Device renamed.' : 'Name cleared.'); router.refresh(); }
      else onMsg(r.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[rgb(var(--border)/0.5)] px-4 py-3">
      <span className="text-gold">{iconFor(d.deviceLabel)}</span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              maxLength={120}
              placeholder="e.g. Reception iPad"
              className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-sm text-[rgb(var(--text))] focus:border-gold focus:outline-none"
            />
            <button onClick={save} disabled={pending} className="rounded-lg p-1.5 text-positive hover:bg-[rgb(var(--surface-2))] disabled:opacity-50" title="Save">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))]" title="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[rgb(var(--text))]">{d.deviceLabel}</span>
              {d.current && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--gold)/0.15)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  <ShieldCheck className="h-3 w-3" /> This device
                </span>
              )}
              <button
                onClick={() => { setDraft(d.customLabel ?? ''); setEditing(true); }}
                className="rounded p-1 text-[rgb(var(--text-dim))] hover:text-gold"
                title="Rename this device"
                aria-label={`Rename ${d.deviceLabel}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <div className="text-xs text-[rgb(var(--text-dim))]">
              {showUser && d.userName && (
                <span className="text-[rgb(var(--text-muted))]">{d.userName} · </span>
              )}
              {/* Once renamed, keep the detected make visible so it stays identifiable. */}
              {d.customLabel && d.userAgent ? `${detected(d)} · ` : ''}
              Last active {ago(d.secondsAgo)}{d.ip ? ` · ${d.ip}` : ''}
            </div>
          </>
        )}
      </div>

      {showUser && d.userRole && <Badge tone="muted">{d.userRole}</Badge>}

      {!d.current && !editing && (
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const r = await revokeDevice(d.sid);
            if (r.ok) { onMsg('Device signed out.'); router.refresh(); } else onMsg(r.error);
          })}
          className="rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-negative disabled:opacity-50"
        >
          Sign out
        </button>
      )}
    </li>
  );
}

/** The auto-detected label, shown as a subtitle once a custom name is set. */
function detected(d: DeviceRow): string {
  const ua = (d.userAgent ?? '').toLowerCase();
  let os = 'Unknown';
  if (/iphone/.test(ua)) os = 'iPhone';
  else if (/ipad/.test(ua)) os = 'iPad';
  else if (/android/.test(ua)) os = 'Android';
  else if (/windows/.test(ua)) os = 'Windows';
  else if (/mac os x|macintosh/.test(ua)) os = 'Mac';
  else if (/linux/.test(ua)) os = 'Linux';
  return os;
}

export function DevicesCard({
  devices, allDevices = [], canSeeAll = false, currentUserId,
}: {
  devices: DeviceRow[];
  allDevices?: DeviceRow[];
  canSeeAll?: boolean;
  currentUserId?: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [pending, start] = useTransition();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  // Register this browser against the session. The user agent isn't visible
  // inside the NextAuth jwt callback, so it has to come from the client.
  useEffect(() => {
    touchDevice(navigator.userAgent).then((r) => { if (r.ok) router.refresh(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const others = devices.filter((d) => !d.current).length;
  const showing = tab === 'all' ? allDevices : devices;
  const otherPeople = new Set(
    allDevices.filter((d) => d.userId !== currentUserId).map((d) => d.userId),
  ).size;

  return (
    <FadeUp delay={0.08}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-gold">Signed-in devices</h3>
            <p className="mt-0.5 text-sm text-[rgb(var(--text-muted))]">
              {tab === 'mine' ? (
                <>
                  Your email is signed in on{' '}
                  <span className="font-semibold text-[rgb(var(--text))]">
                    {devices.length} device{devices.length === 1 ? '' : 's'}
                  </span>.
                </>
              ) : (
                <>
                  <span className="font-semibold text-[rgb(var(--text))]">
                    {allDevices.length} device{allDevices.length === 1 ? '' : 's'}
                  </span>{' '}
                  signed in across the portal
                  {otherPeople > 0 && ` · ${otherPeople} other ${otherPeople === 1 ? 'person' : 'people'}`}.
                </>
              )}
            </p>
          </div>
          {tab === 'mine' && others > 0 && (
            <Button variant="danger" className="py-2 text-sm" disabled={pending}
              onClick={() => start(async () => {
                const r = await revokeOtherDevices();
                if (r.ok) { flash(`Signed out ${r.count} other device${r.count === 1 ? '' : 's'}.`); router.refresh(); }
                else flash(r.error);
              })}>
              <LogOut className="h-4 w-4" /> Sign out others
            </Button>
          )}
        </div>

        {canSeeAll && (
          <div className="mt-4 flex flex-wrap gap-2">
            {([
              { k: 'mine', label: 'My devices', n: devices.length },
              { k: 'all', label: 'Everyone', n: allDevices.length },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition',
                  tab === t.k
                    ? 'border-gold bg-[rgb(var(--gold)/0.15)] text-gold'
                    : 'border-[rgb(var(--border)/0.6)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
                ].join(' ')}
              >
                {t.k === 'all' && <Users className="h-3.5 w-3.5" />}
                {t.label} <span className="opacity-60">{t.n}</span>
              </button>
            ))}
          </div>
        )}

        {msg && <div className="mt-3 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">{msg}</div>}

        <ul className="mt-4 space-y-2">
          {showing.length === 0 && (
            <li className="text-sm text-[rgb(var(--text-dim))]">No devices recorded yet.</li>
          )}
          {showing.map((d) => (
            <DeviceItem key={d.sid} d={d} showUser={tab === 'all'} onMsg={flash} />
          ))}
        </ul>

        <p className="mt-3 text-xs text-[rgb(var(--text-dim))]">
          Signing a device out takes effect within a minute on that device.
          Tap the pencil to give a device a name you'll recognise.
        </p>
      </Card>
    </FadeUp>
  );
}
