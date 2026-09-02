'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Badge, Field, Input, Select, Modal, EmptyState, TableScroll } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
import { saveCateringMeatType, setCateringMeatTypeActive, deleteCateringMeatType } from '@/lib/actions/catering';
import { UNIT_META, type CateringMeatTypeRow, type CateringUnit } from '@/lib/types';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Beef } from 'lucide-react';

const BASE_UNITS: CateringUnit[] = ['KG', 'LITRE', 'PCS'];
const EMPTY = { name: '', unit: 'KG' as CateringUnit, rate: '', sortOrder: '0' };

export function MeatClient({ meats, canManage }: { meats: CateringMeatTypeRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringMeatTypeRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); }
  function openEdit(m: CateringMeatTypeRow) {
    setEditing(m);
    setForm({ name: m.name, unit: m.unit, rate: String(m.rate), sortOrder: String(m.sortOrder) });
    setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringMeatType(editing?.id ?? null, {
        name: form.name, unit: form.unit, rate: Number(form.rate) || 0, sortOrder: Number(form.sortOrder) || 0,
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

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub="Change a rate here and every future quotation prices its meat from the new figure — the dishes themselves are untouched."
        right={canManage ? <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add meat</Button> : undefined}
      >
        Meat Rates
      </SectionTitle>

      {notice && (
        <Card className="flex items-center justify-between gap-3 p-3 text-sm text-[rgb(var(--text-muted))]">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-gold hover:underline">Dismiss</button>
        </Card>
      )}

      <Card className="p-5">
        {meats.length === 0 ? (
          <EmptyState icon={<Beef className="h-6 w-6" />} title="No meat rates yet" sub="Add CHICKEN, BEEF, MUTTON and their current rates." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Meat</th>
                  <th className="py-2 pr-3 font-medium">Priced by</th>
                  <th className="py-2 pr-3 text-right font-medium">Rate</th>
                  <th className="py-2 pr-3 text-right font-medium">Dishes using it</th>
                  {canManage && <th className="py-2 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {meats.map((m) => (
                  <tr key={m.id} className={`border-b border-[rgb(var(--border)/0.3)] last:border-0 ${m.isActive ? '' : 'opacity-50'}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[rgb(var(--text))]">{m.name}</span>
                        {!m.isActive && <Badge tone="muted">Archived</Badge>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-dim))]">per {UNIT_META[m.unit].label}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text))]">{fmtMoney(m.rate, false)}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{m.usedCount ?? 0}</td>
                    {canManage && (
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(m)} disabled={pending} title="Edit"
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => act(() => setCateringMeatTypeActive(m.id, !m.isActive))} disabled={pending}
                            title={m.isActive ? 'Archive' : 'Restore'}
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            {m.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                          </button>
                          {!m.usedCount && (
                            <button onClick={() => { if (confirm(`Delete "${m.name}"?`)) act(() => deleteCateringMeatType(m.id)); }}
                              disabled={pending} title="Delete"
                              className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-negative disabled:opacity-40">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'Add meat'}>
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CHICKEN" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priced by">
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as CateringUnit })}>
                {BASE_UNITS.map((u) => <option key={u} value={u}>per {UNIT_META[u].label}</option>)}
              </Select>
            </Field>
            <Field label="Current rate"><Input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="850" /></Field>
          </div>
          <Field label="Sort order"><Input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Add meat'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
