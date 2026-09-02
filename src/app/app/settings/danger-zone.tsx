'use client';

import { useState, useTransition } from 'react';
import { Card, Button, Input, FadeUp, Modal } from '@/components/ui';
import { deleteAllBookings, deleteAllEnquiries, factoryReset, type DangerResult } from '@/lib/actions/danger';
import { AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Counts = {
  bookings: number; enquiries: number; payments: number; parties: number;
  halls: number; employees: number; pettyCash: number; leads: number;
};

type Op = {
  key: 'enquiries' | 'bookings' | 'reset';
  title: string;
  desc: string;
  removes: string;
  phrase: string;
  icon: React.ReactNode;
  run: (confirm: string) => Promise<DangerResult>;
};

/**
 * Settings → Danger Zone. Rendered only for OWNER (the server page decides),
 * and every action re-checks the role server-side — the hidden UI is a
 * courtesy, not the security boundary.
 */
export function DangerZone({ counts }: { counts: Counts }) {
  const router = useRouter();
  const [open, setOpen] = useState<Op | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pending, start] = useTransition();

  const ops: Op[] = [
    {
      key: 'enquiries',
      title: 'Delete all enquiries',
      desc: 'Removes every enquiry / quotation. Confirmed bookings are untouched.',
      removes: `${counts.enquiries} enquir${counts.enquiries === 1 ? 'y' : 'ies'}`,
      phrase: 'DELETE ENQUIRIES',
      icon: <Trash2 className="h-4 w-4" />,
      run: deleteAllEnquiries,
    },
    {
      key: 'bookings',
      title: 'Delete all bookings',
      desc: 'Removes every confirmed, completed and cancelled booking, with their services and payments. Enquiries are kept.',
      removes: `${counts.bookings} booking${counts.bookings === 1 ? '' : 's'} · ${counts.payments} payment${counts.payments === 1 ? '' : 's'}`,
      phrase: 'DELETE BOOKINGS',
      icon: <Trash2 className="h-4 w-4" />,
      run: deleteAllBookings,
    },
    {
      key: 'reset',
      title: 'Factory reset',
      desc: 'Wipes the entire system back to a fresh install — bookings, enquiries, customers, payments, petty cash, manager float, attendance, loans, salaries, leads, halls, employees, rules, expense categories and settings. Your login accounts are kept so you are not locked out.',
      removes: `everything except users — incl. ${counts.halls} hall${counts.halls === 1 ? '' : 's'}, ${counts.employees} employee${counts.employees === 1 ? '' : 's'}, ${counts.pettyCash} petty-cash entries`,
      phrase: 'FACTORY RESET',
      icon: <RotateCcw className="h-4 w-4" />,
      run: factoryReset,
    },
  ];

  function close() { setOpen(null); setTyped(''); setError(''); }

  return (
    <>
      <FadeUp delay={0.12}>
        <Card className="border border-negative/40 p-5">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-negative" />
            <h3 className="font-display text-lg text-negative">Danger zone</h3>
          </div>
          <p className="mb-4 text-sm text-[rgb(var(--text-dim))]">
            Owner only. These actions are permanent and cannot be undone — there is no
            recycle bin. Take a database backup in cPanel first.
          </p>

          {done && (
            <div className="mb-4 rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{done}</div>
          )}

          <div className="space-y-3">
            {ops.map((op) => (
              <div key={op.key} className="flex flex-col gap-3 rounded-xl border border-[rgb(var(--border)/0.6)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-[rgb(var(--text))]">{op.title}</div>
                  <p className="mt-0.5 text-xs text-[rgb(var(--text-dim))]">{op.desc}</p>
                  <p className="mt-1 text-xs text-negative">Will remove {op.removes}.</p>
                </div>
                <Button variant="danger" className="shrink-0 py-2 text-sm" onClick={() => { setDone(''); setOpen(op); }}>
                  {op.icon} {op.key === 'reset' ? 'Reset' : 'Delete'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </FadeUp>

      {open && (
        <Modal open onClose={close} title={open.title}>
          <div className="space-y-4">
            <div className="rounded-xl border border-negative/40 bg-negative/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
                <div className="text-sm text-[rgb(var(--text-muted))]">
                  <p className="font-medium text-negative">This cannot be undone.</p>
                  <p className="mt-1">{open.desc}</p>
                  <p className="mt-2">Will remove <span className="text-negative">{open.removes}</span>.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-[rgb(var(--text-muted))]">
                Type <span className="select-all font-mono text-negative">{open.phrase}</span> to confirm
              </label>
              <Input
                value={typed}
                onChange={(e) => { setTyped(e.target.value); setError(''); }}
                placeholder={open.phrase}
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button
                variant="danger"
                disabled={pending || typed !== open.phrase}
                onClick={() => start(async () => {
                  const res = await open.run(typed);
                  if (res.ok) { setDone(res.message); close(); router.refresh(); }
                  else setError(res.error);
                })}
              >
                {pending ? 'Working…' : open.key === 'reset' ? 'Factory reset' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
