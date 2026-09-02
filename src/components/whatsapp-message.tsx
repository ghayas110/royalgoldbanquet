'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Card, Button, Textarea } from '@/components/ui';
import { waLink, toWaNumber } from '@/lib/whatsapp';
import { MessageCircle, Copy, Check, Pencil, RotateCcw, PhoneOff } from 'lucide-react';

/**
 * A prefilled WhatsApp message the operator reviews, edits and sends.
 *
 * Shared by the booking slip and the catering quotation so the two cannot
 * drift apart. The message opens in WhatsApp rather than being sent from the
 * server — see src/lib/whatsapp.ts for why — and is editable first, because
 * there is always something to add that a template cannot know.
 */
export function useWhatsAppMessage(template: string, phone: string | null) {
  const [text, setText] = useState(template);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep the draft in step when the record changes underneath (a payment
  // recorded, lines edited) — unless the operator has started editing.
  useEffect(() => { if (!editing) setText(template); }, [template, editing]);

  const dialable = toWaNumber(phone);
  const href = waLink(phone, text);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const preview = (
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[rgb(var(--surface-2))] p-4 font-sans text-sm text-[rgb(var(--text-muted))]">
      {text}
    </pre>
  );

  const editor = (
    <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
  );

  const copyButton = (
    <Button variant="ghost" onClick={copy}>
      {copied ? <><Check className="h-4 w-4 text-positive" /> Copied</> : <><Copy className="h-4 w-4" /> Copy message</>}
    </Button>
  );

  /** `onSent` lets a caller close a dialog as the link opens. */
  const sendButton = (noPhoneLabel: string, onSent?: () => void) => (dialable ? (
    <a href={href!} target="_blank" rel="noopener noreferrer" onClick={onSent}>
      <Button className="bg-[#25D366] text-white hover:opacity-90">
        <MessageCircle className="h-4 w-4" /> Send on WhatsApp
      </Button>
    </a>
  ) : (
    // No usable number: copying is still worth offering, so staff can paste
    // the message into whatever contact they do have.
    <span className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border)/0.6)] px-3 py-2 text-sm text-[rgb(var(--text-dim))]">
      <PhoneOff className="h-4 w-4" /> {noPhoneLabel}
    </span>
  ));

  const editToggle = (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => setEditing((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
      >
        <Pencil className="h-3.5 w-3.5" /> {editing ? 'Done' : 'Edit'}
      </button>
      {text !== template && (
        <button
          onClick={() => setText(template)}
          title="Reset to the standard wording"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      )}
    </div>
  );

  return { text, dialable, editing, preview, editor, copyButton, sendButton, editToggle };
}

/** The standalone panel — a heading, the message, and the send controls. */
export function WhatsAppMessageCard({
  title, subtitle, template, phone, noPhoneLabel, extra,
}: {
  title: string;
  subtitle: ReactNode;
  template: string;
  phone: string | null;
  noPhoneLabel: string;
  /** Rendered under the controls — the invoice-PDF button, typically. */
  extra?: ReactNode;
}) {
  const m = useWhatsAppMessage(template, phone);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg text-gold">
            <MessageCircle className="h-5 w-5" /> {title}
          </h3>
          <p className="mt-0.5 text-sm text-[rgb(var(--text-muted))]">{subtitle}</p>
        </div>
        {m.editToggle}
      </div>

      <div className="mt-4">{m.editing ? m.editor : m.preview}</div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {m.sendButton(noPhoneLabel)}
        {m.copyButton}
      </div>

      {extra && <div className="mt-4 border-t border-[rgb(var(--border)/0.5)] pt-4">{extra}</div>}
    </Card>
  );
}
