import { requirePermission } from '@/lib/session';
import { getCateringQuotation, getCateringProfile, getCateringRules } from '@/lib/catering';
import { getBrand } from '@/lib/data';
import { notFound } from 'next/navigation';
import { PrintShell } from '@/components/print/print-shell';
import { CateringQuotationDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Catering Document' };
export const dynamic = 'force-dynamic';

export default async function CateringPrint({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('catering.view');
  const { id } = await params;
  const [q, profile, rules, brand] = await Promise.all([
    getCateringQuotation(Number(id)),
    getCateringProfile(),
    getCateringRules(true),
    getBrand(),
  ]);
  if (!q) notFound();

  return (
    <PrintShell backHref={`/catering/quotations/${id}`}>
      <CateringQuotationDoc
        d={{
          quotaNo: q.quotaNo,
          customerName: q.customerName,
          contactNo: q.contactNo,
          placeOfFunction: q.placeOfFunction,
          quotationDate: q.quotationDate,
          deliveryDate: q.deliveryDate,
          persons: q.persons,
          itemsTotal: q.itemsTotal,
          meatTotal: q.meatTotal,
          grandTotal: q.grandTotal,
          paidAmount: q.paidAmount,
          status: q.status,
          note: q.note,
          docType: q.docType,
          lines: (q.lines ?? []).map((l) => ({
            section: l.section, description: l.description, category: l.category,
            qty: l.qty, unit: l.unit, rate: l.rate, amount: l.amount,
          })),
        }}
        p={profile}
        rules={rules.map((r) => r.text)}
        brand={brand}
      />
    </PrintShell>
  );
}
