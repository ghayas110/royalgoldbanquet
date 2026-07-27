import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { query } from '../src/lib/db';

async function main() {
  const b = await query<any>(`SELECT COUNT(*) c, SUM(balance_amount) bal, SUM(banquet_amount) banq FROM bookings WHERE payment_status='SETTLED' AND event_date BETWEEN '2026-06-01' AND '2026-06-30'`);
  const pc = await query<any>(`SELECT SUM(amount) total FROM petty_cash_entries WHERE entry_date BETWEEN '2026-06-01' AND '2026-06-30'`);
  const d = await query<any>(`SELECT SUM(amount_disbursed) disb, SUM(amount_returned) ret FROM manager_disbursements`);
  console.log('Settled June bookings:', b[0]);
  console.log('Petty cash total June:', pc[0].total);
  console.log('Disbursements:', d[0]);
  process.exit(0);
}
main();
