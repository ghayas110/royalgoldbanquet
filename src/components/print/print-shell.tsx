'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, ArrowLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

/**
 * Standalone print document frame: a neutral backdrop with a centered A4 sheet
 * and a (non-printing) toolbar. Only the sheet prints.
 */
export function PrintShell({ children, backHref, autoPrint = false }: { children: React.ReactNode; backHref: string; autoPrint?: boolean }) {
  const router = useRouter();
  // On-screen preview zoom only — printing always uses 100%.
  const [zoom, setZoom] = useState(100);

  /**
   * Sheet height has to differ by browser, so tag the root for CSS.
   *
   * Verified by rendering real PDFs through headless Chrome: with
   * `@page { margin: 0 }` Chrome gives the FULL 297mm page, so a 297mm sheet
   * puts the footer flush on the paper edge and still prints 2 pages.
   * Safari ignores that and enforces the generic printer's ~12.7mm margins, so
   * anything over ~271mm spills the footer onto a blank page (the 4-page bug).
   * One height cannot satisfy both, and CSS cannot query the printable area.
   */
  useEffect(() => {
    const ua = navigator.userAgent;
    const isSafari = /^((?!chrome|chromium|crios|android|fxios|edg).)*safari/i.test(ua);
    document.documentElement.classList.toggle('rgb-safari', isSafari);
  }, []);

  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <div className="rgb-backdrop grain">
      <div className="rgb-toolbar">
        <button className="rgb-btn rgb-btn-ghost" onClick={() => router.push(backHref)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="rgb-zoom">
          <button className="rgb-btn rgb-btn-ghost" onClick={() => setZoom((z) => Math.max(40, z - 10))} aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="rgb-zoom-val" aria-live="polite">{zoom}%</span>
          <button className="rgb-btn rgb-btn-ghost" onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="rgb-btn rgb-btn-ghost" onClick={() => setZoom(100)} aria-label="Reset zoom" title="Reset zoom">
            <RotateCcw size={14} />
          </button>
          <button className="rgb-btn rgb-btn-gold" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>
      {/* Zoom scales the on-screen preview only. `--rgb-zoom` is ignored inside
          @media print, so the printed sheet is always full size. */}
      <div className="rgb-zoom-wrap" style={{ ['--rgb-zoom' as string]: String(zoom / 100) }}>
        {children}
      </div>
    </div>
  );
}
