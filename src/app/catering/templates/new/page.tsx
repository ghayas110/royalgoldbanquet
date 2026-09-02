import { requirePermission } from '@/lib/session';
import { getCateringMenu, getCateringCustomers, getCateringCategories, getCateringMeatTypes } from '@/lib/catering';
import { QuotationEditor } from '../../quotations/quotation-editor';

export const metadata = { title: 'New Template — Catering' };
export const dynamic = 'force-dynamic';

export default async function NewCateringTemplate() {
  await requirePermission('catering.manage');
  const [menu, customers, categories, meatTypes] = await Promise.all([
    getCateringMenu(true), getCateringCustomers(), getCateringCategories(false), getCateringMeatTypes(true),
  ]);
  return (
    <QuotationEditor
      mode="TEMPLATE"
      menu={menu}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      categories={categories}
      meatTypes={meatTypes}
    />
  );
}
