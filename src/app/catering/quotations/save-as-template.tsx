'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, Field, Input } from '@/components/ui';
import { createTemplateFromQuotation } from '@/lib/actions/catering';
import { LayoutTemplate } from 'lucide-react';

/**
 * Keep a finished quotation as a reusable template.
 *
 * This is where the time is actually saved. Nobody sits down to author a
 * template from nothing; they build a real quotation, notice they will send
 * something similar again, and keep it.
 */
export function SaveAsTemplate({ quotationId, suggestedName }: { quotationId: number; suggestedName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="ghost" onClick={() => { setName(suggestedName); setError(''); setOpen(true); }}>
        <LayoutTemplate className="mr-1.5 h-4 w-4" /> Save as template
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Save as template">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-negative">{error}</div>}
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Copies this quotation&apos;s lines into a reusable template. The quotation itself is untouched.
          </p>
          <Field label="Template name" hint="What you will pick it by later">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mehndi package — 250" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() => {
                setError('');
                start(async () => {
                  const res = await createTemplateFromQuotation(quotationId, name);
                  if (res.ok) { setOpen(false); router.push('/catering/templates'); }
                  else setError(res.error);
                });
              }}
            >
              {pending ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
