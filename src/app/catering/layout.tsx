import { requirePermission } from '@/lib/session';
import { AppShell } from '@/components/app-shell';
import { CATERING_NAV } from '@/lib/nav';
import { getCateringProfile } from '@/lib/catering';

/**
 * The catering portal.
 *
 * Gated on `catering.view`, which the Owner does not hold by default — a
 * ballroom manager landing here is redirected to their own dashboard, and a
 * Catering user never sees a hall.
 */
export default async function CateringLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission('catering.view');
  const profile = await getCateringProfile();

  // The catering arm trades under its own name, so the sidebar wears it.
  const [first, ...rest] = profile.name.split(' ');
  return (
    <AppShell
      user={user}
      nav={CATERING_NAV}
      homeHref="/catering"
      brandName={first || 'Catering'}
      brandSub={(rest.join(' ') || 'Catering').toUpperCase()}
    >
      {children}
    </AppShell>
  );
}
