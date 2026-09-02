'use client';

import { useState, useTransition } from 'react';
import { Card, SectionTitle, Button, Field, Input, Textarea } from '@/components/ui';
import { saveCateringProfile } from '@/lib/actions/catering';
import type { CateringProfile } from '@/lib/types';
import { Save } from 'lucide-react';

export function SettingsClient({ profile }: { profile: CateringProfile }) {
  const [form, setForm] = useState(profile);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const set = (k: keyof CateringProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    setErr(''); setMsg('');
    start(async () => {
      const res = await saveCateringProfile(form);
      if (res.ok) setMsg(res.message ?? 'Saved.'); else setErr(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Catering" sub="These appear on the quotation slip. The catering arm trades under its own name and address, separate from the ballroom.">
        Business Profile
      </SectionTitle>

      {err && <Card className="border-negative/30 bg-negative/10 p-3 text-sm text-negative">{err}</Card>}
      {msg && <Card className="p-3 text-sm text-positive">{msg}</Card>}

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" hint="Printed on the slip letterhead">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Quotation prefix" hint="SC gives SC-18706. Letters only.">
            <Input value={form.quotaPrefix} onChange={(e) => set('quotaPrefix', e.target.value.toUpperCase())} maxLength={6} />
          </Field>
          <Field label="Contact person" hint="Printed above the address">
            <Input value={form.person} onChange={(e) => set('person', e.target.value)} placeholder="M. Tahir" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0300-2238418" />
          </Field>
        </div>
        <Field label="Shop address">
          <Textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Terms of payment" hint="First line of the terms box">
          <Textarea rows={2} value={form.terms} onChange={(e) => set('terms', e.target.value)} />
        </Field>
        <Field label="Tax line" hint="Prints in the slip header, just above the status. Leave blank to hide it.">
          <Input value={form.taxNote} onChange={(e) => set('taxNote', e.target.value)} placeholder="If Tax Apply Pay by Party" />
        </Field>
        <Field label="Standing note" hint="The meat-price caveat, or anything else that prints on every quotation">
          <Textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending}>
            <Save className="mr-1.5 h-4 w-4" />{pending ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
