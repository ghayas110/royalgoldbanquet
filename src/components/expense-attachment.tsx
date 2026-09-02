'use client';

import { useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, ImageIcon, Video, X, Trash2, Loader2 } from 'lucide-react';
import { attachToPettyEntry, detachFromPettyEntry } from '@/lib/actions/petty-cash';

/**
 * The photo of the thing the money was spent on.
 *
 * Sits on the expense line itself rather than behind a separate screen: the
 * moment to file the picture is the moment the amount is typed, and anything
 * that takes a second click tends not to happen.
 *
 * `capture="environment"` opens the rear camera directly on a phone, which is
 * the actual workflow here: buy the item, photograph it, record the expense.
 */
export function ExpenseAttachment({
  entryId, attachment, attachmentKind, editable, label, onChange,
}: {
  entryId: number | null;
  attachment: string | null;
  attachmentKind: 'IMAGE' | 'VIDEO' | null;
  editable: boolean;
  /** Names the expense in the viewer and for screen readers. */
  label: string;
  onChange: (next: { attachment: string | null; attachmentKind: 'IMAGE' | 'VIDEO' | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(false);

  const src = attachment ? `/api/attachments/${attachment}` : null;

  function upload(file: File) {
    if (!entryId) { setError('Enter the amount first, then attach.'); return; }
    setError('');
    const form = new FormData();
    form.append('file', file);
    start(async () => {
      const res = await attachToPettyEntry(entryId, form);
      if (res.ok && res.attachment) {
        onChange({ attachment: res.attachment, attachmentKind: res.attachmentKind ?? 'IMAGE' });
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  function detach() {
    if (!entryId) return;
    start(async () => {
      const res = await detachFromPettyEntry(entryId);
      if (res.ok) onChange({ attachment: null, attachmentKind: null });
      else setError(res.error);
    });
  }

  if (!attachment) {
    if (!editable) return <span className="text-[rgb(var(--text-dim))]">—</span>;
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          title={entryId ? 'Attach a photo or video' : 'Enter the amount first'}
          aria-label={`Attach a photo or video to ${label}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--text-dim))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-gold disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        </button>
        {error && <span className="ml-1 text-[10px] text-negative">{error}</span>}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setViewing(true)}
        aria-label={`View the attachment on ${label}`}
        className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-gold transition-colors hover:bg-[rgb(var(--surface-2))]"
      >
        {attachmentKind === 'VIDEO' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
      </button>

      {viewing && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Attachment on ${label}`}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(11,11,13,0.9)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewing(false); }}
        >
          <div className="w-full max-w-lg">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-sm text-ivory/80">{label}</span>
              <button type="button" onClick={() => setViewing(false)} aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ivory hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Plain <img>, not next/image, for two reasons. The dimensions are
                unknown (whatever the phone shot), and the source is behind the
                session: next/image would have the server fetch that URL without
                the viewer's cookie, get a redirect to the login page, and render
                broken. */}
            {attachmentKind === 'VIDEO'
              ? <video src={src!} controls playsInline preload="metadata" className="w-full rounded-xl bg-black" />
              /* eslint-disable-next-line @next/next/no-img-element */
              : <img src={src!} alt={`Attachment on ${label}`} loading="lazy" decoding="async" className="w-full rounded-xl bg-black object-contain" />}

            {editable && (
              <button
                type="button"
                disabled={pending}
                onClick={() => { detach(); setViewing(false); }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-negative/40 px-4 py-2 text-sm text-negative transition-colors hover:bg-negative/10"
              >
                <Trash2 className="h-4 w-4" /> Remove attachment
              </button>
            )}
            {error && <div className="mt-2 text-sm text-negative">{error}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
