import { requirePermission, can } from '@/lib/session';
import {
  getStockItems, getStockCategories, getStockMovements, getStockSummary, getStockBookingOptions,
  getStockProfitAllTime,
} from '@/lib/data';
import { StockClient } from './stock-client';

export const metadata = { title: 'Stock — Skylight Ballroom & Catering' };

export default async function StockPage() {
  const user = await requirePermission('stock.view');
  const canManage = can(user.permissions, 'stock.manage');

  const items = await getStockItems();
  const [categories, movements, summary, bookings, profit] = await Promise.all([
    getStockCategories(),
    getStockMovements(150),
    getStockSummary(items),
    getStockBookingOptions(60),
    getStockProfitAllTime(),
  ]);

  return (
    <StockClient
      canManage={canManage}
      profit={profit}
      items={items}
      categories={categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        sortOrder: Number(c.sort_order),
        itemCount: Number(c.item_count),
      }))}
      movements={movements}
      summary={summary}
      bookings={bookings.map((b: any) => ({
        id: b.id,
        slipNo: b.slip_no,
        eventDate: b.event_date,
        partyName: b.party_name,
      }))}
    />
  );
}
