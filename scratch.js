const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await connection.query(`SELECT id, status, booking_date, event_date, total_amount, paid_amount FROM bookings`);
  console.log(rows);
  process.exit(0);
}
run();
