'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Card, Field, Input, Button, inputClass } from '@/components/ui';
import { cn } from '@/lib/format';
import { Loader2, LogIn, Eye, EyeOff, Home } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <Card glass className="p-6 md:p-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@royalgold.pk" required />
        </Field>
        <Field label="Password" error={error}>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              className={cn(inputClass, 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[rgb(var(--text-dim))] hover:text-gold"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <Link
        href="/"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border)/0.6)] py-2.5 text-sm text-[rgb(var(--text-muted))] transition-colors hover:border-[rgb(var(--gold)/0.4)] hover:text-[rgb(var(--text))]"
      >
        <Home className="h-4 w-4" /> Go to home screen
      </Link>
    </Card>
  );
}
