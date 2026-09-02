/**
 * Builds a real PDF of a booking's printed slip, client-side.
 *
 * The slip already exists as a pixel-accurate A4 layout at /print/booking/[id]
 * — recreating that layout in a PDF library would immediately drift from the
 * page staff actually print. So this loads that route in a hidden same-origin
 * iframe, lets it style itself with print.css, and photographs each `.rgb-sheet`
 * into a PDF page.
 *
 * jspdf and html2canvas are ~300KB together and are only needed when someone
 * actually sends an invoice, so both are imported dynamically at call time
 * rather than bundled into the booking page.
 */

/** A4 in millimetres — the sheet size print.css is built around. */
const A4_W = 210;
const A4_H = 297;

/** How long to wait for the print route (fonts, images) before giving up. */
const LOAD_TIMEOUT_MS = 15000;

function loadPrintFrame(src: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    // Off-screen rather than display:none — a hidden iframe has no layout, so
    // html2canvas would measure every sheet as zero-height.
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:900px;height:1400px;border:0;opacity:0;pointer-events:none;';
    frame.src = src;

    const timer = setTimeout(() => {
      frame.remove();
      reject(new Error('The invoice took too long to load.'));
    }, LOAD_TIMEOUT_MS);

    frame.onload = async () => {
      clearTimeout(timer);
      try {
        // Web fonts finish after load; capturing early prints fallback serif.
        // Raced against a timeout: `fonts.ready` can sit unresolved forever
        // (seen when the print route errored and rendered no document), which
        // would leave the button stuck on "Preparing PDF…" with nothing to
        // cancel it.
        await Promise.race([
          frame.contentDocument?.fonts?.ready,
          new Promise((res) => setTimeout(res, 3000)),
        ]);
      } catch {
        /* fonts API unavailable — the small metric shift is acceptable */
      }
      // One more frame so late layout (the zoom transform) has settled.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      resolve(frame);
    };
    frame.onerror = () => {
      clearTimeout(timer);
      frame.remove();
      reject(new Error('Could not open the invoice.'));
    };

    document.body.appendChild(frame);
  });
}

/**
 * Render the slip at `/print/booking/{bookingId}` to a PDF Blob.
 * One PDF page per printed sheet, so the terms page comes along too.
 */
export async function buildInvoicePdf(bookingId: number, printPath?: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // Catering quotations render from their own route, so the caller may name it.
  const frame = await loadPrintFrame(printPath ?? `/print/booking/${bookingId}`);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Could not read the invoice.');

    // The on-screen preview applies a zoom transform; capturing through it
    // would bake the zoom into the PDF.
    const wrap = doc.querySelector<HTMLElement>('.rgb-zoom-wrap');
    if (wrap) wrap.style.transform = 'none';

    const sheets = Array.from(doc.querySelectorAll<HTMLElement>('.rgb-sheet'));
    if (sheets.length === 0) throw new Error('The invoice has nothing to print.');

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    for (let i = 0; i < sheets.length; i++) {
      const canvas = await html2canvas(sheets[i], {
        /**
         * html2canvas renders into a CLONE of the document in its own iframe,
         * and lays text out by measuring each word then drawing it at the
         * measured offset. The app's web fonts are registered with
         * `font-display: optional` (see src/app/layout.tsx), which by design
         * declines to apply a font that is not already available — and in a
         * brand-new clone iframe it never is. So html2canvas measured with
         * Plus Jakarta / Playfair and drew with the fallback, and every
         * inter-word space collapsed: "Party Name" printed as "PartyName".
         *
         * Pinning both font variables to faces that are certain to be present
         * makes measuring and drawing agree. The print CSS already reads these
         * two variables, so nothing else needs to change.
         */
        onclone: (doc: Document) => {
          const root = doc.documentElement;
          root.style.setProperty('--font-sans', '"Helvetica Neue", Helvetica, Arial, sans-serif');
          root.style.setProperty('--font-display', 'Georgia, "Times New Roman", serif');
        },
        // 2x keeps the gold wordmark and the table rules crisp without
        // pushing the file into the tens of megabytes.
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: sheets[i].scrollWidth,
        windowHeight: sheets[i].scrollHeight,
      });

      if (i > 0) pdf.addPage();

      // Fit the sheet to the page INSTEAD of stretching it to A4. The invoice
      // sheet grows with its content — page 1 measures 794x1167 (ratio 1.47)
      // against A4's 1.414 — so forcing 210x297 squashed the whole page
      // vertically. Scale to whichever axis binds first and centre the rest.
      const ratio = canvas.height / canvas.width;
      let w = A4_W;
      let h = A4_W * ratio;
      if (h > A4_H) { h = A4_H; w = A4_H / ratio; }
      const x = (A4_W - w) / 2;
      const y = (A4_H - h) / 2;

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h, undefined, 'FAST');
    }

    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}

/** `Invoice-SKY-2026-01.pdf` / `Quotation-INQ-2026-01.pdf` — what the guest
 *  sees in their chat. */
export function invoiceFileName(slipNo: string, docLabel = 'Invoice'): string {
  return `${docLabel}-${(slipNo || 'booking').replace(/[^\w-]/g, '')}.pdf`;
}

export type ShareOutcome = 'shared' | 'downloaded';

/**
 * Whether the OS share sheet can actually reach WhatsApp on this device.
 *
 * Phones can: WhatsApp registers as a share target on iOS and Android, and the
 * PDF lands in the chat as a real attachment. Desktops cannot — WhatsApp for
 * Mac and Windows register no share extension, so macOS offers AirDrop,
 * Messages, Notes and Freeform and nothing else. Opening that sheet on a
 * laptop just wastes the user's click, so on desktop we download instead and
 * tell them how to attach it.
 */
export function canShareToWhatsApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so touch points are the giveaway.
  const isIOS = /iPhone|iPod|iPad/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  if (!isIOS && !isAndroid) return false;

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  const probe = new File([new Blob([''], { type: 'application/pdf' })], 'probe.pdf', { type: 'application/pdf' });
  return nav.canShare({ files: [probe] });
}

/**
 * Hand the PDF to the OS share sheet where that can reach WhatsApp (phones),
 * and download it everywhere else so the user gets a file they can attach
 * rather than a share sheet WhatsApp is not listed in.
 */
export async function shareInvoicePdf(
  blob: Blob,
  slipNo: string,
  partyName: string,
  docLabel = 'Invoice',
): Promise<ShareOutcome> {
  const file = new File([blob], invoiceFileName(slipNo, docLabel), { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

  if (canShareToWhatsApp()) {
    try {
      await nav.share({ files: [file], title: `${docLabel} ${slipNo}`, text: `${docLabel} for ${partyName}` });
      return 'shared';
    } catch (err) {
      // The user dismissing the share sheet is not a failure worth reporting.
      if ((err as Error)?.name === 'AbortError') return 'shared';
      // Anything else (share unsupported for this type) falls through.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = invoiceFileName(slipNo, docLabel);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
