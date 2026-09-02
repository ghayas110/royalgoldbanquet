import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { getCateringTemplate, getCateringMenu, getCateringCustomers, getCateringCategories, getCateringMeatTypes } from '@/lib/catering';
import { QuotationEditor } from '../../../quotations/quotation-editor';

export const metadata = { title: 'Edit Template — Catering' };
export const dynamic = 'force-dynamic';

export default async function EditCateringTemplate({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('catering.manage');
  const { id } = await params;
  const [template, menu, customers, categories, meatTypes] = await Promise.all([
    getCateringTemplate(Number(id)),
    getCateringMenu(true), getCateringCustomers(), getCateringCategories(false), getCateringMeatTypes(true),
  ]);
  if (!template) notFound();
  return (
    <QuotationEditor
      mode="TEMPLATE"
      template={template}
      menu={menu}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      categories={categories}
      meatTypes={meatTypes}
    />
  );
}
