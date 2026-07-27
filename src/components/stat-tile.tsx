'use client';

import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { Card } from './ui';
import { cn, fmtMoney } from '@/lib/format';

// Format kinds are passed as strings so this client component can be used
// from Server Components (functions can't cross the RSC boundary).
export type FormatKind = 'money' | 'int';
const FORMATTERS: Record<FormatKind, (n: number) => string> = {
  money: (n) => fmtMoney(n),
  int: (n) => String(Math.round(n)),
};

export function CountUp({ value, format = 'money' }: { value: number; format?: FormatKind }) {
  const fn = FORMATTERS[format];
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => fn(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, mv, fn]);
  return <motion.span className="tnum">{rounded}</motion.span>;
}

export function StatTile({
  label, value, format = 'money', icon, tone = 'gold', delay = 0, sub,
}: {
  label: string;
  value: number;
  format?: FormatKind;
  icon?: React.ReactNode;
  tone?: 'gold' | 'green' | 'red' | 'plain';
  delay?: number;
  sub?: string;
}) {
  const toneColor = {
    gold: 'text-gold',
    green: 'text-positive',
    red: 'text-negative',
    plain: 'text-[rgb(var(--text))]',
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="relative overflow-hidden p-5">
        <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-[rgb(var(--gold)/0.08)] blur-2xl" />
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--text-dim))]">{label}</span>
          {icon && <span className="text-gold/70">{icon}</span>}
        </div>
        <div className={cn('mt-3 font-display text-2xl md:text-3xl', toneColor)}>
          <CountUp value={value} format={format} />
        </div>
        {sub && <div className="mt-1 text-xs text-[rgb(var(--text-dim))]">{sub}</div>}
      </Card>
    </motion.div>
  );
}
