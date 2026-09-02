'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Badge, Field, Input, Textarea, Modal, EmptyState } from '@/components/ui';
import { saveCateringRule, setCateringRuleActive, deleteCateringRule } from '@/lib/actions/catering';
import type { CateringRuleRow } from '@/lib/types';
import { Plus, Pencil, Trash2, Eye, EyeOff, ScrollText } from 'lucide-react';

const EMPTY = { text: '', sortOrder: '0' };

/**
 * The standing conditions printed on every quotation.
 *
 * Deliberately flatter than the ballroom's Rules screen: no titles, no
 * categories. A catering rule is one line on a slip, so the screen shows it the
 * way it will print, in print order.
 */
export function RulesClient({ rules, canManage }: { rules: CateringRuleRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringRuleRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); }
  function openEdit(r: CateringRuleRow) {
    setEditing(r);
    setForm({ text: r.text, sortOrder: String(r.sortOrder) });
    setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringRule(editing?.id ?? null, {
        text: form.text, sortOrder: Number(form.sortOrder) || 0,
      });
      if (res.ok) { setOpen(false); setNotice(res.message ?? 'Saved.'); router.refresh(); }
      else setError(res.error);
    });
  }

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setNotice(res.ok ? (res.message ?? 'Done.') : (res.error ?? 'Failed.'));
      router.refresh();
    });

  const printing = rules.filter((r) => r.isActive).length;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub={`Printed under the terms on every quotation slip. ${printing} of ${rules.length} currently print.`}
        right={canManage ? <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add rule</Button> : undefined}
      >
        Rules
      </SectionTitle>

      {notice && <Card className="border-positive/30 bg-positive/10 p-3 text-sm text-positive">{notice}</Card>}

      {rules.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title="No rules yet"
            sub="Add the conditions that should print on every quotation."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r, i) => (
            <Card key={r.id} className={`p-4 ${r.isActive ? '' : 'opacity-55'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="tnum mt-0.5 shrink-0 text-sm text-[rgb(var(--text-dim))]">
                    {r.isActive ? `${i + 1}.` : '—'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-[rgb(var(--text))]">{r.text}</div>
                    {!r.isActive && <Badge tone="muted">Not printing</Badge>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => act(() => setCateringRuleActive(r.id, !r.isActive))}
                      disabled={pending}
                      title={r.isActive ? 'Stop printing this rule' : 'Print this rule again'}
                      className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"
                    >
                      {r.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => act(() => deleteCateringRule(r.id))}
                      disabled={pending}
                      className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-negative/10 hover:text-negative"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit rule' : 'Add rule'}>
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-negative">{error}</div>}
          <Field label="Rule" hint="Prints as one numbered line on the slip">
            <Textarea rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="If Tax Apply Pay by Party" />
          </Field>
          <Field label="Order" hint="Lower prints first">
            <Input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
