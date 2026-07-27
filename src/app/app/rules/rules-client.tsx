'use client';

import { useState, useTransition } from 'react';
import { Card, SectionTitle, Button, Badge, Field, Input, Select, Modal, Toggle, FadeUp, EmptyState } from '@/components/ui';
import { createRule, updateRule, deleteRule, toggleRule } from '@/lib/actions/rules';
import { ScrollText, Plus, Pencil, Trash2 } from 'lucide-react';

type Rule = { id: number; title: string; body: string; category: string; active: boolean };
const CATS = ['GENERAL', 'BOOKING', 'VENUE', 'PAYMENT'];
const catTone: Record<string, 'gold' | 'green' | 'amber' | 'muted'> = { BOOKING: 'gold', VENUE: 'green', PAYMENT: 'amber', GENERAL: 'muted' };

export function RulesClient({ rules }: { rules: Rule[] }) {
  const [modal, setModal] = useState<null | { rule: Rule | null }>(null);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle sub="Booking & venue policies — shown to staff and on the website" right={<Button onClick={() => setModal({ rule: null })}><Plus className="h-4 w-4" /> New rule</Button>}>
          Rules &amp; Policies
        </SectionTitle>
      </FadeUp>
      {msg && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>}

      {rules.length === 0 ? (
        <Card><EmptyState icon={<ScrollText className="h-8 w-8" />} title="No rules yet" sub="Add your first policy." /></Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r, i) => (
            <FadeUp key={r.id} delay={0.03 * i}>
              <Card className={`p-5 ${!r.active ? 'opacity-55' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg text-[rgb(var(--text))]">{r.title}</h3>
                      <Badge tone={catTone[r.category] ?? 'muted'}>{r.category}</Badge>
                      {!r.active && <Badge tone="muted">Hidden</Badge>}
                    </div>
                    <p className="mt-1.5 text-sm text-[rgb(var(--text-muted))]">{r.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Toggle checked={r.active} onChange={async (v) => { await toggleRule(r.id, v); flash(v ? 'Rule shown.' : 'Rule hidden.'); location.reload(); }} />
                    <button onClick={() => setModal({ rule: r })} className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"><Pencil className="h-4 w-4" /></button>
                    <DeleteRule id={r.id} onDone={flash} />
                  </div>
                </div>
              </Card>
            </FadeUp>
          ))}
        </div>
      )}

      {modal && <RuleModal rule={modal.rule} onClose={() => setModal(null)} onDone={(m) => { setModal(null); flash(m); location.reload(); }} />}
    </div>
  );
}

function DeleteRule({ id, onDone }: { id: number; onDone: (m: string) => void }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { const r = await deleteRule(id); if (r.ok) { onDone('Rule deleted.'); location.reload(); } })} className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-negative/10 hover:text-negative"><Trash2 className="h-4 w-4" /></button>;
}

function RuleModal({ rule, onClose, onDone }: { rule: Rule | null; onClose: () => void; onDone: (m: string) => void }) {
  const [title, setTitle] = useState(rule?.title ?? '');
  const [body, setBody] = useState(rule?.body ?? '');
  const [category, setCategory] = useState(rule?.category ?? 'GENERAL');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <Modal open onClose={onClose} title={rule ? 'Edit rule' : 'New rule'}>
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advance to confirm" /></Field>
        <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        <Field label="Description">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Describe the rule"
            className="w-full rounded-xl bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.7)] px-3.5 py-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--gold)/0.6)]" />
        </Field>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = rule ? await updateRule(rule.id, { title, body, category }) : await createRule({ title, body, category });
            if (r.ok) onDone(r.message ?? 'Saved.'); else setError(r.error);
          })}>{pending ? 'Saving…' : rule ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
