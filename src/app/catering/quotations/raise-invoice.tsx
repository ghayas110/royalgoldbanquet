'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { createInvoiceFromQuotation } from '@/lib/actions/catering';
import { FileCheck2 } from 'lucide-react';

/**
 * Turns a quotation into an invoice.
 *
 * The invoice is a new record with its own copy of the lines, so the quotation
 * stays as the record of what was originally promised and the invoice can be
 * adjusted to what was actually served.
 */
export function RaiseInvoice({ quotationId }: { quotationId: number }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setError('');
          start(async () => {
            const res = await createInvoiceFromQuotation(quotationId);
            if (res.ok && res.id) router.push(`/catering/quotations/${res.id}`);
            else if (!res.ok) setError(res.error);
          });
        }}
      >
        <FileCheck2 className="mr-1.5 h-4 w-4" />
        {pending ? 'Raising…' : 'Raise invoice'}
      </Button>
      {error && <span className="max-w-[16rem] text-right text-xs text-negative">{error}</span>}
    </div>
  );
}
