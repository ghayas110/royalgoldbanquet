import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Catering staff hold no ballroom permissions, so every page here would
  // redirect them anyway. Send them to their own portal instead of bouncing.
  if (user.role === 'CATERING') redirect('/catering');
  return <AppShell user={user}>{children}</AppShell>;
}
