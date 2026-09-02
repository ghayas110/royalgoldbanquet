import { requirePermission } from '@/lib/session';
import { getCateringCategories } from '@/lib/catering';
import { CategoriesClient } from './categories-client';

export const metadata = { title: 'Categories — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringCategoriesPage() {
  const user = await requirePermission('catering.view');
  const categories = await getCateringCategories(false);
  return (
    <CategoriesClient
      categories={categories}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
