'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, SectionTitle, Button, Badge, Field, Input, Textarea, Modal, EmptyState, TableScroll } from '@/components/ui';
import { saveCateringVendor, setCateringVendorActive, deleteCateringVendor } from '@/lib/actions/catering';
import type { CateringVendorRow } from '@/lib/types';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Truck } from 'lucide-react';

const EMPTY = { name: '', category: '', phone: '', note: '' };

/** Suggestions, not a fixed list: the client adds trades constantly. */
const CATEGORIES = ['MEAT', 'DECOR', 'CROCKERY', 'TRANSPORT', 'STAFF', 'OTHER'];

export function VendorsClient({ vendors, canManage }: { vendors: CateringVendorRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringVendorRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); }
  function openEdit(v: CateringVendorRow) {
    setEditing(v);
    setForm({ name: v.name, category: v.category, phone: v.phone, note: v.note });
    setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringVendor(editing?.id ?? null, form);
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
        sub="Who you buy from. Open a vendor for their full bill history."
        right={canManage ? <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add vendor</Button> : undefined}
      >
        Vendors
      </SectionTitle>

      {notice && <Card className="border-positive/30 bg-positive/10 p-3 text-sm text-positive">{notice}</Card>}

      {vendors.length === 0 ? (
        <Card className="p-5">
          <EmptyState icon={<Truck className="h-8 w-8" />} title="No vendors yet" sub="Add the butcher, the decorator, whoever you buy from." />
        </Card>
      ) : (
        <Card className="p-0">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2))] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bills</th>
                  {canManage && <th className="w-28 px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className={`border-b border-[rgb(var(--border)/0.2)] last:border-0 ${v.isActive ? '' : 'opacity-55'}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/catering/vendors/${v.id}`} className="text-[rgb(var(--text))] hover:text-gold">
                        {v.name}
                      </Link>
                      {!v.isActive && <Badge tone="muted">Archived</Badge>}
                      {v.note && <div className="text-xs text-[rgb(var(--text-dim))]">{v.note}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{v.category || '—'}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--text-muted))]">{v.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {v.billCount
                        ? <Link href={`/catering/vendors/${v.id}`} className="tnum text-gold hover:underline">{v.billCount}</Link>
                        : <span className="tnum text-[rgb(var(--text-dim))]">0</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(v)} title="Edit"
                            className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => act(() => setCateringVendorActive(v.id, !v.isActive))} disabled={pending}
                            title={v.isActive ? 'Archive' : 'Restore'}
                            className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold">
                            {v.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                          </button>
                          <button onClick={() => act(() => deleteCateringVendor(v.id))} disabled={pending} title="Delete"
                            className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-negative/10 hover:text-negative">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit vendor' : 'Add vendor'}>
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-negative">{error}</div>}
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Karachi Meat Supply" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" hint={CATEGORIES.join(' · ')}>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })} placeholder="MEAT" />
            </Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300-1234567" /></Field>
          </div>
          <Field label="Note"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
