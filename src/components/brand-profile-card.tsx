'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Field, Input, FadeUp } from '@/components/ui';
import { BRAND_FIELDS, type BrandInfo } from '@/lib/brand-info';
import { updateBrand, resetBrand } from '@/lib/actions/brand';
import { Building2, RotateCcw, Save, Loader2 } from 'lucide-react';

/**
 * Settings → Business Profile.
 *
 * These are the details printed on the booking slip, the enquiry slip and
 * every report, so the form says so plainly — a typo here reaches paper.
 */
export function BrandProfileCard({ brand }: { brand: BrandInfo }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(BRAND_FIELDS.map((f) => [f.key, String(brand[f.key] ?? '')])),
  );
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, start] = useTransition();

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setErr(''); setMsg('');
    start(async () => {
      const res = await updateBrand(form);
      if (res.ok) { setMsg(res.message); router.refresh(); setTimeout(() => setMsg(''), 4000); }
      else setErr(res.error);
    });
  }

  return (
    <FadeUp>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg text-gold">
              <Building2 className="h-5 w-5" /> Business Profile
            </h3>
            <p className="mt-0.5 max-w-xl text-sm text-[rgb(var(--text-muted))]">
              Your name and contact details. These appear on the <b>booking slip</b> and the{' '}
              <b>enquiry slip</b>, on printed reports, and across the public website.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {BRAND_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Input
                value={form[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          ))}
        </div>

        {msg && <div className="mt-4 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">{msg}</div>}
        {err && <div className="mt-4 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{err}</div>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--border)/0.4)] pt-4">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[rgb(var(--text-muted))]">Restore the original details?</span>
              <Button
                variant="danger" className="py-1.5 text-xs" disabled={pending}
                onClick={() => start(async () => {
                  const r = await resetBrand();
                  setConfirmReset(false);
                  if (r.ok) {
                    setMsg(r.message);
                    router.refresh();
                    setTimeout(() => setMsg(''), 4000);
                  } else setErr(r.error);
                })}
              >
                Yes, reset
              </Button>
              <Button variant="ghost" className="py-1.5 text-xs" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-dim))] hover:text-negative"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
            </button>
          )}

          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </Button>
        </div>

        <p className="mt-3 text-xs text-[rgb(var(--text-dim))]">
          Leave a field empty to fall back to the original value — a slip never prints a blank.
        </p>
      </Card>
    </FadeUp>
  );
}
