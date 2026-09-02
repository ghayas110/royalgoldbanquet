'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card, SectionTitle, Button, Field, Input, Textarea,
} from '@/components/ui';
import { DateInput } from '@/components/date-input';
import { SearchSelect } from '@/components/search-select';
import { fmtMoney } from '@/lib/format';
import { saveCateringQuotation, saveCateringTemplate } from '@/lib/actions/catering';
import {
  CATERING_STATUS_META, UNIT_META, unitsFor, cateringLineAmount,
  type CateringCategoryRow, type CateringLineRow, type CateringMeatTypeRow, type CateringMenuItemRow,
  type CateringQuotationRow, type CateringSection, type CateringStatus, type CateringTemplateRow,
  type CateringUnit,
} from '@/lib/types';
import { Plus, X, ArrowLeft, Save } from 'lucide-react';

type Line = {
  key: string;
  section: CateringSection;
  menuItemId: number | null;
  description: string;
  category: string;
  categoryId: number | null;
  meatTypeId: number | null;
  /** Set on a MEAT line that was generated from a dish line's key. Cleared the
   *  moment someone edits it by hand — apart from the fields in `OPERATOR_OWNED`,
   *  which are theirs to fill in — so manual changes are never overwritten. */
  autoFor?: string | null;
  qty: string;
  unit: CateringUnit;
  rate: string;
  amount: string;
};

/**
 * Fields a generated meat line leaves to the operator. How much raw meat a dish
 * eats is a kitchen judgement, not the dish's sold weight, so the quantity — and
 * the unit it is counted in — are typed by hand and never derived or overwritten.
 */
const OPERATOR_OWNED: (keyof Line)[] = ['qty', 'unit'];

/**
 * Everything typed into the form, as one object.
 *
 * Held in sessionStorage so walking off to Menu & Rates to check a price and
 * coming back does not throw the form away. sessionStorage rather than
 * localStorage on purpose: a draft should survive navigation, not reappear
 * weeks later on a different day's work.
 */
type Draft = {
  customerId: string; customerName: string; contactNo: string; placeOfFunction: string;
  quotationDate: string; deliveryDate: string; persons: string;
  status: CateringStatus; advance: string; note: string; lines: Line[];
  /** Auto meat lines the operator has removed. See `dismissKey`. */
  dismissed: string[];
  /** Epoch millis. Stale drafts are ignored; see `readDraft`. */
  savedAt: number;
};

/**
 * How long an unsaved draft is worth keeping.
 *
 * The point of the draft is to survive walking off to Menu & Rates and back,
 * not to resurrect a quotation abandoned yesterday. Restoring one of those
 * into a fresh form is worse than losing it: the operator believes they are
 * starting clean and does not notice the stale lines.
 */
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const draftKey = (id?: number) => `catering-draft-${id ?? 'new'}`;

function readDraft(id?: number): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d.savedAt || Date.now() - d.savedAt > DRAFT_MAX_AGE_MS) {
      // Too old to be the work in progress it was meant to protect.
      window.sessionStorage.removeItem(draftKey(id));
      return null;
    }
    return d;
  } catch {
    // A malformed or unreadable draft must never stop the editor opening.
    return null;
  }
}

/**
 * Identifies one generated meat line: which dish row, and which meat.
 *
 * Removing a generated line has to be remembered, or the effect below simply
 * recreates it on the next render and the line appears undeletable.
 */
const dismissKey = (dishKey: string, meatTypeId: number | null) => `${dishKey}:${meatTypeId ?? ''}`;

function clearDraft(id?: number) {
  try { window.sessionStorage.removeItem(draftKey(id)); } catch { /* nothing to do */ }
}

const uid = () => Math.random().toString(36).slice(2);
const todayISO = () => new Date().toISOString().slice(0, 10);
const blank = (section: CateringSection): Line => ({
  key: uid(), section, menuItemId: null, description: '', category: '', categoryId: null,
  meatTypeId: null, autoFor: null, qty: '', unit: 'KG', rate: '', amount: '',
});

/**
 * A CHARGE line is the amount as typed; everything else converts the quantity
 * to the rate's base unit first, so 500 g of a dish rated per kg bills
 * correctly. Shares `cateringLineAmount` with the server action and the slip,
 * so the three can never disagree.
 */
const lineTotal = (l: Line) =>
  l.section === 'CHARGE' ? Number(l.amount) || 0 : cateringLineAmount(Number(l.qty) || 0, l.unit, Number(l.rate) || 0);

/**
 * The line editor, used for both quotations and templates.
 *
 * A template is the same set of lines without the document around it: no
 * customer, no dates, no money taken. Rather than maintain a second editor
 * that would drift out of step over every menu or meat change, this one drops
 * the document fields in template mode and saves to the other action.
 */
export function QuotationEditor({
  quotation, template, mode = 'QUOTATION', presetLines, presetPersons, menu, customers, categories, meatTypes,
}: {
  quotation?: CateringQuotationRow;
  template?: CateringTemplateRow;
  mode?: 'QUOTATION' | 'TEMPLATE';
  /** Lines copied in from a template when starting a fresh quotation. */
  presetLines?: CateringLineRow[];
  presetPersons?: number;
  menu: CateringMenuItemRow[];
  customers: { id: number; name: string; phone: string }[];
  categories: CateringCategoryRow[];
  meatTypes: CateringMeatTypeRow[];
}) {
  const isTemplate = mode === 'TEMPLATE';
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  // Read once, on the first render, so restoring cannot flash the empty form
  // first. `restored` drives the notice that says why the fields are filled.
  const [templateName, setTemplateName] = useState(template?.name ?? '');
  const [templateDesc, setTemplateDesc] = useState(template?.description ?? '');

  const [draft] = useState(() => readDraft(quotation?.id));
  /**
   * Generated meat lines the operator has removed.
   *
   * Without this the effect below recreates them immediately and they read as
   * undeletable. Cleared for a dish when its dish or category changes, since
   * that is a fresh decision about what the dish contains.
   */
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(draft?.dismissed ?? []));
  const [restored, setRestored] = useState(() => draft !== null);

  const [customerId, setCustomerId] = useState(draft?.customerId ?? (quotation?.customerId ? String(quotation.customerId) : ''));
  const [customerName, setCustomerName] = useState(draft?.customerName ?? quotation?.customerName ?? '');
  const [contactNo, setContactNo] = useState(draft?.contactNo ?? quotation?.contactNo ?? '');
  const [placeOfFunction, setPlaceOfFunction] = useState(draft?.placeOfFunction ?? quotation?.placeOfFunction ?? '');
  const [quotationDate, setQuotationDate] = useState(draft?.quotationDate ?? quotation?.quotationDate?.slice(0, 10) ?? todayISO());
  const [deliveryDate, setDeliveryDate] = useState(draft?.deliveryDate ?? quotation?.deliveryDate?.slice(0, 10) ?? '');
  const [persons, setPersons] = useState(
    draft?.persons
    ?? (quotation?.persons ? String(quotation.persons)
      : template?.persons ? String(template.persons)
        : presetPersons ? String(presetPersons) : ''),
  );
  const [status, setStatus] = useState<CateringStatus>(draft?.status ?? quotation?.status ?? 'QUOTATION');
  const [advance, setAdvance] = useState(draft?.advance ?? (quotation?.advanceAmount ? String(quotation.advanceAmount) : ''));
  const [note, setNote] = useState(draft?.note ?? quotation?.note ?? '');

  const [lines, setLines] = useState<Line[]>(() => {
    if (draft?.lines?.length) return draft.lines;
    // `presetLines` arrives when a template is being applied to a new
    // quotation; `template.lines` when the template itself is being edited.
    const existing = quotation?.lines ?? template?.lines ?? presetLines ?? [];
    if (existing.length === 0) return [blank('DISH')];
    return existing.map((l) => ({
      key: `l${l.id}`, section: l.section, menuItemId: l.menuItemId,
      description: l.description, category: l.category, categoryId: l.categoryId,
      meatTypeId: l.meatTypeId, autoFor: null,
      qty: l.qty ? String(l.qty) : '', unit: l.unit,
      rate: l.rate ? String(l.rate) : '', amount: l.amount ? String(l.amount) : '',
    }));
  });

  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => {
      if (l.key !== key) return l;
      // Touching a generated meat line by hand takes it off auto-pilot — except
      // for the fields that were always the operator's to fill in.
      const ownedOnly = Object.keys(patch).every((k) => OPERATOR_OWNED.includes(k as keyof Line));
      const detach = l.autoFor && !ownedOnly && !('autoFor' in patch) ? { autoFor: null } : {};
      return { ...l, ...patch, ...detach };
    }));

  /**
   * Picking a dish fills the description and unit, and — when the dish sells
   * under exactly one category — its category and rate too. With several
   * categories the operator has to choose, because that is what sets the price.
   */
  function pickMenu(key: string, id: number | null) {
    undismissDish(key);
    const m = menu.find((x) => x.id === id);
    if (!m) { setLine(key, { menuItemId: null }); return; }
    const only = m.variants.length === 1 ? m.variants[0] : null;
    setLine(key, {
      menuItemId: m.id,
      description: m.name,
      unit: m.unit,
      categoryId: only ? only.categoryId : null,
      category: only ? only.categoryName : '',
      rate: String(only ? only.rate : m.defaultRate),
    });
  }

  /** Choosing the category re-prices the line from that variant. */
  function pickCategory(key: string, categoryId: number | null) {
    undismissDish(key);
    const l = lines.find((x) => x.key === key);
    const m = menu.find((x) => x.id === l?.menuItemId);
    const v = m?.variants.find((x) => x.categoryId === categoryId);
    const cat = categories.find((c) => c.id === categoryId);
    setLine(key, {
      categoryId,
      category: cat?.name ?? '',
      ...(v ? { rate: String(v.rate) } : {}),
    });
  }

  const menuOptions = menu.map((m) => ({
    value: m.id,
    label: m.name,
    sub: m.variants.length ? m.variants.map((v) => v.categoryName).join(' · ') : `per ${UNIT_META[m.unit].label}`,
    right: m.variants.length === 1 ? fmtMoney(m.variants[0].rate, false) : undefined,
  }));

  /** A dish's own categories when it has them, otherwise every active one. */
  const categoryOptionsFor = (l: Line) => {
    const m = menu.find((x) => x.id === l.menuItemId);
    if (m && m.variants.length > 0) {
      return m.variants.map((v) => ({ value: v.categoryId, label: v.categoryName, right: fmtMoney(v.rate, false) }));
    }
    return categories.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }));
  };

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name, sub: c.phone || undefined }));

  /**
   * Keep a MEAT line in step with every dish that consumes meat.
   *
   * On the client's slip a meat dish is billed twice — the dish above at its
   * making cost, then underneath the raw meat that goes into it. Naming and
   * pricing that second line is pure duplication to type, so it is derived:
   * pick QORMA under CHICKEN and a "CHICKEN FOR QORMA" line appears at the
   * current chicken rate, waiting for a quantity.
   *
   * The quantity is NOT derived. 20 kg of qorma does not mean 20 kg of chicken,
   * so the operator enters how much meat the dish actually takes (see
   * `OPERATOR_OWNED`) and nothing here ever overwrites it.
   *
   * A generated line is tagged `autoFor`. Editing anything else on it by hand
   * clears the tag (see `setLine`), after which it is left alone — the
   * operator's line always wins over the derived one.
   */
  useEffect(() => {
    setLines((ls) => {
      /**
       * Every meat a dish draws on, not just one.
       *
       * A mixed karahi is half chicken and half beef, so it produces TWO meat
       * lines. Each carries the share the variant declares; a single-meat dish
       * is one entry at 100%.
       */
      const meatsOf = (l: Line) => {
        if (l.section !== 'DISH' || !l.menuItemId || !l.categoryId) return [];
        const m = menu.find((x) => x.id === l.menuItemId);
        const v = m?.variants.find((x) => x.categoryId === l.categoryId);
        if (!v) return [];

        const split = v.meats?.length
          ? v.meats
          : v.meatTypeId
            ? [{ meatTypeId: v.meatTypeId, meatName: v.meatTypeName ?? '', meatRate: v.meatRate ?? 0, share: 100 }]
            : [];

        return split
          .map((sm) => {
            const meat = meatTypes.find((t) => t.id === sm.meatTypeId);
            return meat ? { meat, share: sm.share, dishName: m!.name } : null;
          })
          .filter((x): x is { meat: typeof meatTypes[number]; share: number; dishName: string } => x !== null);
      };

      let changed = false;
      const next = [...ls];

      // Drop generated lines whose dish is gone, or whose meat is no longer
      // one of the meats that dish uses. `autoFor` alone is not enough now
      // that one dish can own several meat lines, so the meat type is part of
      // the identity.
      for (let i = next.length - 1; i >= 0; i--) {
        const l = next[i];
        if (!l.autoFor) continue;
        const src = next.find((x) => x.key === l.autoFor);
        const wanted = src ? meatsOf(src) : [];
        if (!wanted.some((w) => w.meat.id === l.meatTypeId)) { next.splice(i, 1); changed = true; }
      }

      // Add or refresh one line per meat, for every dish that uses meat.
      for (const src of ls.filter((l) => l.section === 'DISH')) {
        for (const info of meatsOf(src)) {
          // The share is named on the line when it is not the whole dish, so
          // the slip says WHY it is 10 kg against a 20 kg karahi.
          const suffix = info.share < 100 ? ` (${+info.share.toFixed(2)}%)` : '';
          const desired = {
            description: `${info.meat.name} FOR ${info.dishName}${suffix}`,
            meatTypeId: info.meat.id,
            rate: String(info.meat.rate),
          };
          // Removed by hand: leave it removed. Regenerating here is what made
          // these lines look permanent.
          if (dismissed.has(dismissKey(src.key, info.meat.id))) continue;

          const idx = next.findIndex((x) => x.autoFor === src.key && x.meatTypeId === info.meat.id);
          if (idx === -1) {
            // Empty quantity, counted in the meat's own unit — the rate is
            // quoted per that unit, and the operator fills the number in.
            next.push({
              ...blank('MEAT'), key: uid(), autoFor: src.key,
              categoryId: src.categoryId, category: src.category,
              unit: info.meat.unit, ...desired,
            });
            changed = true;
          } else {
            const cur = next[idx];
            if (cur.description !== desired.description || cur.rate !== desired.rate) {
              next[idx] = { ...cur, ...desired };
              changed = true;
            }
          }
        }
      }
      return changed ? next : ls;
    });
  }, [lines, menu, meatTypes, dismissed]);

  /**
   * Remove a line, and remember the removal when it was a generated one.
   *
   * Used by every delete button, so a meat line the operator takes off the
   * quotation stays off it.
   */
  function removeLine(key: string) {
    // Read from `lines` rather than inside the updater: a state updater must
    // be pure, and React may run it twice in development.
    const gone = lines.find((l) => l.key === key);
    if (gone?.autoFor) {
      const k = dismissKey(gone.autoFor, gone.meatTypeId);
      setDismissed((d) => (d.has(k) ? d : new Set(d).add(k)));
    }
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  /** Take every meat line off the quotation, and keep them off. */
  function clearAllMeat() {
    const keys = lines
      .filter((l) => l.section === 'MEAT' && l.autoFor)
      .map((l) => dismissKey(l.autoFor!, l.meatTypeId));
    if (keys.length) {
      setDismissed((d) => {
        const nextSet = new Set(d);
        keys.forEach((k) => nextSet.add(k));
        return nextSet;
      });
    }
    setLines((ls) => ls.filter((l) => l.section !== 'MEAT'));
  }

  /**
   * Choosing a different dish or category is a fresh decision about what the
   * dish contains, so any earlier removals for that row stop applying.
   */
  function undismissDish(dishKey: string) {
    setDismissed((d) => {
      const nextSet = new Set([...d].filter((k) => !k.startsWith(`${dishKey}:`)));
      return nextSet.size === d.size ? d : nextSet;
    });
  }

  /**
   * Save the draft whenever anything changes.
   *
   * Cheap enough to do on every keystroke: it is one small JSON blob, written
   * synchronously to sessionStorage, and the alternative (debouncing) risks
   * losing the last few characters typed before navigating away.
   */
  useEffect(() => {
    const snapshot: Draft = {
      customerId, customerName, contactNo, placeOfFunction,
      quotationDate, deliveryDate, persons, status, advance, note, lines,
      dismissed: [...dismissed],
      savedAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(draftKey(quotation?.id), JSON.stringify(snapshot));
    } catch {
      // Private browsing and full quotas both throw here. Losing the draft is
      // survivable; breaking the editor is not.
    }
  }, [customerId, customerName, contactNo, placeOfFunction, quotationDate,
    deliveryDate, persons, status, advance, note, lines, dismissed, quotation?.id]);

  /** Throw the draft away and go back to what is actually saved. */
  function discardDraft() {
    clearDraft(quotation?.id);
    setRestored(false);
    router.refresh();
    // A reload is the honest way to get back to the stored record: every field
    // above was seeded from the draft on mount.
    window.location.reload();
  }

  const totals = useMemo(() => {
    const items = lines.filter((l) => l.section !== 'MEAT').reduce((s, l) => s + lineTotal(l), 0);
    const meat = lines.filter((l) => l.section === 'MEAT').reduce((s, l) => s + lineTotal(l), 0);
    return { items, meat, grand: items + meat };
  }, [lines]);

  function submit() {
    setError('');

    if (isTemplate) {
      start(async () => {
        const res = await saveCateringTemplate(template?.id ?? null, {
          name: templateName,
          description: templateDesc,
          persons: Number(persons) || 0,
          note: note || null ? note : '',
          lines: lines
            .filter((l) => l.description.trim())
            .map((l) => ({
              section: l.section, menuItemId: l.menuItemId,
              description: l.description.trim(), category: l.category.trim(),
              categoryId: l.categoryId, meatTypeId: l.meatTypeId,
              qty: Number(l.qty) || 0, unit: l.unit,
              rate: Number(l.rate) || 0, amount: Number(l.amount) || 0,
            })),
        });
        if (res.ok) router.push('/catering/templates');
        else setError(res.error);
      });
      return;
    }

    const payload = {
      customerId: customerId ? Number(customerId) : null,
      customerName, contactNo, placeOfFunction,
      quotationDate, deliveryDate,
      persons: Number(persons) || 0,
      status,
      advanceAmount: Number(advance) || 0,
      note: note || null,
      lines: lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          section: l.section, menuItemId: l.menuItemId,
          description: l.description.trim(), category: l.category.trim(),
          categoryId: l.categoryId,
          meatTypeId: l.meatTypeId,
          qty: Number(l.qty) || 0, unit: l.unit,
          rate: Number(l.rate) || 0, amount: Number(l.amount) || 0,
        })),
    };
    start(async () => {
      const res = await saveCateringQuotation(quotation?.id ?? null, payload);
      if (res.ok) {
        // Saved: the draft has served its purpose and must not shadow the
        // stored record next time this editor opens.
        clearDraft(quotation?.id);
        router.push(`/catering/quotations/${res.id}`);
      } else setError(res.error);
    });
  }

  const sections: { key: CateringSection; title: string; hint: string }[] = [
    { key: 'DISH', title: 'Dishes', hint: 'The numbered items on the slip' },
    { key: 'CHARGE', title: 'Charges', hint: 'Transport, service — an amount with no qty or rate' },
    { key: 'MEAT', title: 'Meat supplied', hint: 'Added automatically for meat dishes. Remove one and it stays removed.' },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub={isTemplate
          ? 'A saved set of lines. Applying it fills a new quotation; the quotation then goes its own way.'
          : quotation ? `Editing ${quotation.quotaNo}`
            : presetLines?.length ? 'Started from a template. Edit anything before saving.'
              : 'The quotation number is issued automatically on save.'}
        right={
          <Link href={isTemplate ? '/catering/templates'
            : quotation ? `/catering/quotations/${quotation.id}` : '/catering/quotations'}>
            <Button variant="ghost"><ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel</Button>
          </Link>
        }
      >
        {isTemplate ? (template ? 'Edit template' : 'New template') : (quotation ? 'Edit quotation' : 'New quotation')}
      </SectionTitle>

      {error && <Card className="border-negative/30 bg-negative/10 p-3 text-sm text-negative">{error}</Card>}

      {restored && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-gold/30 bg-[rgb(var(--gold)/0.08)] p-3">
          <span className="text-sm text-[rgb(var(--text-muted))]">
            Unsaved changes restored. Nothing has been saved yet.
          </span>
          <Button variant="ghost" onClick={discardDraft}>Discard changes</Button>
        </Card>
      )}

      {isTemplate ? (
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name" hint="What you will pick it by, e.g. Mehndi 250 heads">
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Mehndi package — 250" />
            </Field>
            <Field label="Headcount it is costed for" hint="Carried onto the quotation as a starting point">
              <Input type="number" min="0" value={persons} onChange={(e) => setPersons(e.target.value)} placeholder="250" />
            </Field>
            <Field label="Description" hint="A line to tell it apart from similar templates">
              <Input value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} placeholder="Standard mehndi menu with bar b q" />
            </Field>
          </div>
        </Card>
      ) : (
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer" hint="Search a saved customer, or just type a name below">
            <SearchSelect
              options={customerOptions}
              value={customerId ? Number(customerId) : null}
              onChange={(v) => {
                setCustomerId(v === null ? '' : String(v));
                const c = customers.find((x) => x.id === Number(v));
                if (c) { setCustomerName(c.name); setContactNo(c.phone); }
              }}
              placeholder="Search customers…"
              emptyLabel="One-off customer"
            />
          </Field>
          <Field label="Name"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="AZEEM BHAI" /></Field>
          <Field label="Contact no."><Input value={contactNo} onChange={(e) => setContactNo(e.target.value)} placeholder="0300-1234567" /></Field>
          <Field label="Place of function"><Input value={placeOfFunction} onChange={(e) => setPlaceOfFunction(e.target.value)} placeholder="4L Chowrangi" /></Field>
          <Field label="Quotation date"><DateInput value={quotationDate} onChange={setQuotationDate} showDay={false} /></Field>
          <Field label="Event date"><DateInput value={deliveryDate} onChange={setDeliveryDate} showDay={false} /></Field>
          <Field label="Persons"><Input type="number" min="0" value={persons} onChange={(e) => setPersons(e.target.value)} placeholder="250" /></Field>
          <Field label="Status">
            <SearchSelect
              options={(Object.keys(CATERING_STATUS_META) as CateringStatus[]).map((s) => ({ value: s, label: CATERING_STATUS_META[s].label }))}
              value={status}
              onChange={(v) => v && setStatus(v as CateringStatus)}
              placeholder="Search…"
              emptyLabel="Select status…"
            />
          </Field>
          <Field label="Advance agreed" hint="What the customer promised, not what they have paid">
            <Input type="number" min="0" value={advance} onChange={(e) => setAdvance(e.target.value)} />
          </Field>
        </div>
      </Card>
      )}

      {sections.map((sec) => {
        const rows = lines.filter((l) => l.section === sec.key);
        return (
          <Card key={sec.key} className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display text-lg text-[rgb(var(--text))]">{sec.title}</div>
                <div className="text-xs text-[rgb(var(--text-dim))]">{sec.hint}</div>
              </div>
              <div className="flex items-center gap-2">
                {/* Meat lines are generated, so taking them all off needs to be
                    one action rather than deleting rows that reappear. */}
                {sec.key === 'MEAT' && rows.length > 0 && (
                  <Button variant="ghost" onClick={clearAllMeat} title="Take every meat line off this quotation">
                    <X className="mr-1 h-3.5 w-3.5" /> Remove all
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setLines((ls) => [...ls, blank(sec.key)])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgb(var(--border))] px-4 py-6 text-center text-sm text-[rgb(var(--text-dim))]">
                No {sec.title.toLowerCase()} on this quotation.
              </div>
            ) : (
              /* A grid of rows rather than a table: the pickers drop a floating
                 panel, and a scrollable <table> wrapper clipped it off. */
              <div className="space-y-2">
                {rows.map((l) => (
                  <div key={l.key} className="rounded-xl border border-[rgb(var(--border)/0.5)] p-2">
                    {sec.key === 'CHARGE' ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[200px] flex-1">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Description</label>
                          <Input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} placeholder="TRANSPORT" />
                        </div>
                        <div className="w-36">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Amount</label>
                          <Input type="number" min="0" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} className="text-right" />
                        </div>
                        <button onClick={() => removeLine(l.key)} title="Remove line"
                          className="mb-1 rounded-lg p-2 text-[rgb(var(--text-dim))] hover:text-negative">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-12 items-end gap-2">
                        <div className="col-span-12 sm:col-span-3">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Dish</label>
                          <SearchSelect
                            options={menuOptions}
                            value={l.menuItemId}
                            onChange={(v) => pickMenu(l.key, v === null ? null : Number(v))}
                            placeholder="Search dishes…"
                            emptyLabel="Custom item"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-3">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Category</label>
                          <SearchSelect
                            options={categoryOptionsFor(l)}
                            value={l.categoryId}
                            onChange={(v) => pickCategory(l.key, v === null ? null : Number(v))}
                            placeholder="Search categories…"
                            emptyLabel="No category"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-2">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Description</label>
                          <Input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} placeholder="QORMA" />
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Qty</label>
                          <Input type="number" min="0" step="0.01" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Unit</label>
                          {/* Only units measuring the same thing as the rate: a dish
                              priced per kg can be ordered in kg or g. */}
                          <SearchSelect
                            options={unitsFor(UNIT_META[l.unit].base).map((u) => ({ value: u, label: UNIT_META[u].label }))}
                            value={l.unit}
                            onChange={(v) => v && setLine(l.key, { unit: v as CateringUnit })}
                            placeholder="Unit…"
                            emptyLabel="Unit"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Rate</label>
                          <Input type="number" min="0" value={l.rate} onChange={(e) => setLine(l.key, { rate: e.target.value })} />
                        </div>
                        <div className="col-span-11 sm:col-span-1 text-right">
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Amount</label>
                          <span className="tnum inline-block py-2 text-sm text-[rgb(var(--text))]">{fmtMoney(lineTotal(l), false)}</span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button onClick={() => removeLine(l.key)} title="Remove line"
                            className="mb-1 rounded-lg p-2 text-[rgb(var(--text-dim))] hover:text-negative">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      <Card className="p-5">
        <div className="ml-auto max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Dishes &amp; charges</span><span className="tnum">{fmtMoney(totals.items)}</span></div>
          <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Meat supplied</span><span className="tnum">{fmtMoney(totals.meat)}</span></div>
          <div className="flex justify-between border-t border-[rgb(var(--border)/0.5)] pt-1.5 font-medium"><span>Grand total</span><span className="tnum text-gold">{fmtMoney(totals.grand)}</span></div>
        </div>
        <Field label="Note" hint="Prints under the terms on the slip">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={pending}>
            <Save className="mr-1.5 h-4 w-4" />
            {pending ? 'Saving…'
              : isTemplate ? (template ? 'Save template' : 'Create template')
                : quotation ? 'Save changes' : 'Create quotation'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
