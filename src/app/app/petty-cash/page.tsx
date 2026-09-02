import { requirePermission, hasPermission } from '@/lib/session';
import { getDefaultPeriod, getPettyCashData, getExpenseCategories } from '@/lib/data';
import { resolvePeriod } from '@/lib/format';
import { PettyCashClient } from './petty-cash-client';

export const metadata = { title: 'Petty Cash — Skylight Ballroom & Catering' };

export default async function PettyCashPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('pettycash.view');
  const sp = await searchParams;
  const { year, month } = resolvePeriod(sp, await getDefaultPeriod());
  const [data, categories] = await Promise.all([getPettyCashData(year, month), getExpenseCategories()]);

  return (
    <PettyCashClient
      year={year} month={month}
      days={data.days} heads={data.heads} entries={data.entries} locked={data.locked}
      categories={categories.map((c: any) => ({ id: c.id, name: c.name, hasQtyNote: c.has_qty_note === 1, active: c.is_active === 1, usage: Number(c.usage_count) }))}
      canEdit={hasPermission(user, 'pettycash.edit')}
      canLock={hasPermission(user, 'pettycash.lock')}
    />
  );
}
