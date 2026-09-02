'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, SectionTitle, Button, Field, Input, Textarea, Badge, FadeUp, Modal } from '@/components/ui';
import { setSetting } from '@/lib/actions/misc';
import { addExpenseHead, updateExpenseHead, deleteExpenseHead, restoreExpenseHead } from '@/lib/actions/petty-cash';
import { Check, Plus, Pencil, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

type ExpenseHeadProp = {
  id: number;
  name: string;
  hasQtyNote: boolean;
  active: boolean;
  usageCount: number;
};

export function SettingsClient({ attribution, name, city, enquiryNote, heads }: {
  attribution: string; name: string; city: string; enquiryNote: string;
  heads: ExpenseHeadProp[];
}) {
  const [attr, setAttr] = useState(attribution);
  const [bName, setBName] = useState(name);
  const [bCity, setBCity] = useState(city);
  const [note, setNote] = useState(enquiryNote);
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();

  function save(key: string, value: string, label: string) {
    start(async () => { await setSetting(key, value); setSaved(label); setTimeout(() => setSaved(''), 2500); });
  }

  return (
    <div className="space-y-6">
      <FadeUp><SectionTitle sub="Business configuration">Settings</SectionTitle></FadeUp>
      {saved && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{saved} saved.</div>}

      <FadeUp delay={0.03}>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-gold">Sale attribution</h3>
          <p className="mb-4 text-sm text-[rgb(var(--text-dim))]">Which month a settled booking&apos;s sale is credited to.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['EVENT_MONTH', 'SETTLEMENT_MONTH'] as const).map((opt) => (
              <button key={opt} onClick={() => { setAttr(opt); save('sale_attribution', opt, 'Attribution'); }}
                className={`rounded-xl border p-4 text-left transition-all ${attr === opt ? 'border-[rgb(var(--gold)/0.5)] bg-[rgb(var(--gold)/0.1)]' : 'border-[rgb(var(--border)/0.5)] hover:bg-[rgb(var(--surface-2))]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[rgb(var(--text))]">{opt === 'EVENT_MONTH' ? 'Event month' : 'Settlement month'}</span>
                  {attr === opt && <Check className="h-4 w-4 text-gold" />}
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">{opt === 'EVENT_MONTH' ? 'Credit sale when the event happens (default)' : 'Credit sale when the booking is fully settled'}</div>
              </button>
            ))}
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.06}>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-gold">Branding</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banquet name">
              <div className="flex gap-2"><Input value={bName} onChange={(e) => setBName(e.target.value)} /><Button variant="outline" disabled={pending} onClick={() => save('banquet_name', bName, 'Name')}>Save</Button></div>
            </Field>
            <Field label="City">
              <div className="flex gap-2"><Input value={bCity} onChange={(e) => setBCity(e.target.value)} /><Button variant="outline" disabled={pending} onClick={() => save('banquet_city', bCity, 'City')}>Save</Button></div>
            </Field>
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.09}>
        <Card className="p-5">
          <h3 className="mb-1 font-display text-lg text-gold">Enquiry slip note</h3>
          <p className="mb-4 text-sm text-[rgb(var(--text-dim))]">
            The &ldquo;Please Note&rdquo; block printed on an enquiry slip. One line per
            point — they are numbered automatically when the slip prints.
          </p>
          <Field label="Points">
            <Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" disabled={pending} onClick={() => save('enquiry.note', note, 'Enquiry note')}>
              Save
            </Button>
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.12}>
        <ExpenseHeadsSection heads={heads} />
      </FadeUp>
    </div>
  );
}

function ExpenseHeadsSection({ heads }: { heads: ExpenseHeadProp[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newHeadName, setNewHeadName] = useState('');
  const [newHasQtyNote, setNewHasQtyNote] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editHasQtyNote, setEditHasQtyNote] = useState(false);

  const [confirmDeleteHead, setConfirmDeleteHead] = useState<ExpenseHeadProp | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeHeads = heads.filter((h) => h.active);
  const archivedHeads = heads.filter((h) => !h.active);

  function showFeedback(type: 'success' | 'error', text: string) {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  }

  const handleAdd = () => {
    if (newHeadName.trim().length < 2) return;
    setFeedback(null);
    start(async () => {
      const res = await addExpenseHead(newHeadName, newHasQtyNote);
      if (res.ok) {
        setNewHeadName('');
        setNewHasQtyNote(false);
        showFeedback('success', res.message || `Expense head "${newHeadName.trim()}" added.`);
        router.refresh();
      } else {
        showFeedback('error', res.error || 'Failed to add expense head.');
      }
    });
  };

  const handleSaveEdit = (id: number) => {
    if (editName.trim().length < 2) return;
    setFeedback(null);
    start(async () => {
      const res = await updateExpenseHead(id, editName, editHasQtyNote);
      if (res.ok) {
        setEditingId(null);
        showFeedback('success', `Expense head updated to "${editName.trim()}".`);
        router.refresh();
      } else {
        showFeedback('error', res.error || 'Failed to update expense head.');
      }
    });
  };

  const handleDelete = (h: ExpenseHeadProp) => {
    setFeedback(null);
    start(async () => {
      const res = await deleteExpenseHead(h.id);
      if (res.ok) {
        setConfirmDeleteHead(null);
        showFeedback('success', res.message || `Expense head "${h.name}" updated.`);
        router.refresh();
      } else {
        showFeedback('error', res.error || 'Failed to delete expense head.');
      }
    });
  };

  const handleRestore = (h: ExpenseHeadProp) => {
    setFeedback(null);
    start(async () => {
      const res = await restoreExpenseHead(h.id);
      if (res.ok) {
        showFeedback('success', res.message || `Restored "${h.name}".`);
        router.refresh();
      } else {
        showFeedback('error', res.error || 'Failed to restore expense head.');
      }
    });
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-lg text-gold">Expense heads</h3>
          <p className="text-sm text-[rgb(var(--text-dim))]">Configure petty-cash expense categories and columns.</p>
        </div>
        <Badge tone="gold">{activeHeads.length} Active</Badge>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${feedback.type === 'success' ? 'border-positive/30 bg-positive/10 text-positive' : 'border-negative/30 bg-negative/10 text-negative'}`}>
          {feedback.text}
        </div>
      )}

      {/* Add New Expense Head */}
      <div className="mb-6 rounded-xl border border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface-2)/0.3)] p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-dim))]">Add new expense category</div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={newHeadName}
            onChange={(e) => setNewHeadName(e.target.value)}
            placeholder="Category name (e.g. Electricity, Fuel, Maintenance)"
            className="flex-1 min-w-[220px]"
          />
          <label className="flex items-center gap-2 text-xs text-[rgb(var(--text-muted))] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newHasQtyNote}
              onChange={(e) => setNewHasQtyNote(e.target.checked)}
              className="rounded border-[rgb(var(--border))] accent-gold"
            />
            Require Qty / Detail note
          </label>
          <Button disabled={pending || newHeadName.trim().length < 2} onClick={handleAdd}>
            <Plus className="h-4 w-4" /> Add Head
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Deleting / Archiving */}
      <Modal open={Boolean(confirmDeleteHead)} onClose={() => setConfirmDeleteHead(null)} title="Delete / Archive Expense Head">
        {confirmDeleteHead && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-3.5 text-sm ${confirmDeleteHead.usageCount > 0 ? 'border-[rgb(var(--gold)/0.4)] bg-[rgb(var(--gold)/0.08)] text-[rgb(var(--text-muted))]' : 'border-negative/40 bg-negative/10 text-[rgb(var(--text-muted))]'}`}>
              <div className={`font-semibold mb-1 flex items-center gap-1.5 ${confirmDeleteHead.usageCount > 0 ? 'text-gold' : 'text-negative'}`}>
                <AlertTriangle className="h-4 w-4" /> {confirmDeleteHead.usageCount > 0 ? 'Archive Category' : 'Permanent Delete'}
              </div>
              {confirmDeleteHead.usageCount > 0 ? (
                <>
                  Category <span className="font-bold text-[rgb(var(--text))]">{confirmDeleteHead.name}</span> has <span className="font-bold text-gold">{confirmDeleteHead.usageCount} recorded entries</span>.
                  It will be <span className="font-bold text-[rgb(var(--text))]">safely archived</span> so past financial records remain accurate. You can restore it anytime.
                </>
              ) : (
                <>
                  Category <span className="font-bold text-[rgb(var(--text))]">{confirmDeleteHead.name}</span> has 0 recorded entries. It will be <span className="font-bold text-negative">permanently deleted</span>.
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmDeleteHead(null)}>Cancel</Button>
              <Button variant="danger" disabled={pending} onClick={() => handleDelete(confirmDeleteHead)}>
                {pending ? 'Processing…' : confirmDeleteHead.usageCount > 0 ? 'Yes, Archive Category' : 'Yes, Delete Permanently'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Active Expense Heads List */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-dim))] mb-2">Active Categories</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {activeHeads.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-xl border border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface-2)/0.2)] p-3 text-sm transition-all hover:bg-[rgb(var(--surface-2)/0.5)]">
              {editingId === h.id ? (
                <div className="flex items-center gap-2 w-full">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="py-1 text-xs flex-1"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-[rgb(var(--text-dim))]">
                    <input
                      type="checkbox"
                      checked={editHasQtyNote}
                      onChange={(e) => setEditHasQtyNote(e.target.checked)}
                      className="accent-gold"
                    />
                    Qty
                  </label>
                  <Button className="py-1 px-2 text-xs" disabled={pending || editName.trim().length < 2} onClick={() => handleSaveEdit(h.id)}>
                    Save
                  </Button>
                  <Button variant="ghost" className="py-1 px-2 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[rgb(var(--text))]">{h.name}</span>
                    {h.hasQtyNote && <Badge tone="gold" className="text-[10px] py-0 px-1.5">Qty / Note</Badge>}
                    {h.usageCount > 0 && <span className="text-[11px] text-[rgb(var(--text-dim))] font-mono">({h.usageCount} entries)</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(h.id); setEditName(h.name); setEditHasQtyNote(h.hasQtyNote); }}
                      title="Edit Category"
                      className="rounded p-1.5 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteHead(h)}
                      title="Delete or Archive Category"
                      className="rounded p-1.5 text-[rgb(var(--text-dim))] hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Archived Expense Heads List */}
      {archivedHeads.length > 0 && (
        <div className="mt-6 border-t border-[rgb(var(--border)/0.4)] pt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-dim))]">Archived Categories</div>
            <Badge tone="muted">{archivedHeads.length} Archived</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {archivedHeads.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border border-[rgb(var(--border)/0.3)] bg-[rgb(var(--surface-2)/0.1)] p-3 text-sm opacity-70">
                <div className="flex items-center gap-2">
                  <span className="text-[rgb(var(--text-muted))] line-through">{h.name}</span>
                  {h.usageCount > 0 && <span className="text-[11px] text-[rgb(var(--text-dim))] font-mono">({h.usageCount} entries)</span>}
                </div>
                <button
                  onClick={() => handleRestore(h)}
                  disabled={pending}
                  title="Restore Category"
                  className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
