'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';

/**
 * Standalone print document frame: a neutral backdrop with a centered A4 sheet
 * and a (non-printing) toolbar. Only the sheet prints.
 */
export function PrintShell({ children, backHref, autoPrint = false }: { children: React.ReactNode; backHref: string; autoPrint?: boolean }) {
  const router = useRouter();

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
        <button className="rgb-btn rgb-btn-gold" onClick={() => window.print()}>
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>
      {children}
    </div>
  );
}
