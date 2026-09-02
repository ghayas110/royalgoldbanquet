'use client';

import { cn } from '@/lib/format';
import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { X } from 'lucide-react';

// ── Card ───────────────────────────────────────────────
export function Card({ className, glass, ...props }: React.HTMLAttributes<HTMLDivElement> & { glass?: boolean }) {
  return (
    <div
      className={cn(
        glass ? 'surface-glass' : 'surface',
        'rounded-2xl shadow-card',
        className,
      )}
      {...props}
    />
  );
}

// ── Section header ─────────────────────────────────────
export function SectionTitle({ children, sub, right, eyebrow }: { children: React.ReactNode; sub?: string; right?: React.ReactNode; eyebrow?: string }) {
  // flex-wrap + a basis on the text column: with two action buttons the
  // shrink-0 block below used to crush the heading to one word per line.
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 flex-1 basis-[18rem]">
        {eyebrow && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/80">{eyebrow}</div>}
        <h2 className="font-display text-xl md:text-2xl text-[rgb(var(--text))]">{children}</h2>
        {sub && <p className="text-sm text-[rgb(var(--text-dim))] mt-0.5">{sub}</p>}
      </div>
      {/* shrink-0 + nowrap: without it the action button gets squeezed on a
          phone and its label wraps onto two lines ("New / user"). */}
      {right && <div className="shrink-0 [&_button]:whitespace-nowrap [&_a]:whitespace-nowrap">{right}</div>}
    </div>
  );
}

// ── Button ─────────────────────────────────────────────
type BtnVariant = 'gold' | 'ghost' | 'outline' | 'danger' | 'solid';
// Solid colors + crisp highlights — no gradients on interactive elements.
const btnStyles: Record<BtnVariant, string> = {
  gold: 'bg-gold text-ink font-semibold ring-1 ring-inset ring-white/15 hover:bg-gold-light active:translate-y-px',
  solid: 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text))] ring-1 ring-inset ring-[rgb(var(--border))] hover:ring-[rgb(var(--gold)/0.5)]',
  ghost: 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]',
  outline: 'border border-[rgb(var(--gold)/0.4)] text-[rgb(var(--text))] hover:bg-[rgb(var(--gold)/0.1)] hover:border-[rgb(var(--gold)/0.7)]',
  danger: 'border border-negative/40 text-negative hover:bg-negative/10',
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }>(
  function Button({ className, variant = 'gold', ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-all duration-200',
          'cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          btnStyles[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

// ── Badge ──────────────────────────────────────────────
const badgeTones: Record<string, string> = {
  gold: 'bg-[rgb(var(--gold)/0.15)] text-gold border-[rgb(var(--gold)/0.35)]',
  green: 'bg-positive/10 text-positive border-positive/30',
  red: 'bg-negative/10 text-negative border-negative/30',
  amber: 'bg-warn/10 text-warn border-warn/30',
  muted: 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text-dim))] border-[rgb(var(--border))]',
};
export function Badge({ tone = 'muted', children, className }: { tone?: keyof typeof badgeTones; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

// ── Field ──────────────────────────────────────────────
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[rgb(var(--text-muted))]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-[rgb(var(--text-dim))]">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-negative">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl bg-[rgb(var(--surface-2))] border border-[rgb(var(--border)/0.7)] px-3.5 py-2.5 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-dim))] focus:border-[rgb(var(--gold)/0.6)] transition-colors';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, 'min-h-[96px] resize-y leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return <select ref={ref} className={cn(inputClass, 'cursor-pointer', className)} {...props}>{children}</select>;
  },
);

// ── Modal ──────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:items-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cn('surface-glass relative z-10 my-8 w-full rounded-2xl p-6 shadow-lift text-[rgb(var(--text))]', wide ? 'max-w-3xl' : 'max-w-lg')}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-xl text-[rgb(var(--text))]">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Toggle (crisp iOS-style switch) ────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-sm">
      <span className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-gold' : 'bg-[rgb(var(--border))]',
      )}>
        <span className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )} />
      </span>
      {label && <span className="text-[rgb(var(--text-muted))]">{label}</span>}
    </button>
  );
}

// ── Empty state ────────────────────────────────────────
export function EmptyState({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {icon && <div className="text-[rgb(var(--text-dim))]">{icon}</div>}
      <div className="font-display text-lg text-[rgb(var(--text))]">{title}</div>
      {sub && <div className="text-sm text-[rgb(var(--text-dim))]">{sub}</div>}
    </div>
  );
}

/**
 * Horizontal-scroll container for wide tables on small screens.
 *
 * Keeps the scroll INSIDE the card so the page body never scrolls sideways,
 * uses momentum scrolling on iOS, and exposes the region to keyboard/AT users
 * (tabIndex + role) since a scrollable box must be reachable without a mouse.
 */
export function TableScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Scrollable table"
      className={cn('w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--gold)/0.5)]', className)}
    >
      {children}
    </div>
  );
}

// ── Motion wrappers ────────────────────────────────────
export function FadeUp({ children, delay = 0, className, ...props }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
