import { requirePermission } from '@/lib/session';
import { getCateringReport, getCateringProfile } from '@/lib/catering';
import { getBrand, getDefaultPeriod } from '@/lib/data';
import { resolvePeriod, monthRange, monthLabelFull } from '@/lib/format';
import { PrintShell } from '@/components/print/print-shell';
import { CateringReportDoc } from '@/components/print/print-docs';

export const metadata = { title: 'Catering Report' };
export const dynamic = 'force-dynamic';

export default async function CateringReportPrint({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('catering.reports');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());
  const { from, to } = monthRange(year, month);

  const [report, profile, brand] = await Promise.all([
    getCateringReport(from, to, monthLabelFull(year, month)),
    getCateringProfile(),
    getBrand(),
  ]);

  return (
    <PrintShell backHref={`/catering/reports?year=${year}&month=${month}`}>
      <CateringReportDoc r={report} p={profile} brand={brand} />
    </PrintShell>
  );
}
