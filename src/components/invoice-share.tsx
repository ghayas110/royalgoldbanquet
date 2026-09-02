'use client';

import { useState, useEffect } from 'react';
import { buildInvoicePdf, shareInvoicePdf, invoiceFileName, canShareToWhatsApp } from '@/lib/invoice-pdf';
import { toWaNumber } from '@/lib/whatsapp';
import { MessageCircle, Loader2, Check, AlertCircle, Paperclip, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/format';

/**
 * "Send invoice to WhatsApp" — builds the real invoice PDF and gets it to the
 * guest.
 *
 * No browser can attach a file to WhatsApp on your behalf. On a phone the OS
 * share sheet does it, and the file lands in the chat as a real attachment. On
 * a desktop there is no such mechanism at all, so the PDF is downloaded and
 * the guest's chat is opened for you — the attach itself has to be a manual
 * paperclip, and pretending otherwise would just leave staff staring at a
 * downloaded file wondering what happened.
 */
export function InvoiceShareButton({
  bookingId, slipNo, partyName, phone, className,
  docLabel = 'Invoice',
  printPath,
  label = `Send ${docLabel.toLowerCase()} to WhatsApp`,
}: {
  bookingId: number;
  slipNo: string;
  partyName: string;
  phone: string | null;
  className?: string;
  /** 'Invoice' for a booking, 'Quotation' for an enquiry or catering. Names the file. */
  docLabel?: string;
  /** Print route to rasterise. Defaults to the booking slip. */
  printPath?: string;
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'error'>('idle');
  const [error, setError] = useState('');
  // Resolved after mount: navigator.canShare is not available during SSR.
  const [canShareFiles, setCanShareFiles] = useState<boolean | null>(null);

  useEffect(() => { setCanShareFiles(canShareToWhatsApp()); }, []);

  // Just the chat, no prefilled text — the message was sent separately and a
  // trailing `?text=` only makes the link look broken.
  const waNumber = toWaNumber(phone);
  const chatHref = waNumber ? `https://wa.me/${waNumber}` : null;

  async function run() {
    setState('working');
    setError('');
    try {
      const blob = await buildInvoicePdf(bookingId, printPath);
      setState(await shareInvoicePdf(blob, slipNo, partyName, docLabel));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the invoice PDF.');
      setState('error');
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        onClick={run}
        disabled={state === 'working'}
        className={cn(
          'no-print inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition',
          'bg-[#25D366] text-white hover:opacity-90 disabled:opacity-60',
          className,
        )}
      >
        {state === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        {state === 'working' ? 'Preparing PDF…' : label}
      </button>

      {/* Sets expectations before the click, so a download is never a surprise. */}
      {state === 'idle' && canShareFiles === false && (
        <span className="text-xs text-[rgb(var(--text-dim))]">
          On this computer the PDF downloads, then you attach it. On your phone it attaches itself.
        </span>
      )}

      {state === 'shared' && (
        <span className="inline-flex items-center gap-1.5 text-xs text-positive">
          <Check className="h-3.5 w-3.5" /> Invoice shared.
        </span>
      )}

      {state === 'downloaded' && (
        <div className="max-w-sm rounded-xl border border-[rgb(var(--gold)/0.35)] bg-[rgb(var(--gold)/0.06)] p-3">
          <div className="flex items-start gap-2 text-xs text-[rgb(var(--text-muted))]">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
            <span>
              <strong className="text-[rgb(var(--text))]">{invoiceFileName(slipNo, docLabel)}</strong> saved to your Downloads.
            </span>
          </div>
          <ol className="mt-2 space-y-1 pl-5 text-xs text-[rgb(var(--text-muted))] [list-style:decimal]">
            <li>Open the chat with {partyName}.</li>
            <li>Click the paperclip <Paperclip className="inline h-3 w-3" /> → <strong>Document</strong>.</li>
            <li>Pick {invoiceFileName(slipNo, docLabel)} and send.</li>
          </ol>
          {chatHref && (
            <a
              href={chatHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open chat with {phone}
            </a>
          )}
        </div>
      )}

      {state === 'error' && (
        <span className="inline-flex items-center gap-1.5 text-xs text-negative">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </span>
      )}
    </div>
  );
}
