'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Badge, Field, Input, Modal, EmptyState, TableScroll } from '@/components/ui';
import { saveCateringCategory, setCateringCategoryActive, deleteCateringCategory } from '@/lib/actions/catering';
import type { CateringCategoryRow } from '@/lib/types';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Tags } from 'lucide-react';

export function CategoriesClient({
  categories, canManage,
}: { categories: CateringCategoryRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringCategoryRow | null>(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  function openNew() { setEditing(null); setName(''); setSortOrder('0'); setError(''); setOpen(true); }
  function openEdit(c: CateringCategoryRow) {
    setEditing(c); setName(c.name); setSortOrder(String(c.sortOrder)); setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringCategory(editing?.id ?? null, { name, sortOrder: Number(sortOrder) || 0 });
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
        sub="A dish can be priced under several categories — QORMA sells as BEEF and as CHICKEN at different rates."
        right={canManage ? <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add category</Button> : undefined}
      >
        Categories
      </SectionTitle>

      {notice && (
        <Card className="flex items-center justify-between gap-3 p-3 text-sm text-[rgb(var(--text-muted))]">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-gold hover:underline">Dismiss</button>
        </Card>
      )}

      <Card className="p-5">
        {categories.length === 0 ? (
          <EmptyState icon={<Tags className="h-6 w-6" />} title="No categories yet" sub="Add BEEF, CHICKEN, BAR B Q and so on." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 text-right font-medium">Dishes priced</th>
                  <th className="py-2 pr-3 text-right font-medium">Sort</th>
                  {canManage && <th className="py-2 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className={`border-b border-[rgb(var(--border)/0.3)] last:border-0 ${c.isActive ? '' : 'opacity-50'}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[rgb(var(--text))]">{c.name}</span>
                        {!c.isActive && <Badge tone="muted">Archived</Badge>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{c.itemCount ?? 0}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-dim))]">{c.sortOrder}</td>
                    {canManage && (
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(c)} disabled={pending} title="Edit"
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => act(() => setCateringCategoryActive(c.id, !c.isActive))} disabled={pending}
                            title={c.isActive ? 'Archive' : 'Restore'}
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            {c.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                          </button>
                          {!c.itemCount && (
                            <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) act(() => deleteCateringCategory(c.id)); }}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'Add category'}>
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
          <Field label="Name" hint="Saved in capitals, as it prints on the slip">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CHICKEN" />
          </Field>
          <Field label="Sort order" hint="Lower appears first"><Input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Add category'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
