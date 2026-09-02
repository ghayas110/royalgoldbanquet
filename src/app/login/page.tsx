import { LoginForm } from './login-form';
import { BrandLockup } from '@/components/brand';
import { getSessionUser } from '@/lib/session';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Sign in — Skylight Ballroom & Catering' };

export default async function LoginPage() {
  // The installed PWA launches at /login (manifest start_url). If the session
  // is still valid, pass straight through to the dashboard instead of showing
  // a sign-in form the user doesn't need.
  const user = await getSessionUser();
  if (user) redirect('/app');

  return <LoginScreen />;
}

function LoginScreen() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* ambient gold glow */}
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-[rgb(var(--gold)/0.10)] blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLockup />
          <h1 className="mt-6 font-display text-3xl text-[rgb(var(--text))]">Welcome back</h1>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-dim))]">Sign in to the management portal</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
