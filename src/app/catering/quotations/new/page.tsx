import { requirePermission } from '@/lib/session';
import { getCateringMenu, getCateringCustomers, getCateringCategories, getCateringMeatTypes, getCateringTemplate } from '@/lib/catering';
import { QuotationEditor } from '../quotation-editor';

export const metadata = { title: 'New Quotation — Catering' };
export const dynamic = 'force-dynamic';

export default async function NewCateringQuotation({
  searchParams,
}: { searchParams: Promise<{ template?: string }> }) {
  await requirePermission('catering.manage');
  const sp = await searchParams;

  const [menu, customers, categories, meatTypes] = await Promise.all([
    getCateringMenu(true), getCateringCustomers(), getCateringCategories(false), getCateringMeatTypes(true),
  ]);

  // ?template=<id> starts the quotation from a saved set of lines. The lines
  // are COPIED in: everything from here is the quotation's own, and editing it
  // never reaches back into the template.
  const templateId = Number(sp.template);
  const template = Number.isFinite(templateId) && templateId > 0
    ? await getCateringTemplate(templateId)
    : null;

  return (
    <QuotationEditor
      presetLines={template?.lines}
      presetPersons={template?.persons}
      menu={menu}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      categories={categories}
      meatTypes={meatTypes}
    />
  );
}
