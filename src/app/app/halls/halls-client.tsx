'use client';

import { useState, useTransition } from 'react';
import { Card, SectionTitle, Button, Badge, Field, Input, Modal, FadeUp, EmptyState } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
import { createHall, updateHall, deleteHall, restoreHall } from '@/lib/actions/halls';
import { Building2, Plus, Pencil, Trash2, Users, RotateCcw } from 'lucide-react';

type Hall = { id: number; name: string; capacity: number; baseCharge: number; description: string | null; active: boolean; bookingCount: number };

export function HallsClient({ halls }: { halls: Hall[] }) {
  const [modal, setModal] = useState<null | { hall: Hall | null }>(null);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle sub="Create, edit and manage your halls & their base charge" right={<Button onClick={() => setModal({ hall: null })}><Plus className="h-4 w-4" /> New hall</Button>}>
          Halls
        </SectionTitle>
      </FadeUp>
      {msg && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>}

      {halls.length === 0 ? (
        <Card><EmptyState icon={<Building2 className="h-8 w-8" />} title="No halls yet" sub="Add your first hall." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {halls.map((h, i) => (
            <FadeUp key={h.id} delay={0.04 * i}>
              <Card className={`p-5 ${!h.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl text-[rgb(var(--text))]">{h.name}</h3>
                      {!h.active && <Badge tone="muted">Archived</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-[rgb(var(--text-dim))]">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {h.capacity} guests</span>
                      <span>· {h.bookingCount} bookings</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-[rgb(var(--text-dim))]">Hall charge</div>
                    <div className="tnum font-display text-lg text-gold">{fmtMoney(h.baseCharge)}</div>
                  </div>
                </div>
                {h.description && <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">{h.description}</p>}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="py-2 text-sm" onClick={() => setModal({ hall: h })}><Pencil className="h-4 w-4" /> Edit</Button>
                  {h.active
                    ? <DeleteHall hall={h} onDone={flash} />
                    : <Button variant="solid" className="py-2 text-sm" onClick={async () => { await restoreHall(h.id); flash('Hall restored.'); location.reload(); }}><RotateCcw className="h-4 w-4" /> Restore</Button>}
                </div>
              </Card>
            </FadeUp>
          ))}
        </div>
      )}

      {modal && <HallModal hall={modal.hall} onClose={() => setModal(null)} onDone={(m) => { setModal(null); flash(m); location.reload(); }} />}
    </div>
  );
}

function DeleteHall({ hall, onDone }: { hall: Hall; onDone: (m: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const hasBookings = hall.bookingCount > 0;
  return (
    <>
      <Button variant="danger" className="py-2 text-sm" onClick={() => setConfirm(true)}>
        <Trash2 className="h-4 w-4" /> {hasBookings ? 'Archive' : 'Delete'}
      </Button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={hasBookings ? `Archive ${hall.name}?` : `Delete ${hall.name}?`}>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          {hasBookings
            ? `This hall has ${hall.bookingCount} booking(s), so it can't be permanently deleted (that would break booking history). It will be archived — hidden from new bookings and the website — and can be restored anytime.`
            : 'This hall has no bookings and will be permanently deleted. This cannot be undone.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" disabled={pending}
            onClick={() => start(async () => { const r = await deleteHall(hall.id); if (r.ok) { onDone(r.message ?? 'Done.'); location.reload(); } })}>
            {pending ? 'Working…' : hasBookings ? 'Archive hall' : 'Delete permanently'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function HallModal({ hall, onClose, onDone }: { hall: Hall | null; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = useState(hall?.name ?? '');
  const [capacity, setCapacity] = useState(String(hall?.capacity ?? ''));
  const [charge, setCharge] = useState(String(hall?.baseCharge ?? ''));
  const [desc, setDesc] = useState(hall?.description ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <Modal open onClose={onClose} title={hall ? `Edit ${hall.name}` : 'New hall'}>
      <div className="space-y-4">
        <Field label="Hall name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grand Hall" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Capacity (guests)"><Input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="800" /></Field>
          <Field label="Base hall charge (Rs.)" hint="Default hall payment"><Input inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="400000" /></Field>
        </div>
        <Field label="Description">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="A short description shown on the website"
            className="w-full rounded-xl bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.7)] px-3.5 py-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--gold)/0.6)]" />
        </Field>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const payload = { name, capacity: Number(capacity) || 0, baseCharge: Number(charge) || 0, description: desc || null };
            const r = hall ? await updateHall(hall.id, payload) : await createHall(payload);
            if (r.ok) onDone(r.message ?? 'Saved.'); else setError(r.error);
          })}>{pending ? 'Saving…' : hall ? 'Save changes' : 'Create hall'}</Button>
        </div>
      </div>
    </Modal>
  );
}
