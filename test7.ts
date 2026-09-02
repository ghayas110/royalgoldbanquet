import { query } from './src/lib/db';

async function main() {
  const b = await query(`SELECT id, booking_date, event_date FROM bookings ORDER BY booking_date`);
  console.log("All bookings:", b);
  process.exit(0);
}
main();
