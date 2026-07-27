'use client';

import { NAV } from '@/lib/nav';
import type { Permission, Role } from '@/lib/types';
import { BrandLockup, BrandMark } from './brand';
import { cn } from '@/lib/format';
import { useTheme } from './providers';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function Icon({ name, className }: { name: string; className?: string }) {
  const registry = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const C = registry[name] ?? registry.Circle;
  return <C className={className} />;
}

export function AppShell({
  user, children,
}: {
  user: { id: number; name?: string | null; email?: string | null; role: Role; permissions: Permission[] };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [mobileNav, setMobileNav] = useState(false);

  const items = NAV.filter((n) => user.role === 'OWNER' || user.permissions.includes(n.perm));
  const mobileItems = items.filter((n) => n.mobile).slice(0, 5);

  const isActive = (href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface)/0.6)] backdrop-blur-xl lg:flex">
        <div className="px-5 py-6">
          <BrandLockup />
        </div>
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                isActive(n.href)
                  ? 'bg-[rgb(var(--gold)/0.14)] text-gold shadow-[inset_0_0_0_1px_rgb(var(--gold)/0.3)]'
                  : 'text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]',
              )}
            >
              <Icon name={n.icon} className="h-[18px] w-[18px]" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-[rgb(var(--border)/0.5)] p-3">
          <UserMenu user={user} theme={theme} onToggleTheme={toggle} />
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface)/0.85)] px-4 py-3 backdrop-blur-xl lg:hidden">
        <BrandLockup compact />
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="rounded-lg p-2 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]" aria-label="Toggle theme">
            <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} className="h-5 w-5" />
          </button>
          <button onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]" aria-label="Menu">
            <Icon name="Menu" className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile slide-over ── */}
      <AnimatePresence>
        {mobileNav && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-72 surface-glass p-4 overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <BrandMark />
                <button onClick={() => setMobileNav(false)} className="rounded-lg p-2 hover:bg-[rgb(var(--surface-2))]"><Icon name="X" className="h-5 w-5" /></button>
              </div>
              <nav className="space-y-1">
                {items.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setMobileNav(false)}
                    className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                      isActive(n.href) ? 'bg-[rgb(var(--gold)/0.14)] text-gold' : 'text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]')}>
                    <Icon name={n.icon} className="h-[18px] w-[18px]" /> {n.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-4 border-t border-[rgb(var(--border)/0.5)] pt-3">
                <UserMenu user={user} theme={theme} onToggleTheme={toggle} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 pb-24 md:px-8 lg:pb-8">{children}</div>
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border)/0.5)] bg-[rgb(var(--surface)/0.92)] px-2 py-2 backdrop-blur-xl lg:hidden">
        {mobileItems.map((n) => (
          <Link key={n.href} href={n.href} className={cn('flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px]',
            isActive(n.href) ? 'text-gold' : 'text-[rgb(var(--text-dim))]')}>
            <Icon name={n.icon} className="h-5 w-5" />
            {n.label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function UserMenu({ user, theme, onToggleTheme }: { user: { name?: string | null; role: Role }; theme: string; onToggleTheme: () => void }) {
  return (
    <div className="space-y-2">
      <Link href="/app/account" className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[rgb(var(--surface-2))]">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink font-semibold text-sm ring-1 ring-inset ring-white/15">
          {(user.name ?? 'U').slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[rgb(var(--text))]">{user.name}</div>
          <div className="text-[11px] uppercase tracking-wider text-gold/80">{user.role}</div>
        </div>
        <Icon name="ChevronRight" className="h-4 w-4 text-[rgb(var(--text-dim))]" />
      </Link>
      <div className="flex gap-2">
        <button onClick={onToggleTheme} className="hidden lg:flex flex-1 items-center justify-center gap-2 rounded-lg border border-[rgb(var(--border)/0.6)] py-2 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))]">
          <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} className="h-4 w-4" /> {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-negative/30 py-2 text-xs text-negative hover:bg-negative/10">
          <Icon name="LogOut" className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
