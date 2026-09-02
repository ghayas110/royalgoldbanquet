'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button, FadeUp, Modal } from '@/components/ui';
import { InvoiceShareButton } from '@/components/invoice-share';
import { useWhatsAppMessage, WhatsAppMessageCard } from '@/components/whatsapp-message';
import { bookingConfirmationText, type BookingForMessage } from '@/lib/whatsapp';
import type { BrandInfo } from '@/lib/brand-info';
import { PartyPopper } from 'lucide-react';

/**
 * Sends the guest their booking confirmation on WhatsApp.
 *
 * The message opens in WhatsApp prefilled rather than being sent from the
 * server — see src/lib/whatsapp.ts for why. Because that costs a human tap,
 * the tap has to be impossible to miss: saving a booking lands here with
 * `?created=1` and this opens as a dialog straight away. The same panel stays
 * on the page afterwards for re-sending.
 *
 * The text and the invoice PDF are two separate sends: a `wa.me` link cannot
 * carry a file, so the PDF goes through the OS share sheet instead — see
 * src/lib/invoice-pdf.ts.
 */
export function BookingWhatsAppCard({
  booking, brand,
}: {
  booking: BookingForMessage & { bookingId: number; phone: string | null };
  brand: BrandInfo;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const template = useMemo(() => bookingConfirmationText(booking, brand), [booking, brand]);
  const [promptOpen, setPromptOpen] = useState(false);

  // The preview, editor and send controls are shared with the catering
  // quotation so the two cannot drift apart.
  const m = useWhatsAppMessage(template, booking.phone);

  // Open once on arrival from the new-booking form, then drop the flag from
  // the URL so a refresh or a back-navigation doesn't reopen it.
  useEffect(() => {
    if (params.get('created') !== '1') return;
    setPromptOpen(true);
    router.replace(pathname, { scroll: false });
  }, [params, router, pathname]);

  return (
    <>
      {/* ── The moment it matters: straight after saving ── */}
      <Modal open={promptOpen} onClose={() => setPromptOpen(false)} title="Booking confirmed" wide>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-[rgb(var(--gold)/0.35)] bg-[rgb(var(--gold)/0.06)] p-4">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div className="text-sm text-[rgb(var(--text-muted))]">
              <strong className="text-[rgb(var(--text))]">{booking.slipNo}</strong> saved for{' '}
              <strong className="text-[rgb(var(--text))]">{booking.partyName}</strong>.
              {m.dialable
                ? <> Send the confirmation, and the invoice PDF, on WhatsApp.</>
                : <> There is no phone number on this booking, so copy the message and send it however you can.</>}
            </div>
          </div>

          {m.preview}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setPromptOpen(false)}>Not now</Button>
            <div className="flex flex-wrap items-center gap-2">
              {m.copyButton}
              {m.sendButton('No phone number on this booking', () => setPromptOpen(false))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[rgb(var(--border)/0.5)] pt-4">
            <InvoiceShareButton
              bookingId={booking.bookingId}
              slipNo={booking.slipNo}
              partyName={booking.partyName}
              phone={booking.phone}
              label="Send invoice PDF"
            />
            <span className="text-xs text-[rgb(var(--text-dim))]">
              Attaches the invoice as a real PDF through your phone&apos;s share sheet.
            </span>
          </div>
        </div>
      </Modal>

      {/* ── Still on the page, for re-sending later ── */}
      <FadeUp delay={0.08}>
        <WhatsAppMessageCard
          title="Send confirmation on WhatsApp"
          subtitle={<>Opens WhatsApp with the confirmation ready to send.{booking.phone ? <span className="ml-1 text-[rgb(var(--text-dim))]">To {booking.phone}.</span> : null}</>}
          template={template}
          phone={booking.phone}
          noPhoneLabel="No phone number on this booking"
        />
      </FadeUp>
    </>
  );
}
