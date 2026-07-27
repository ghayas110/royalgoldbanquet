'use client';

import { useState, useTransition } from 'react';
import { Card, SectionTitle, Button, Field, Input, Badge, FadeUp } from '@/components/ui';
import { setSetting } from '@/lib/actions/misc';
import { addExpenseHead, deleteExpenseHead } from '@/lib/actions/petty-cash';
import { Check, Plus, Archive } from 'lucide-react';

export function SettingsClient({ attribution, name, city, heads }: {
  attribution: string; name: string; city: string;
  heads: { id: number; name: string; hasQtyNote: boolean; active: boolean }[];
}) {
  const [attr, setAttr] = useState(attribution);
  const [bName, setBName] = useState(name);
  const [bCity, setBCity] = useState(city);
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();
  const [newHead, setNewHead] = useState('');

  function save(key: string, value: string, label: string) {
    start(async () => { await setSetting(key, value); setSaved(label); setTimeout(() => setSaved(''), 2500); });
  }

  return (
    <div className="space-y-6">
      <FadeUp><SectionTitle sub="Business configuration">Settings</SectionTitle></FadeUp>
      {saved && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{saved} saved.</div>}

      <FadeUp delay={0.03}>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-gold">Sale attribution</h3>
          <p className="mb-4 text-sm text-[rgb(var(--text-dim))]">Which month a settled booking's sale is credited to.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['EVENT_MONTH', 'SETTLEMENT_MONTH'] as const).map((opt) => (
              <button key={opt} onClick={() => { setAttr(opt); save('sale_attribution', opt, 'Attribution'); }}
                className={`rounded-xl border p-4 text-left transition-all ${attr === opt ? 'border-[rgb(var(--gold)/0.5)] bg-[rgb(var(--gold)/0.1)]' : 'border-[rgb(var(--border)/0.5)] hover:bg-[rgb(var(--surface-2))]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[rgb(var(--text))]">{opt === 'EVENT_MONTH' ? 'Event month' : 'Settlement month'}</span>
                  {attr === opt && <Check className="h-4 w-4 text-gold" />}
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">{opt === 'EVENT_MONTH' ? 'Credit sale when the event happens (default)' : 'Credit sale when the booking is fully settled'}</div>
              </button>
            ))}
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.06}>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-gold">Branding</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banquet name">
              <div className="flex gap-2"><Input value={bName} onChange={(e) => setBName(e.target.value)} /><Button variant="outline" disabled={pending} onClick={() => save('banquet_name', bName, 'Name')}>Save</Button></div>
            </Field>
            <Field label="City">
              <div className="flex gap-2"><Input value={bCity} onChange={(e) => setBCity(e.target.value)} /><Button variant="outline" disabled={pending} onClick={() => save('banquet_city', bCity, 'City')}>Save</Button></div>
            </Field>
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.09}>
        <Card className="p-5">
          <h3 className="mb-1 font-display text-lg text-gold">Expense heads</h3>
          <p className="mb-4 text-sm text-[rgb(var(--text-dim))]">Configure the petty-cash columns.</p>
          <div className="mb-4 flex gap-2">
            <Input value={newHead} onChange={(e) => setNewHead(e.target.value)} placeholder="New expense head name" />
            <Button disabled={pending || newHead.length < 2} onClick={() => start(async () => { await addExpenseHead(newHead, false); setNewHead(''); location.reload(); })}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {heads.map((h) => (
              <div key={h.id} className={`flex items-center justify-between rounded-lg border border-[rgb(var(--border)/0.4)] px-3 py-2 text-sm ${!h.active ? 'opacity-50' : ''}`}>
                <span className="text-[rgb(var(--text-muted))]">{h.name} {h.hasQtyNote && <Badge tone="muted" className="ml-1">qty</Badge>}</span>
                {h.active && <button onClick={() => start(async () => { await deleteExpenseHead(h.id); location.reload(); })} className="text-[rgb(var(--text-dim))] hover:text-negative" title="Remove"><Archive className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        </Card>
      </FadeUp>
    </div>
  );
}
