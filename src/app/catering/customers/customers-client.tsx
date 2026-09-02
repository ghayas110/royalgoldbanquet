'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Field, Input, Textarea, Modal, EmptyState, TableScroll } from '@/components/ui';
import { fmtPhone } from '@/lib/format';
import { saveCateringCustomer, deleteCateringCustomer } from '@/lib/actions/catering';
import type { CateringCustomerRow } from '@/lib/types';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

const EMPTY = { name: '', phone: '', phone2: '', address: '', note: '' };

export function CustomersClient({
  customers, canManage,
}: { customers: CateringCustomerRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringCustomerRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); }
  function openEdit(c: CateringCustomerRow) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, phone2: c.phone2, address: c.address, note: c.note });
    setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringCustomer(editing?.id ?? null, form);
      if (res.ok) { setOpen(false); setNotice(res.message ?? 'Saved.'); router.refresh(); }
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub="Regular customers, so a repeat order does not have to be typed out again."
        right={canManage ? <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add customer</Button> : undefined}
      >
        Customers
      </SectionTitle>

      {notice && (
        <Card className="flex items-center justify-between gap-3 p-3 text-sm text-[rgb(var(--text-muted))]">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-gold hover:underline">Dismiss</button>
        </Card>
      )}

      <Card className="p-5">
        {customers.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No customers yet" sub="Add one, or just type a name straight onto a quotation." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Phone</th>
                  <th className="py-2 pr-3 font-medium">Address</th>
                  <th className="py-2 pr-3 text-right font-medium">Quotations</th>
                  {canManage && <th className="py-2 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-[rgb(var(--border)/0.3)] last:border-0">
                    <td className="py-2.5 pr-3 text-[rgb(var(--text))]">{c.name}</td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-muted))]">{fmtPhone(c.phone)}</td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-dim))]">{c.address || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{c.quotationCount ?? 0}</td>
                    {canManage && (
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(c)} disabled={pending} title="Edit"
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {/* Quotations snapshot the name, so deleting only loses the
                              contact — offered when there is no history to lose. */}
                          {!c.quotationCount && (
                            <button
                              onClick={() => {
                                if (!confirm(`Delete ${c.name}?`)) return;
                                start(async () => {
                                  const res = await deleteCateringCustomer(c.id);
                                  setNotice(res.ok ? (res.message ?? 'Deleted.') : res.error);
                                  router.refresh();
                                });
                              }}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'Add customer'}>
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AZEEM BHAI" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300-1234567" /></Field>
            <Field label="Secondary phone"><Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} /></Field>
          </div>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Note"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
