'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Card, SectionTitle, Button, Badge, Field, Input, Select, Textarea, Modal, FadeUp,
  EmptyState, TableScroll,
} from '@/components/ui';
import { fmtMoney, fmtDate, cn } from '@/lib/format';
import type { StockItemRow, StockMovementRow } from '@/lib/data';
import {
  createStockItem, updateStockItem, deleteStockItem, restoreStockItem,
  createStockMovement, updateStockMovement, deleteStockMovement,
  createStockCategory, updateStockCategory, deleteStockCategory,
} from '@/lib/actions/stock';
import {
  Boxes, Plus, Pencil, Trash2, RotateCcw, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, PackageX, History, Tags, Search, Package, Layers, CalendarClock, Lock,
  TrendingUp,
} from 'lucide-react';

type Category = { id: number; name: string; sortOrder: number; itemCount: number };
type BookingOption = { id: number; slipNo: string; eventDate: string; partyName: string };
type Summary = {
  itemCount: number; lowCount: number; negativeCount: number; totalValue: number;
  outNow: number; committed: number; breakageQtyThisMonth: number; breakageValueThisMonth: number;
};

/** Movement vocabulary, in one place — labels, direction and tone. */
const KINDS = {
  PURCHASE:   { label: 'Purchase',   dir: 'in',   tone: 'green' as const, help: 'Bought and added to store' },
  RETURN:     { label: 'Return',     dir: 'in',   tone: 'green' as const, help: 'Came back from an event' },
  ISSUE:      { label: 'Issue',      dir: 'out',  tone: 'amber' as const, help: 'Sent out to an event' },
  BREAKAGE:   { label: 'Breakage',   dir: 'out',  tone: 'red' as const,   help: 'Broken — gone for good' },
  LOSS:       { label: 'Loss',       dir: 'out',  tone: 'red' as const,   help: 'Missing or stolen' },
  ADJUSTMENT: { label: 'Adjustment', dir: 'both', tone: 'brand' as const, help: 'Stock-take correction (may be negative)' },
} as const;
type Kind = keyof typeof KINDS;
const KIND_LIST = Object.keys(KINDS) as Kind[];

const UNITS = ['piece', 'set', 'pair', 'dozen', 'box', 'packet', 'bottle', 'can', 'carton', 'crate', 'roll', 'kg', 'litre', 'cylinder', 'unit'];

type StockProfit = {
  revenue: number; cost: number; profit: number;
  rows: { name: string; qty: number; revenue: number; cost: number; profit: number; events: number }[];
};

export function StockClient({
  canManage, items, categories, movements, summary, bookings, profit,
}: {
  canManage: boolean;
  items: StockItemRow[];
  categories: Category[];
  movements: StockMovementRow[];
  summary: Summary;
  bookings: BookingOption[];
  /** What stock has earned when sold on through bookings. */
  profit: StockProfit;
}) {
  const [tab, setTab] = useState<'items' | 'movements' | 'categories' | 'profit'>('items');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // Modal state — one slot each, so two dialogs can never stack.
  const [itemModal, setItemModal] = useState<null | { item: StockItemRow | null }>(null);
  const [moveModal, setMoveModal] = useState<null | { movement: StockMovementRow | null; item?: StockItemRow; kind?: Kind }>(null);
  const [ledger, setLedger] = useState<StockItemRow | null>(null);

  const done = (m: string) => { setItemModal(null); setMoveModal(null); flash(m); location.reload(); };

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle
          eyebrow="Venue"
          sub="Crockery, furniture, drinks and disposables — what you own, what went out and what broke"
          right={canManage && (
            <div className="flex gap-2">
              <Button variant="solid" onClick={() => setMoveModal({ movement: null })}>
                <History className="h-4 w-4" /> Record movement
              </Button>
              <Button onClick={() => setItemModal({ item: null })}>
                <Plus className="h-4 w-4" /> New item
              </Button>
            </div>
          )}
        >
          Stock
        </SectionTitle>
      </FadeUp>

      {msg && (
        <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>
      )}

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Package className="h-4 w-4" />} label="Items tracked" value={String(summary.itemCount)} />
        <Tile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="At or below reorder"
          value={String(summary.lowCount)}
          tone={summary.lowCount > 0 ? 'warn' : 'plain'}
        />
        <Tile
          icon={<CalendarClock className="h-4 w-4" />}
          label="Promised to events"
          value={String(summary.committed)}
          sub={summary.outNow > 0 ? `${summary.outNow} out right now` : undefined}
        />
        <Tile
          icon={<PackageX className="h-4 w-4" />}
          label="Breakage this month"
          value={fmtMoney(summary.breakageValueThisMonth)}
          sub={`${summary.breakageQtyThisMonth} item(s)`}
          tone={summary.breakageValueThisMonth > 0 ? 'negative' : 'plain'}
        />
      </div>

      {summary.negativeCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-negative/30 bg-negative/8 px-4 py-3 text-sm text-negative">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {summary.negativeCount} item(s) show a negative balance — more has gone out than the opening figure allows.
            Set the correct opening quantity on the item, or post a stock-take adjustment.
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--border))]">
        {([
          ['items', `Items (${items.length})`, <Boxes key="i" className="h-4 w-4" />],
          ['movements', `Movements (${movements.length})`, <History key="m" className="h-4 w-4" />],
          ['categories', `Categories (${categories.length})`, <Tags key="c" className="h-4 w-4" />],
          ['profit', `Profit (${profit.rows.length})`, <TrendingUp key="p" className="h-4 w-4" />],
        ] as const).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors',
              tab === id
                ? 'border-brand font-medium text-brand'
                : 'border-transparent text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <ItemsTab
          items={items}
          categories={categories}
          canManage={canManage}
          onEdit={(item) => setItemModal({ item })}
          onMove={(item, kind) => setMoveModal({ movement: null, item, kind })}
          onLedger={setLedger}
          onFlash={flash}
        />
      )}

      {tab === 'movements' && (
        <MovementsTab
          movements={movements}
          canManage={canManage}
          onEdit={(movement) => setMoveModal({ movement })}
          onFlash={flash}
        />
      )}

      {tab === 'categories' && (
        <CategoriesTab categories={categories} canManage={canManage} onFlash={flash} />
      )}

      {tab === 'profit' && <ProfitTab profit={profit} />}

      {itemModal && (
        <ItemModal item={itemModal.item} categories={categories} onClose={() => setItemModal(null)} onDone={done} />
      )}
      {moveModal && (
        <MovementModal
          movement={moveModal.movement}
          presetItem={moveModal.item}
          presetKind={moveModal.kind}
          items={items}
          bookings={bookings}
          onClose={() => setMoveModal(null)}
          onDone={done}
        />
      )}
      {ledger && (
        <LedgerModal item={ledger} movements={movements.filter((m) => m.itemId === ledger.id)} onClose={() => setLedger(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Items
// ═══════════════════════════════════════════════════════════════

function ItemsTab({
  items, categories, canManage, onEdit, onMove, onLedger, onFlash,
}: {
  items: StockItemRow[];
  categories: Category[];
  canManage: boolean;
  onEdit: (i: StockItemRow) => void;
  onMove: (i: StockItemRow, kind: Kind) => void;
  onLedger: (i: StockItemRow) => void;
  onFlash: (m: string) => void;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ALL');
  const [only, setOnly] = useState<'ALL' | 'LOW' | 'DURABLE' | 'CONSUMABLE' | 'ARCHIVED'>('ALL');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (only === 'ARCHIVED' ? i.active : !i.active) return false;
      if (only === 'LOW' && !i.low) return false;
      if (only === 'DURABLE' && i.kind !== 'DURABLE') return false;
      if (only === 'CONSUMABLE' && i.kind !== 'CONSUMABLE') return false;
      if (cat !== 'ALL' && String(i.categoryId ?? '') !== cat) return false;
      if (s && !`${i.name} ${i.category ?? ''} ${i.unit}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [items, q, cat, only]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-dim))]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="pl-9" aria-label="Search stock items" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto" aria-label="Filter by category">
          <option value="ALL">All categories</option>
          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </Select>
        <Select value={only} onChange={(e) => setOnly(e.target.value as typeof only)} className="w-auto" aria-label="Filter items">
          <option value="ALL">All active</option>
          <option value="LOW">Low stock only</option>
          <option value="DURABLE">Durables only</option>
          <option value="CONSUMABLE">Consumables only</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes className="h-6 w-6" />}
            title="Nothing matches"
            sub={items.length === 0 ? 'Add your first stock item to get started.' : 'Try a different search or filter.'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableScroll>
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-left">
                  <Th>Item</Th>
                  <Th>Type</Th>
                  <Th right>On hand</Th>
                  <Th right>Booked out</Th>
                  <Th right>Available</Th>
                  <Th right>Reorder at</Th>
                  <Th right>Unit cost</Th>
                  <Th right>Value</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className={cn('border-b border-[rgb(var(--border)/0.5)] last:border-0', !i.active && 'opacity-55')}>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => onLedger(i)}
                        className="cursor-pointer text-left font-medium text-[rgb(var(--text))] hover:text-brand"
                        title="View this item's movement history"
                      >
                        {i.name}
                      </button>
                      <div className="text-xs text-[rgb(var(--text-dim))]">
                        {i.category ?? 'Uncategorised'} · per {i.unit}
                        {!i.active && ' · archived'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={i.kind === 'DURABLE' ? 'muted' : 'brand'}>
                        {i.kind === 'DURABLE' ? 'Durable' : 'Consumable'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn('tnum font-semibold', i.onHand < 0 ? 'text-negative' : 'text-[rgb(var(--text))]')}>
                        {fmtQty(i.onHand)}
                      </span>
                      {i.low && <div className="text-[10px] uppercase tracking-wider text-warn">Low</div>}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[rgb(var(--text-dim))]">
                      {i.committed > 0 ? fmtQty(i.committed) : '—'}
                    </td>
                    <td className={cn(
                      'tnum px-3 py-2.5 text-right font-medium',
                      i.available < 0 ? 'text-negative' : i.low ? 'text-warn' : 'text-[rgb(var(--text-muted))]',
                    )}>
                      {fmtQty(i.available)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[rgb(var(--text-dim))]">
                      {i.reorderLevel > 0 ? fmtQty(i.reorderLevel) : '—'}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[rgb(var(--text-muted))]">
                      {i.unitCost > 0 ? fmtMoney(i.unitCost) : '—'}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[rgb(var(--text))]">
                      {i.value > 0 ? fmtMoney(i.value) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          {i.active ? (
                            <>
                              <IconBtn label={`Add stock of ${i.name}`} onClick={() => onMove(i, 'PURCHASE')}>
                                <ArrowDownToLine className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn label={`Issue ${i.name}`} onClick={() => onMove(i, 'ISSUE')}>
                                <ArrowUpFromLine className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn label={`Record breakage of ${i.name}`} onClick={() => onMove(i, 'BREAKAGE')} tone="negative">
                                <PackageX className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn label={`Edit ${i.name}`} onClick={() => onEdit(i)}>
                                <Pencil className="h-4 w-4" />
                              </IconBtn>
                              <DeleteItem item={i} onFlash={onFlash} />
                            </>
                          ) : (
                            <IconBtn
                              label={`Restore ${i.name}`}
                              onClick={async () => { const r = await restoreStockItem(i.id); if (r.ok) { onFlash(r.message ?? 'Restored.'); location.reload(); } }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </IconBtn>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
                  <td colSpan={7} className="px-3 py-2.5 text-right text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                    Value of shown items
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-brand">
                    {fmtMoney(filtered.reduce((s, i) => s + i.value, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        </Card>
      )}
    </div>
  );
}

function DeleteItem({ item, onFlash }: { item: StockItemRow; onFlash: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const hasHistory = item.movementCount > 0;
  return (
    <>
      <IconBtn label={hasHistory ? `Archive ${item.name}` : `Delete ${item.name}`} onClick={() => setOpen(true)} tone="negative">
        <Trash2 className="h-4 w-4" />
      </IconBtn>
      <Modal open={open} onClose={() => setOpen(false)} title={hasHistory ? `Archive ${item.name}?` : `Delete ${item.name}?`}>
        <p className="text-sm leading-relaxed text-[rgb(var(--text-muted))]">
          {hasHistory
            ? `This item has ${item.movementCount} movement(s) on its ledger, so it can't be permanently deleted — that would erase the purchase and breakage history with it. It will be archived: hidden from the list and from new movements, and restorable at any time.`
            : 'This item has no movement history and will be permanently deleted. This cannot be undone.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await deleteStockItem(item.id);
              if (r.ok) { onFlash(r.message ?? 'Done.'); location.reload(); }
            })}
          >
            {pending ? 'Working…' : hasHistory ? 'Archive item' : 'Delete permanently'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ItemModal({
  item, categories, onClose, onDone,
}: {
  item: StockItemRow | null;
  categories: Category[];
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [categoryId, setCategoryId] = useState(String(item?.categoryId ?? ''));
  const [kind, setKind] = useState<'DURABLE' | 'CONSUMABLE'>(item?.kind ?? 'DURABLE');
  const [unit, setUnit] = useState(item?.unit ?? 'piece');
  const [openingQty, setOpeningQty] = useState(String(item?.openingQty ?? ''));
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorderLevel ?? ''));
  const [unitCost, setUnitCost] = useState(String(item?.unitCost ?? ''));
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : 'New stock item'} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dinner Plates" />
          </Field>
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Type"
            hint={kind === 'DURABLE'
              ? 'Goes out to an event and comes back — leaves only through breakage or loss.'
              : 'Issuing it uses it up. Nothing comes back.'}
          >
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="DURABLE">Durable — plates, chairs, linen</option>
              <option value="CONSUMABLE">Consumable — drinks, tissues, gas</option>
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Opening quantity"
            hint={item ? 'Your stock-take baseline. Movements are counted on top of it.' : 'What you have right now.'}
          >
            <Input inputMode="decimal" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Reorder level" hint="0 = don't warn me">
            <Input inputMode="decimal" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Unit cost (Rs.)" hint="Used for stock value">
            <Input inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0" />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Supplier, shelf, brand — anything worth remembering" />
        </Field>

        {error && (
          <div role="alert" className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => start(async () => {
              setError('');
              const payload = {
                name,
                categoryId: categoryId ? Number(categoryId) : null,
                kind,
                unit,
                openingQty: Number(openingQty) || 0,
                reorderLevel: Number(reorderLevel) || 0,
                unitCost: Number(unitCost) || 0,
                notes: notes || null,
              };
              const r = item ? await updateStockItem(item.id, payload) : await createStockItem(payload);
              if (r.ok) onDone(r.message ?? 'Saved.'); else setError(r.error);
            })}
          >
            {pending ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// Movements
// ═══════════════════════════════════════════════════════════════

function MovementsTab({
  movements, canManage, onEdit, onFlash,
}: {
  movements: StockMovementRow[];
  canManage: boolean;
  onEdit: (m: StockMovementRow) => void;
  onFlash: (m: string) => void;
}) {
  const [kind, setKind] = useState<'ALL' | Kind>('ALL');
  const shown = kind === 'ALL' ? movements : movements.filter((m) => m.kind === kind);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-auto" aria-label="Filter movements">
          <option value="ALL">All movements</option>
          {KIND_LIST.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
        </Select>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No movements yet"
            sub="Every purchase, issue, return and breakage you record shows up here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableScroll>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-left">
                  <Th>Date</Th>
                  <Th>Item</Th>
                  <Th>Movement</Th>
                  <Th right>Qty</Th>
                  <Th>Event</Th>
                  <Th>Note</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => {
                  const meta = KINDS[m.kind];
                  return (
                    <tr key={m.id} className="border-b border-[rgb(var(--border)/0.5)] last:border-0">
                      <td className="whitespace-nowrap px-3 py-2.5 text-[rgb(var(--text-muted))]">{fmtDate(m.movedOn)}</td>
                      <td className="px-3 py-2.5 text-[rgb(var(--text))]">{m.itemName}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {m.source === 'BOOKING' && (
                            <span title="Created by a booking's services — edit it there" className="text-[rgb(var(--text-dim))]">
                              <Lock className="h-3 w-3" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={cn('tnum px-3 py-2.5 text-right font-medium', m.signedQty < 0 ? 'text-negative' : 'text-positive')}>
                        {m.signedQty > 0 ? '+' : ''}{fmtQty(m.signedQty)} <span className="text-[rgb(var(--text-dim))]">{m.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[rgb(var(--text-dim))]">
                        {m.slipNo ? <span className="whitespace-nowrap">{m.slipNo}<span className="block text-xs">{m.partyName}</span></span> : '—'}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-[rgb(var(--text-dim))]" title={m.note ?? ''}>
                        {m.note || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {canManage && (
                          m.source === 'BOOKING' ? (
                            // Owned by the booking: editing the services rewrites
                            // these rows, so any change made here would be lost.
                            <div className="text-right text-xs text-[rgb(var(--text-dim))]">
                              {m.bookingId ? <a href={`/app/bookings/${m.bookingId}`} className="hover:text-brand">Edit on booking</a> : 'From booking'}
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <IconBtn label="Edit movement" onClick={() => onEdit(m)}><Pencil className="h-4 w-4" /></IconBtn>
                              <DeleteMovement movement={m} onFlash={onFlash} />
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}
    </div>
  );
}

function DeleteMovement({ movement, onFlash }: { movement: StockMovementRow; onFlash: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <IconBtn label="Delete movement" onClick={() => setOpen(true)} tone="negative"><Trash2 className="h-4 w-4" /></IconBtn>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete this movement?">
        <p className="text-sm leading-relaxed text-[rgb(var(--text-muted))]">
          {KINDS[movement.kind].label} of {fmtQty(movement.qty)} {movement.unit} — {movement.itemName}, {fmtDate(movement.movedOn)}.
          Deleting it recalculates the item&apos;s on-hand figure straight away.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await deleteStockMovement(movement.id);
              if (r.ok) { onFlash(r.message ?? 'Deleted.'); location.reload(); }
            })}
          >
            {pending ? 'Deleting…' : 'Delete movement'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function MovementModal({
  movement, presetItem, presetKind, items, bookings, onClose, onDone,
}: {
  movement: StockMovementRow | null;
  presetItem?: StockItemRow;
  presetKind?: Kind;
  items: StockItemRow[];
  bookings: BookingOption[];
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [itemId, setItemId] = useState(String(movement?.itemId ?? presetItem?.id ?? ''));
  const [kind, setKind] = useState<Kind>(movement?.kind ?? presetKind ?? 'PURCHASE');
  const [qty, setQty] = useState(movement ? String(movement.qty) : '');
  const [unitCost, setUnitCost] = useState(movement?.unitCost != null ? String(movement.unitCost) : '');
  const [bookingId, setBookingId] = useState(String(movement?.bookingId ?? ''));
  const [movedOn, setMovedOn] = useState(movement?.movedOn?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(movement?.note ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const selected = items.find((i) => String(i.id) === itemId) ?? null;
  const meta = KINDS[kind];
  const qtyNum = Number(qty) || 0;
  const projected = selected ? selected.onHand + (meta.dir === 'in' ? qtyNum : meta.dir === 'both' ? qtyNum : -qtyNum) : null;

  return (
    <Modal open onClose={onClose} title={movement ? 'Edit movement' : 'Record a stock movement'} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item">
            <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Select an item…</option>
              {items.filter((i) => i.active || String(i.id) === itemId).map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.name} — {fmtQty(i.onHand)} {i.unit} on hand
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Movement" hint={meta.help}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KIND_LIST.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={`Quantity${selected ? ` (${selected.unit})` : ''}`}
            hint={kind === 'ADJUSTMENT' ? 'Negative allowed — e.g. -12 to write stock down' : undefined}
          >
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </Field>
          {kind === 'PURCHASE' ? (
            <Field label="Unit cost (Rs.)" hint="Updates the item's value">
              <Input inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0" />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label="Date">
            <Input type="date" value={movedOn} onChange={(e) => setMovedOn(e.target.value)} />
          </Field>
        </div>

        <Field label="Event (optional)" hint="Links this movement to a booking, so you can see what each event consumed or broke.">
          <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="">Not tied to an event</option>
            {bookings.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.slipNo} — {b.partyName} ({fmtDate(b.eventDate)})</option>
            ))}
          </Select>
        </Field>

        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 12 plates chipped during service" />
        </Field>

        {/* Shows the resulting balance before saving — the difference between
            "record 200" and "record 200 and go negative". */}
        {selected && qtyNum !== 0 && (
          <div className={cn(
            'flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm',
            projected != null && projected < 0
              ? 'border-negative/30 bg-negative/8 text-negative'
              : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--text-muted))]',
          )}>
            <span>{selected.name} after this movement</span>
            <span className="tnum font-semibold">
              {fmtQty(selected.onHand)} → {fmtQty(projected ?? 0)} {selected.unit}
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => start(async () => {
              setError('');
              const payload = {
                itemId: Number(itemId) || 0,
                kind,
                qty: Number(qty) || 0,
                unitCost: unitCost === '' ? null : Number(unitCost),
                bookingId: bookingId ? Number(bookingId) : null,
                movedOn,
                note: note || null,
              };
              const r = movement ? await updateStockMovement(movement.id, payload) : await createStockMovement(payload);
              if (r.ok) onDone(r.message ?? 'Saved.'); else setError(r.error);
            })}
          >
            {pending ? 'Saving…' : movement ? 'Save changes' : 'Record movement'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Read-only stock card for one item. */
function LedgerModal({ item, movements, onClose }: { item: StockItemRow; movements: StockMovementRow[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={item.name} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniFact label="On hand" value={`${fmtQty(item.onHand)} ${item.unit}`} />
        <MiniFact label="Promised out" value={fmtQty(item.committed)} />
        <MiniFact label="Purchased" value={fmtQty(item.purchased)} />
        <MiniFact label="Broken / lost" value={fmtQty(item.brokenLost)} tone={item.brokenLost > 0 ? 'negative' : undefined} />
      </div>

      <div className="mt-5 max-h-[45vh] overflow-y-auto rounded-xl border border-[rgb(var(--border))]">
        {movements.length === 0 ? (
          <EmptyState icon={<Layers className="h-6 w-6" />} title="No movements recorded" sub="This item is still at its opening quantity." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-left">
                <Th>Date</Th><Th>Movement</Th><Th right>Qty</Th><Th>Event</Th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-[rgb(var(--border)/0.5)] last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-[rgb(var(--text-muted))]">{fmtDate(m.movedOn)}</td>
                  <td className="px-3 py-2"><Badge tone={KINDS[m.kind].tone}>{KINDS[m.kind].label}</Badge></td>
                  <td className={cn('tnum px-3 py-2 text-right', m.signedQty < 0 ? 'text-negative' : 'text-positive')}>
                    {m.signedQty > 0 ? '+' : ''}{fmtQty(m.signedQty)}
                  </td>
                  <td className="px-3 py-2 text-[rgb(var(--text-dim))]">{m.slipNo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="solid" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════════════════

function CategoriesTab({
  categories, canManage, onFlash,
}: {
  categories: Category[];
  canManage: boolean;
  onFlash: (m: string) => void;
}) {
  const [modal, setModal] = useState<null | { cat: Category | null }>(null);

  return (
    <div className="space-y-4">
      {canManage && (
        <Button variant="solid" onClick={() => setModal({ cat: null })}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      )}

      {categories.length === 0 ? (
        <Card><EmptyState icon={<Tags className="h-6 w-6" />} title="No categories" sub="Add one to group your stock items." /></Card>
      ) : (
        <Card className="divide-y divide-[rgb(var(--border)/0.6)]">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium text-[rgb(var(--text))]">{c.name}</div>
                <div className="text-xs text-[rgb(var(--text-dim))]">
                  {c.itemCount} item{c.itemCount === 1 ? '' : 's'}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <IconBtn label={`Edit ${c.name}`} onClick={() => setModal({ cat: c })}><Pencil className="h-4 w-4" /></IconBtn>
                  <DeleteCategory cat={c} onFlash={onFlash} />
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {modal && (
        <CategoryModal
          cat={modal.cat}
          onClose={() => setModal(null)}
          onDone={(m) => { setModal(null); onFlash(m); location.reload(); }}
        />
      )}
    </div>
  );
}

function DeleteCategory({ cat, onFlash }: { cat: Category; onFlash: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <IconBtn label={`Delete ${cat.name}`} onClick={() => setOpen(true)} tone="negative"><Trash2 className="h-4 w-4" /></IconBtn>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${cat.name}?`}>
        <p className="text-sm leading-relaxed text-[rgb(var(--text-muted))]">
          {cat.itemCount > 0
            ? `A category is only a grouping, so its ${cat.itemCount} item(s) are kept — they simply become uncategorised and you can reassign them.`
            : 'This category is empty and will be removed.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await deleteStockCategory(cat.id);
              if (r.ok) { onFlash(r.message ?? 'Deleted.'); location.reload(); }
            })}
          >
            {pending ? 'Deleting…' : 'Delete category'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function CategoryModal({ cat, onClose, onDone }: { cat: Category | null; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(cat?.sortOrder ?? ''));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <Modal open onClose={onClose} title={cat ? `Edit ${cat.name}` : 'New category'}>
      <div className="space-y-4">
        <Field label="Category name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crockery" />
        </Field>
        <Field label="Sort order" hint="Lower numbers appear first">
          <Input inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="99" />
        </Field>
        {error && (
          <div role="alert" className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => start(async () => {
              setError('');
              const payload = { name, sortOrder: sortOrder === '' ? undefined : Number(sortOrder) };
              const r = cat ? await updateStockCategory(cat.id, payload) : await createStockCategory(payload);
              if (r.ok) onDone(r.message ?? 'Saved.'); else setError(r.error);
            })}
          >
            {pending ? 'Saving…' : cat ? 'Save changes' : 'Add category'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// Small shared bits
// ═══════════════════════════════════════════════════════════════

/** Quantities are DECIMAL, but almost everything here is whole units. */
function fmtQty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn('px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-dim))]', right && 'text-right')}>
      {children}
    </th>
  );
}

function IconBtn({
  children, label, onClick, tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'negative';
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'cursor-pointer rounded-lg p-2 transition-colors',
        tone === 'negative'
          ? 'text-[rgb(var(--text-dim))] hover:bg-negative/10 hover:text-negative'
          : 'text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-3))] hover:text-brand',
      )}
    >
      {children}
    </button>
  );
}

/** Compact stat used inside the per-item ledger. */
function MiniFact({ label, value, tone }: { label: string; value: string; tone?: 'negative' }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)/0.6)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
      <div className={cn('tnum mt-1 font-display text-lg', tone === 'negative' ? 'text-negative' : 'text-[rgb(var(--text))]')}>
        {value}
      </div>
    </div>
  );
}

function Tile({
  icon, label, value, sub, tone = 'plain',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'plain' | 'warn' | 'negative';
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[rgb(var(--text-dim))]">
        <span className={cn(tone === 'warn' ? 'text-warn' : tone === 'negative' ? 'text-negative' : 'text-brand')}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        'tnum mt-2 font-display text-2xl',
        tone === 'warn' ? 'text-warn' : tone === 'negative' ? 'text-negative' : 'text-[rgb(var(--text))]',
      )}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-[rgb(var(--text-dim))]">{sub}</div>}
    </Card>
  );
}

/**
 * What stock has earned, per item.
 *
 * The Items tab values what is ON THE SHELF (quantity times cost). This values
 * what has LEFT it: the margin between the cost of an item and the rate it was
 * billed at on a booking. A crate costing 1,050 billed at 1,600 earned 550.
 *
 * Only items actually sold on through a booking appear. Stock that has never
 * been put on a booking line has earned nothing and would only be noise here.
 */
function ProfitTab({ profit }: { profit: StockProfit }) {
  if (profit.rows.length === 0) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="Nothing sold on yet"
          sub="Add a stock item as a service line on a booking, with the rate you charge. The margin against its unit cost shows up here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {([
          ['Billed to customers', profit.revenue, 'text-[rgb(var(--text))]'],
          ['What it cost you', profit.cost, 'text-[rgb(var(--text))]'],
          ['Profit earned', profit.profit, profit.profit >= 0 ? 'text-positive' : 'text-negative'],
        ] as const).map(([label, value, tone]) => (
          <Card key={label} className="p-5">
            <div className="text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</div>
            <div className={`mt-1 font-display text-2xl tnum ${tone}`}>{fmtMoney(value)}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <TableScroll>
          <table className="w-full text-sm">
            <thead className="border-b border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface-2))] text-left text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 text-right font-medium">Events</th>
                <th className="px-4 py-2.5 text-right font-medium">Qty sold</th>
                <th className="px-4 py-2.5 text-right font-medium">Billed</th>
                <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                <th className="px-4 py-2.5 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {profit.rows.map((r) => (
                <tr key={r.name} className="border-b border-[rgb(var(--border)/0.2)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.4)]">
                  <td className="px-4 py-2.5 text-[rgb(var(--text))]">{r.name}</td>
                  <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text-dim))]">{r.events}</td>
                  <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text-muted))]">{r.qty}</td>
                  <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(r.revenue, false)}</td>
                  <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text-muted))]">{fmtMoney(r.cost, false)}</td>
                  <td className={`px-4 py-2.5 text-right tnum ${r.profit >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {fmtMoney(r.profit, false)}
                  </td>
                </tr>
              ))}
              <tr className="bg-[rgb(var(--surface-2)/0.5)] font-medium">
                <td className="px-4 py-2.5" colSpan={3}>TOTAL</td>
                <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(profit.revenue, false)}</td>
                <td className="px-4 py-2.5 text-right tnum text-[rgb(var(--text))]">{fmtMoney(profit.cost, false)}</td>
                <td className={`px-4 py-2.5 text-right tnum ${profit.profit >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {fmtMoney(profit.profit, false)}
                </td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <p className="text-xs text-[rgb(var(--text-dim))]">
        Profit is the rate billed on a booking less what the item cost, using the cost recorded when the goods
        were issued. A later change to an item&apos;s cost does not rewrite what past events earned.
      </p>
    </div>
  );
}
