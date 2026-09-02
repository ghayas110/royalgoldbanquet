import { requirePermission } from '@/lib/session';
import { getCateringVendors } from '@/lib/catering';
import { VendorsClient } from './vendors-client';

export const metadata = { title: 'Vendors — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringVendorsPage() {
  const user = await requirePermission('catering.view');
  const vendors = await getCateringVendors(false);
  return (
    <VendorsClient
      vendors={vendors}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
