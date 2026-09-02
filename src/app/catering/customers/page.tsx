import { requirePermission } from '@/lib/session';
import { getCateringCustomers } from '@/lib/catering';
import { CustomersClient } from './customers-client';

export const metadata = { title: 'Customers — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringCustomersPage() {
  const user = await requirePermission('catering.view');
  const customers = await getCateringCustomers();
  return (
    <CustomersClient
      customers={customers}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
