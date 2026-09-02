'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, SectionTitle, Button, Badge, Field, Input, Select, Modal, EmptyState, TableScroll } from '@/components/ui';
import { SearchSelect } from '@/components/search-select';
import { fmtMoney } from '@/lib/format';
import { saveCateringMenuItem, setCateringMenuItemActive, deleteCateringMenuItem } from '@/lib/actions/catering';
import { UNIT_META, type CateringCategoryRow, type CateringMeatTypeRow, type CateringMenuItemRow, type CateringUnit } from '@/lib/types';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, UtensilsCrossed, X, Tags, Beef } from 'lucide-react';

/** Only the base units a rate can be quoted in — GRAM and ML are order units. */
const BASE_UNITS: CateringUnit[] = ['KG', 'LITRE', 'PCS', 'PLATE'];

/**
 * A meat this variant uses, and how much of the dish it accounts for.
 * Two rows at 50 each is the half-chicken-half-beef case.
 */
type VariantMeat = { key: string; meatTypeId: number | null; share: string };
type Variant = { key: string; categoryId: number | null; rate: string; meats: VariantMeat[] };
const uid = () => Math.random().toString(36).slice(2);

export function MenuClient({
  items, categories, meatTypes, canManage,
}: { items: CateringMenuItemRow[]; categories: CateringCategoryRow[]; meatTypes: CateringMeatTypeRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CateringMenuItemRow | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<CateringUnit>('KG');
  const [defaultRate, setDefaultRate] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  const catOptions = categories
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: c.name }));
  const meatOptions = meatTypes
    .filter((m) => m.isActive)
    .map((m) => ({ value: m.id, label: m.name, right: fmtMoney(m.rate, false) }));

  function openNew() {
    setEditing(null); setName(''); setUnit('KG'); setDefaultRate(''); setSortOrder('0');
    setVariants([]); setError(''); setOpen(true);
  }
  function openEdit(it: CateringMenuItemRow) {
    setEditing(it); setName(it.name); setUnit(it.unit);
    setDefaultRate(String(it.defaultRate)); setSortOrder(String(it.sortOrder));
    setVariants(it.variants.map((v) => ({
      key: uid(), categoryId: v.categoryId, rate: String(v.rate),
      meats: (v.meats?.length
        ? v.meats.map((m) => ({ key: uid(), meatTypeId: m.meatTypeId, share: String(m.share) }))
        : v.meatTypeId
          ? [{ key: uid(), meatTypeId: v.meatTypeId, share: '100' }]
          : []),
    })));
    setError(''); setOpen(true);
  }

  function submit() {
    setError('');
    start(async () => {
      const res = await saveCateringMenuItem(editing?.id ?? null, {
        name, unit, defaultRate: Number(defaultRate) || 0, sortOrder: Number(sortOrder) || 0,
        variants: variants
          .filter((v) => v.categoryId)
          .map((v) => ({
          categoryId: v.categoryId!,
          rate: Number(v.rate) || 0,
          // The largest share stays the primary, for anything that still
          // understands only one meat per variant.
          meatTypeId: v.meats.filter((m) => m.meatTypeId)[0]?.meatTypeId ?? null,
          meats: v.meats
            .filter((m) => m.meatTypeId)
            .map((m) => ({ meatTypeId: m.meatTypeId!, share: Number(m.share) || 0 })),
        })),
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
        sub="Rates are quoted per kg, per litre or per piece. A dish can be priced differently in each category."
        right={
          <div className="flex items-center gap-2">
            <Link href="/catering/categories"><Button variant="ghost"><Tags className="mr-1.5 h-4 w-4" /> Categories</Button></Link>
            <Link href="/catering/meat"><Button variant="ghost"><Beef className="mr-1.5 h-4 w-4" /> Meat rates</Button></Link>
            {canManage && <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add dish</Button>}
          </div>
        }
      >
        Menu &amp; Rates
      </SectionTitle>

      {notice && (
        <Card className="flex items-center justify-between gap-3 p-3 text-sm text-[rgb(var(--text-muted))]">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-gold hover:underline">Dismiss</button>
        </Card>
      )}

      <Card className="p-5">
        {items.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed className="h-6 w-6" />} title="The menu is empty" sub="Add your first dish to start building quotations." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Dish</th>
                  <th className="py-2 pr-3 font-medium">Priced by</th>
                  <th className="py-2 pr-3 font-medium">Categories &amp; rates</th>
                  {canManage && <th className="py-2 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className={`border-b border-[rgb(var(--border)/0.3)] last:border-0 ${it.isActive ? '' : 'opacity-50'}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[rgb(var(--text))]">{it.name}</span>
                        {!it.isActive && <Badge tone="muted">Archived</Badge>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[rgb(var(--text-dim))]">per {UNIT_META[it.unit].label}</td>
                    <td className="py-2.5 pr-3">
                      {it.variants.length === 0 ? (
                        <span className="text-[rgb(var(--text-muted))]">{fmtMoney(it.defaultRate, false)} <span className="text-xs text-[rgb(var(--text-dim))]">(no categories)</span></span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {it.variants.map((v) => (
                            <span key={v.categoryId} className="rounded-lg bg-[rgb(var(--surface-2))] px-2 py-0.5 text-xs text-[rgb(var(--text-muted))]">
                              {v.categoryName} <strong className="tnum text-[rgb(var(--text))]">{fmtMoney(v.rate, false)}</strong>
                              {v.meatTypeName && <span className="ml-1 text-gold">+ {v.meatTypeName}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(it)} disabled={pending} title="Edit"
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => act(() => setCateringMenuItemActive(it.id, !it.isActive))} disabled={pending}
                            title={it.isActive ? 'Archive' : 'Restore'}
                            className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40">
                            {it.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                          </button>
                          {!it.usedCount && (
                            <button onClick={() => { if (confirm(`Delete "${it.name}"?`)) act(() => deleteCateringMenuItem(it.id)); }}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'Add dish'} wide>
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dish name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="QORMA" /></Field>
            <Field label="Priced by" hint="The unit the rate is quoted in">
              <Select value={unit} onChange={(e) => setUnit(e.target.value as CateringUnit)}>
                {BASE_UNITS.map((u) => <option key={u} value={u}>per {UNIT_META[u].label}</option>)}
              </Select>
            </Field>
            <Field label="Sort order"><Input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium text-[rgb(var(--text-muted))]">Categories &amp; rates</span>
                <div className="text-xs text-[rgb(var(--text-dim))]">One row per category this dish sells under — beef and chicken can differ.</div>
              </div>
              <Button variant="ghost" onClick={() => setVariants((v) => [...v, { key: uid(), categoryId: null, rate: '', meats: [] }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add category
              </Button>
            </div>

            {variants.length === 0 ? (
              <Field label="Rate" hint={`Used when the dish has no categories — per ${UNIT_META[unit].label}`}>
                <Input type="number" min="0" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} placeholder="800" />
              </Field>
            ) : (
              <div className="space-y-2">
                {variants.map((v) => (
                  <div key={v.key} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Category</label>
                      <SearchSelect
                        options={catOptions}
                        value={v.categoryId}
                        onChange={(val) => setVariants((vs) => vs.map((x) => x.key === v.key ? { ...x, categoryId: val === null ? null : Number(val) } : x))}
                        placeholder="Search categories…"
                        emptyLabel="Select category…"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Rate</label>
                      <Input type="number" min="0" value={v.rate}
                        onChange={(e) => setVariants((vs) => vs.map((x) => x.key === v.key ? { ...x, rate: e.target.value } : x))}
                        placeholder={`per ${UNIT_META[unit].label}`} />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Meat supplied</label>
                      {/* Each meat here becomes its own line on the quotation.
                          A dish that is half chicken and half beef gets two
                          rows at 50 each, and bills both. */}
                      <div className="space-y-1.5">
                        {v.meats.map((m) => (
                          <div key={m.key} className="flex items-center gap-1.5">
                            <div className="min-w-0 flex-1">
                              <SearchSelect
                                options={meatOptions}
                                value={m.meatTypeId}
                                onChange={(val) => setVariants((vs) => vs.map((x) => x.key === v.key
                                  ? { ...x, meats: x.meats.map((y) => y.key === m.key ? { ...y, meatTypeId: val === null ? null : Number(val) } : y) }
                                  : x))}
                                placeholder="Search meats…"
                                emptyLabel="No meat"
                              />
                            </div>
                            <Input
                              type="number" min="0" max="100" value={m.share}
                              onChange={(e) => setVariants((vs) => vs.map((x) => x.key === v.key
                                ? { ...x, meats: x.meats.map((y) => y.key === m.key ? { ...y, share: e.target.value } : y) }
                                : x))}
                              className="w-16 text-right"
                              title="Percent of the dish this meat accounts for"
                            />
                            <span className="text-xs text-[rgb(var(--text-dim))]">%</span>
                            <button
                              onClick={() => setVariants((vs) => vs.map((x) => x.key === v.key ? { ...x, meats: x.meats.filter((y) => y.key !== m.key) } : x))}
                              className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:text-negative" title="Remove meat">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setVariants((vs) => vs.map((x) => x.key === v.key
                            ? { ...x, meats: [...x.meats, { key: uid(), meatTypeId: null, share: x.meats.length === 0 ? '100' : '50' }] }
                            : x))}
                          className="text-xs text-gold hover:underline">
                          + Add meat
                        </button>
                        {v.meats.length > 1 && (
                          <div className={`text-xs ${Math.abs(v.meats.reduce((a, m) => a + (Number(m.share) || 0), 0) - 100) < 0.01 ? 'text-[rgb(var(--text-dim))]' : 'text-amber'}`}>
                            {v.meats.reduce((a, m) => a + (Number(m.share) || 0), 0)}% total
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-1 flex justify-end">
                      <button onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}
                        className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:text-negative" title="Remove">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Add dish'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
