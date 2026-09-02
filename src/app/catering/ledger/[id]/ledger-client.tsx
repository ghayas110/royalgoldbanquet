'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, SectionTitle, Button, Badge, Field, Input, Textarea, Modal, EmptyState, TableScroll } from '@/components/ui';
import { SearchSelect } from '@/components/search-select';
import { DateInput } from '@/components/date-input';
import { fmtMoney, fmtDate } from '@/lib/format';
import { saveCateringPayable, settleCateringPayable, deleteCateringPayable } from '@/lib/actions/catering';
import type { CateringEventLedger, CateringPayableRow, CateringVendorRow } from '@/lib/types';
import { Plus, Pencil, Trash2, Check, ArrowLeft, Receipt } from 'lucide-react';

const EMPTY = { vendorId: null as number | null, description: '', amount: '', paidAmount: '', dueDate: '', note: '' };

/**
 * One event's books: what it bills, what it owes, what is left.
 *
 * Bills are entered here rather than on the quotation, because a bill is a
 * fact about the event and an event may carry both a quotation and an invoice.
 */
export function EventLedgerClient({
  eventId, quotaNo, customerName, summary, payables, vendors, canManage,
}: {
  eventId: number;
  quotaNo: string;
  customerName: string;
  summary: CateringEventLedger | null;
  payables: CateringPayableRow[];
  vendors: CateringVendorRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringPayableRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  const billed = payables.reduce((s, p) => s + p.amount, 0);
  const paid = payables.reduce((s, p) => s + p.paidAmount, 0);
  const revenue = summary?.revenue ?? 0;
  const profit = revenue - billed;

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); }
  function openEdit(p: CateringPayableRow) {
    setEditing(p);
    setForm({
      vendorId: p.vendorId, description: p.description, amount: String(p.amount),
      paidAmount: p.paidAmount ? String(p.paidAmount) : '', dueDate: p.dueDate?.slice(0, 10) ?? '', note: p.note,
    });
    setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringPayable(editing?.id ?? null, {
        eventId,
        vendorId: form.vendorId,
        description: form.description,
        amount: Number(form.amount) || 0,
        paidAmount: Number(form.paidAmount) || 0,
        dueDate: form.dueDate || null,
        note: form.note,
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
        sub={`${quotaNo}${summary?.invoiceNo ? ` · invoiced as ${summary.invoiceNo}` : ' · not invoiced yet'}`}
        right={
          <Link href="/catering/ledger">
            <Button variant="ghost"><ArrowLeft className="mr-1.5 h-4 w-4" /> All events</Button>
          </Link>
        }
      >
        {customerName || 'Event'}
      </SectionTitle>

      {notice && <Card className="border-positive/30 bg-positive/10 p-3 text-sm text-positive">{notice}</Card>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ['Revenue', revenue, 'text-[rgb(var(--text))]', summary?.invoiced ? 'Invoiced' : 'From the quotation'],
          ['Vendor bills', billed, 'text-[rgb(var(--text))]', `${payables.length} bill${payables.length === 1 ? '' : 's'}`],
          ['Still owed', billed - paid, billed - paid > 0 ? 'text-negative' : 'text-positive', billed - paid > 0 ? 'Outstanding' : 'All settled'],
          ['Event profit', profit, profit >= 0 ? 'text-positive' : 'text-negative', 'Revenue less all bills'],
        ] as const).map(([label, value, tone, hint]) => (
          <Card key={label} className="p-5">
            <div className="text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
            <div className={`mt-1 font-display text-2xl tnum ${tone}`}>{fmtMoney(value)}</div>
            <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">{hint}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-lg text-[rgb(var(--text))]">Vendor bills</div>
            <div className="text-xs text-[rgb(var(--text-dim))]">Everything this event has to pay out.</div>
          </div>
          {canManage && <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add bill</Button>}
        </div>

        {payables.length === 0 ? (
          <EmptyState icon={<Receipt className="h-8 w-8" />} title="No bills yet" sub="Add what this event costs you to run." />
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border)/0.4)] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">
                <tr>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Paid</th>
                  {canManage && <th className="w-28 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {payables.map((p) => {
                  const settled = p.paidAmount >= p.amount - 0.01 && p.amount > 0;
                  return (
                    <tr key={p.id} className="border-b border-[rgb(var(--border)/0.2)] last:border-0">
                      <td className="px-3 py-2 text-[rgb(var(--text))]">
                        {p.vendorName || '—'}
                        {settled ? <Badge tone="green">Paid</Badge> : <Badge tone="amber">Due</Badge>}
                      </td>
                      <td className="px-3 py-2 text-[rgb(var(--text-muted))]">{p.description || '—'}</td>
                      <td className="px-3 py-2 text-[rgb(var(--text-muted))]">{p.dueDate ? fmtDate(p.dueDate) : '—'}</td>
                      <td className="px-3 py-2 text-right tnum text-[rgb(var(--text))]">{fmtMoney(p.amount, false)}</td>
                      <td className="px-3 py-2 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(p.paidAmount, false)}</td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {!settled && (
                              <button onClick={() => act(() => settleCateringPayable(p.id))} disabled={pending} title="Mark paid in full"
                                className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-positive/10 hover:text-positive">
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => openEdit(p)} title="Edit"
                              className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => act(() => deleteCateringPayable(p.id))} disabled={pending} title="Remove"
                              className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-negative/10 hover:text-negative">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr className="bg-[rgb(var(--surface-2)/0.5)] font-medium">
                  <td className="px-3 py-2" colSpan={3}>Total</td>
                  <td className="px-3 py-2 text-right tnum text-[rgb(var(--text))]">{fmtMoney(billed, false)}</td>
                  <td className="px-3 py-2 text-right tnum text-[rgb(var(--text))]">{fmtMoney(paid, false)}</td>
                  {canManage && <td />}
                </tr>
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit bill' : 'Add bill'}>
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-negative">{error}</div>}
          <Field label="Vendor" hint="Or leave blank and just describe it">
            <SearchSelect
              options={vendors.map((v) => ({ value: v.id, label: v.name, sub: v.category || undefined }))}
              value={form.vendorId}
              onChange={(v) => setForm({ ...form, vendorId: v === null ? null : Number(v) })}
              placeholder="Search vendors…"
              emptyLabel="No vendor"
            />
          </Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beef, 40 kg" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bill amount"><Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Paid so far" hint="Leave blank if nothing is paid yet">
              <Input type="number" min="0" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
            </Field>
          </div>
          <Field label="Due date"><DateInput value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} showDay={false} /></Field>
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
