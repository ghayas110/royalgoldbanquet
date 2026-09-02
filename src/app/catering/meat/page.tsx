import { requirePermission } from '@/lib/session';
import { getCateringMeatTypes } from '@/lib/catering';
import { MeatClient } from './meat-client';

export const metadata = { title: 'Meat Rates — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringMeatPage() {
  const user = await requirePermission('catering.view');
  const meats = await getCateringMeatTypes(false);
  return (
    <MeatClient
      meats={meats}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
