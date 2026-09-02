import { requirePermission } from '@/lib/session';
import { getCateringProfile } from '@/lib/catering';
import { SettingsClient } from './settings-client';

export const metadata = { title: 'Settings — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringSettingsPage() {
  await requirePermission('catering.manage');
  const profile = await getCateringProfile();
  return <SettingsClient profile={profile} />;
}
