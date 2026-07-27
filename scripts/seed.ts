import { config as loadEnv } from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

loadEnv({ path: '.env.local' });

const YEAR = 2026;
const MONTH = 6; // June

// ── Expense heads (30, seeded) ──────────────────────────
const EXPENSE_HEADS: [string, boolean][] = [
  ['Salary Expense', false],
  ['Advance to Employees', false],
  ['Petrol', false],
  ['Employee Loan', false],
  ['Waiters - Gents', true],
  ['Waiters - Ladies', true],
  ['Dhobi', false],
  ['Pepsi Payment Balance', false],
  ['Pepsi Refund Coldrink', false],
  ['Irshad Bhai Generator', false],
  ['Maymar Maintenance Bill', false],
  ['Valet Parking', true],
  ['Diesel Payment', false],
  ['Repair & Maintenance / Misc', false],
  ['Ice for Coldrink', false],
  ['Gas', false],
  ['Cleaning Material', false],
  ['R.O. Water', false],
  ['Labour Food', false],
  ['Refreshment', false],
  ['Other Big', false],
  ['Tea Hall', false],
  ['Cap/Cotton/Sprite/Straw', false],
  ['Donation (Per Event) 1100/-', true],
  ['Internet / Telephone Bill', false],
  ['Entry Package (Basharat)', false],
  ['Bank Charges Transfer', false],
  ['Tea Guard', false],
  ['Slip Commission', false],
  ['Aman Electric', false],
];

// ── Settled bookings with June event dates (Section A) ──
type Svc = { label: string; qty: number; rate: number };
type SeedBooking = {
  party: string; bride?: string; groom?: string; phone: string;
  hall: number; bookingDate: string; eventDate: string; shift: 'LUNCH' | 'DINNER';
  guests: number; balance: number; services: Svc[]; advance: number;
};

const svcSet = (waitersG: number, waitersL: number, extras: Svc[] = []): Svc[] => [
  { label: 'Gents Waiters', qty: waitersG, rate: 800 },
  { label: 'Ladies Waiters', qty: waitersL, rate: 800 },
  { label: 'Petrol / Transport', qty: 1, rate: 3500 },
  { label: 'Coffee Machine', qty: 1, rate: 6000 },
  { label: 'Water Cooler', qty: 2, rate: 1500 },
  { label: 'Generator', qty: 1, rate: 12000 },
  { label: 'Valet Parking', qty: 1, rate: 8000 },
  { label: 'Ice', qty: 1, rate: 2500 },
  { label: 'Cold Drinks', qty: 1, rate: 18000 },
  { label: 'Tea Hall', qty: 1, rate: 9000 },
  { label: 'Decor', qty: 1, rate: 45000 },
  ...extras,
];

const SETTLED: SeedBooking[] = [
  { party: 'Ahmed–Zoya Wedding', bride: 'Zoya', groom: 'Ahmed', phone: '0300-2110011', hall: 1, bookingDate: '2026-04-12', eventDate: '2026-06-03', shift: 'DINNER', guests: 650, balance: 350000, services: svcSet(14, 10), advance: 150000 },
  { party: 'Malik Family Valima', groom: 'Bilal Malik', phone: '0301-4550022', hall: 1, bookingDate: '2026-04-20', eventDate: '2026-06-07', shift: 'DINNER', guests: 720, balance: 400000, services: svcSet(16, 12, [{ label: 'Extra Lighting', qty: 1, rate: 15000 }]), advance: 200000 },
  { party: 'Hassan Mehndi', bride: 'Areeba', groom: 'Hassan', phone: '0333-9001133', hall: 2, bookingDate: '2026-05-01', eventDate: '2026-06-10', shift: 'LUNCH', guests: 300, balance: 180000, services: svcSet(8, 8), advance: 80000 },
  { party: 'Shaikh Nikkah', bride: 'Mahnoor', groom: 'Usman', phone: '0345-7788990', hall: 2, bookingDate: '2026-05-05', eventDate: '2026-06-14', shift: 'DINNER', guests: 260, balance: 160000, services: svcSet(7, 7), advance: 60000 },
  { party: 'Qureshi Barat', bride: 'Fatima', groom: 'Talha', phone: '0321-6543210', hall: 1, bookingDate: '2026-05-09', eventDate: '2026-06-18', shift: 'DINNER', guests: 800, balance: 450000, services: svcSet(18, 14, [{ label: 'Fireworks', qty: 1, rate: 25000 }]), advance: 250000 },
  { party: 'Ansari Reception', bride: 'Hira', groom: 'Zain', phone: '0302-1122334', hall: 1, bookingDate: '2026-05-12', eventDate: '2026-06-21', shift: 'DINNER', guests: 600, balance: 330000, services: svcSet(13, 10), advance: 130000 },
  { party: 'Farooqi Aqiqah', phone: '0308-5566778', hall: 2, bookingDate: '2026-05-18', eventDate: '2026-06-24', shift: 'LUNCH', guests: 220, balance: 140000, services: svcSet(6, 5), advance: 70000 },
  { party: 'Rehman Engagement', bride: 'Sana', groom: 'Daniyal', phone: '0311-9988776', hall: 2, bookingDate: '2026-05-22', eventDate: '2026-06-27', shift: 'DINNER', guests: 280, balance: 170000, services: svcSet(8, 7), advance: 90000 },
  { party: 'Iqbal Grand Valima', groom: 'Hamza Iqbal', phone: '0300-3344556', hall: 1, bookingDate: '2026-05-25', eventDate: '2026-06-29', shift: 'DINNER', guests: 750, balance: 420000, services: svcSet(17, 13), advance: 220000 },
];

// ── New bookings made in June for FUTURE dates (Section B) ──
const NEW_BOOKINGS: SeedBooking[] = [
  { party: 'Khan Wedding', bride: 'Laiba', groom: 'Arsalan', phone: '0300-7001234', hall: 1, bookingDate: '2026-06-04', eventDate: '2026-08-15', shift: 'DINNER', guests: 700, balance: 400000, services: svcSet(16, 12), advance: 180000 },
  { party: 'Siddiqui Barat', bride: 'Noor', groom: 'Faizan', phone: '0333-8009876', hall: 2, bookingDate: '2026-06-08', eventDate: '2026-07-20', shift: 'LUNCH', guests: 320, balance: 190000, services: svcSet(9, 8), advance: 90000 },
  { party: 'Baig Mehndi', bride: 'Alina', groom: 'Shayan', phone: '0345-2003344', hall: 1, bookingDate: '2026-06-15', eventDate: '2026-09-05', shift: 'DINNER', guests: 620, balance: 340000, services: svcSet(13, 11), advance: 160000 },
  { party: 'Chaudhry Valima', groom: 'Umair Chaudhry', phone: '0321-1005566', hall: 2, bookingDate: '2026-06-19', eventDate: '2026-08-02', shift: 'DINNER', guests: 300, balance: 175000, services: svcSet(8, 7), advance: 85000 },
  { party: 'Sheikh Reception', bride: 'Emaan', groom: 'Rohan', phone: '0302-6007788', hall: 1, bookingDate: '2026-06-26', eventDate: '2026-10-11', shift: 'DINNER', guests: 680, balance: 380000, services: svcSet(15, 12), advance: 170000 },
];

function sumSvc(s: Svc[]) { return s.reduce((a, x) => a + x.qty * x.rate, 0); }
function pad(n: number) { return String(n).padStart(2, '0'); }

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 8889),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_NAME ?? 'royal_gold_banquet',
    multipleStatements: true,
  });

  console.log('→ Clearing existing data...');
  await conn.query(`SET foreign_key_checks = 0;
    TRUNCATE audit_log; TRUNCATE income_adjustments; TRUNCATE monthly_locks;
    TRUNCATE manager_disbursements; TRUNCATE petty_cash_entries; TRUNCATE expense_heads;
    TRUNCATE payments; TRUNCATE booking_service_items; TRUNCATE bookings;
    TRUNCATE parties; TRUNCATE halls; TRUNCATE leads; TRUNCATE settings; TRUNCATE users;
    SET foreign_key_checks = 1;`);

  // ── Users ──
  console.log('→ Seeding users...');
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, permissions, is_active) VALUES ?`,
    [[
      ['Usama (Owner)', 'usama@royalgold.pk', hash('royal123'), 'OWNER', null, 1],
      ['Naseem (Manager)', 'naseem@royalgold.pk', hash('royal123'), 'MANAGER', null, 1],
      ['Front Desk (Viewer)', 'viewer@royalgold.pk', hash('royal123'), 'VIEWER', null, 1],
    ]],
  );
  const [[owner]] = await conn.query<any[]>(`SELECT id FROM users WHERE email='usama@royalgold.pk'`) as any;
  const [[manager]] = await conn.query<any[]>(`SELECT id FROM users WHERE email='naseem@royalgold.pk'`) as any;
  const ownerId = owner.id, managerId = manager.id;

  // ── Halls ──
  console.log('→ Seeding halls...');
  await conn.query(`INSERT INTO halls (name, capacity, base_charge, description, is_active) VALUES ?`, [[
    ['Grand Hall', 800, 400000, 'Our flagship hall — soaring ceilings, crystal chandeliers and a grand stage for up to 800 guests.', 1],
    ['Crystal Hall', 400, 200000, 'An intimate, elegant setting for up to 400 guests — perfect for nikkah, mehndi and refined receptions.', 1],
  ]]);

  // ── Settings ──
  await conn.query(`INSERT INTO settings (\`key\`, \`value\`) VALUES ?`, [[
    ['sale_attribution', 'EVENT_MONTH'],
    ['banquet_name', 'Royal Gold Banquet'],
    ['banquet_city', 'Karachi'],
  ]]);

  // ── Expense heads ──
  console.log('→ Seeding expense heads...');
  await conn.query(
    `INSERT INTO expense_heads (name, sort_order, has_qty_note, is_active) VALUES ?`,
    [EXPENSE_HEADS.map(([name, hasQty], i) => [name, i + 1, hasQty ? 1 : 0, 1])],
  );
  const [heads] = await conn.query<any[]>(`SELECT id, name FROM expense_heads ORDER BY sort_order`);
  const headByName = new Map(heads.map((h: any) => [h.name, h.id]));

  // ── Booking inserter ──
  async function insertBooking(b: SeedBooking, settled: boolean, slipSeq: number) {
    const banquet = sumSvc(b.services);
    const total = b.balance + banquet;
    const paid = settled ? total : b.advance;
    const payStatus = settled ? 'SETTLED' : (b.advance > 0 ? 'PARTIAL' : 'PENDING');
    const status = settled ? 'COMPLETED' : 'CONFIRMED';
    const slip = `RGB-${YEAR}-${pad(slipSeq)}`;

    const [pr] = await conn.query<any>(
      `INSERT INTO parties (party_name, bride_name, groom_name, phone) VALUES (?,?,?,?)`,
      [b.party, b.bride ?? null, b.groom ?? null, b.phone],
    );
    const partyId = pr.insertId;

    const [br] = await conn.query<any>(
      `INSERT INTO bookings (slip_no, party_id, hall_id, booking_date, event_date, shift,
         guest_count, balance_amount, banquet_amount, total_amount, advance_amount,
         paid_amount, status, payment_status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [slip, partyId, b.hall, b.bookingDate, b.eventDate, b.shift, b.guests,
        b.balance, banquet, total, b.advance, paid, status, payStatus, managerId],
    );
    const bookingId = br.insertId;

    for (const s of b.services) {
      await conn.query(
        `INSERT INTO booking_service_items (booking_id, label, qty, rate, subtotal) VALUES (?,?,?,?,?)`,
        [bookingId, s.label, s.qty, s.rate, s.qty * s.rate],
      );
    }

    // advance payment recorded on booking date
    if (b.advance > 0) {
      await conn.query(
        `INSERT INTO payments (booking_id, amount, payment_date, method, received_by, note) VALUES (?,?,?,?,?,?)`,
        [bookingId, b.advance, b.bookingDate, 'CASH', managerId, 'Advance at booking'],
      );
    }
    // final settlement on event date
    if (settled && total - b.advance > 0) {
      await conn.query(
        `INSERT INTO payments (booking_id, amount, payment_date, method, received_by, note) VALUES (?,?,?,?,?,?)`,
        [bookingId, total - b.advance, b.eventDate, 'CASH', managerId, 'Final settlement'],
      );
    }
    return { bookingId, slip };
  }

  console.log('→ Seeding bookings (settled + new)...');
  let seq = 1;
  const settledRefs: { bookingId: number; slip: string; eventDate: string }[] = [];
  for (const b of SETTLED) {
    const r = await insertBooking(b, true, seq++);
    settledRefs.push({ ...r, eventDate: b.eventDate });
  }
  for (const b of NEW_BOOKINGS) {
    await insertBooking(b, false, seq++);
  }

  // ── Manager disbursements (float) ──
  console.log('→ Seeding manager float disbursements...');
  const disb: any[] = [];
  // Two floats to Naseem, one reconciled, one open
  const [d1] = await conn.query<any>(
    `INSERT INTO manager_disbursements (slip_no, booking_id, disbursed_by, disbursed_to,
       amount_disbursed, date_disbursed, amount_returned, date_returned, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [settledRefs[0].slip, settledRefs[0].bookingId, ownerId, managerId, 20000, '2026-06-02', 9500, '2026-06-05', 'RECONCILED', 'Float for Ahmed–Zoya event'],
  );
  const [d2] = await conn.query<any>(
    `INSERT INTO manager_disbursements (slip_no, booking_id, disbursed_by, disbursed_to,
       amount_disbursed, date_disbursed, amount_returned, date_returned, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [settledRefs[4].slip, settledRefs[4].bookingId, ownerId, managerId, 30000, '2026-06-16', 0, null, 'OPEN', 'Float for Qureshi Barat'],
  );
  const disb1 = d1.insertId, disb2 = d2.insertId;

  // ── Petty cash entries across the month ──
  console.log('→ Seeding petty cash matrix...');
  // deterministic pseudo-random spread
  const rnd = (seedN: number) => {
    const x = Math.sin(seedN) * 10000; return x - Math.floor(x);
  };
  const monthlyTargets: Record<string, number> = {
    'Salary Expense': 185000, 'Advance to Employees': 30000, 'Petrol': 42000,
    'Employee Loan': 15000, 'Waiters - Gents': 96000, 'Waiters - Ladies': 78000,
    'Dhobi': 12000, 'Pepsi Payment Balance': 55000, 'Irshad Bhai Generator': 48000,
    'Maymar Maintenance Bill': 22000, 'Valet Parking': 36000, 'Diesel Payment': 60000,
    'Repair & Maintenance / Misc': 28000, 'Ice for Coldrink': 18000, 'Gas': 24000,
    'Cleaning Material': 14000, 'R.O. Water': 9000, 'Labour Food': 33000,
    'Refreshment': 16000, 'Tea Hall': 27000, 'Cap/Cotton/Sprite/Straw': 11000,
    'Donation (Per Event) 1100/-': 9900, 'Internet / Telephone Bill': 8000,
    'Bank Charges Transfer': 4500, 'Tea Guard': 14000, 'Slip Commission': 18000,
    'Aman Electric': 21000,
  };
  const qtyNoteHeads: Record<string, string> = {
    'Valet Parking': '6 DAYS', 'Donation (Per Event) 1100/-': '9 events',
    'Waiters - Gents': '12 events', 'Waiters - Ladies': '12 events',
  };

  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  let pcCount = 0;
  for (const [name, target] of Object.entries(monthlyTargets)) {
    const headId = headByName.get(name);
    if (!headId) continue;
    // spread across 6-10 distinct days (counter advances every attempt to avoid loops)
    const numDays = Math.min(daysInMonth, 6 + Math.floor(rnd(headId * 7) * 5));
    const chosen = new Set<number>();
    let attempt = 0;
    while (chosen.size < numDays && attempt < 500) {
      chosen.add(1 + Math.floor(rnd(headId * 13 + attempt * 17 + 1) * daysInMonth));
      attempt++;
    }
    const per = Math.round(target / chosen.size / 100) * 100;
    const daysArr = [...chosen];
    for (let i = 0; i < daysArr.length; i++) {
      const day = daysArr[i];
      const amt = i === daysArr.length - 1 ? target - per * (daysArr.length - 1) : per;
      if (amt <= 0) continue;
      const date = `${YEAR}-${pad(MONTH)}-${pad(day)}`;
      // tag some entries to the open disbursement (Qureshi) around mid-June
      const disbId = (name === 'Waiters - Gents' || name === 'Ice for Coldrink' || name === 'Cold Drinks')
        && day >= 16 && day <= 19 ? disb2 : null;
      await conn.query(
        `INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, disbursement_id, entered_by)
         VALUES (?,?,?,?,?,?)`,
        [date, headId, amt, i === 0 ? (qtyNoteHeads[name] ?? null) : null, disbId, managerId],
      );
      pcCount++;
    }
  }

  // ── Leads ──
  console.log('→ Seeding leads...');
  await conn.query(`INSERT INTO leads (name, phone, event_date, message, source, status) VALUES ?`, [[
    ['Adnan Sethi', '0300-1231234', '2026-12-14', 'Enquiry for 500 guests dinner', 'WEBSITE', 'NEW'],
    ['Mariam Yousuf', '0333-9879876', '2026-11-02', 'Mehndi function, need pricing', 'WHATSAPP', 'CONTACTED'],
    ['Bilal Tariq', '0345-5556667', '2027-01-20', 'Valima, Grand Hall availability?', 'WEBSITE', 'NEW'],
  ]]);

  // ── Rules / policies ──
  console.log('→ Seeding rules...');
  await conn.query(`INSERT INTO rules (title, body, category, sort_order, is_active) VALUES ?`, [[
    ['Advance to confirm', 'A minimum 40% advance of the hall charge is required to confirm and hold your date.', 'BOOKING', 1, 1],
    ['Final settlement', 'The remaining balance must be settled on or before the event date.', 'BOOKING', 2, 1],
    ['Cancellation', 'Cancellations within 15 days of the event forfeit 50% of the advance.', 'BOOKING', 3, 1],
    ['Outside catering', 'Outside catering is not permitted; our kitchen handles all food service.', 'VENUE', 4, 1],
    ['Timings', 'Lunch events: 12:00–4:00 PM. Dinner events: 7:00–11:30 PM. Overtime is billed hourly.', 'VENUE', 5, 1],
    ['Decor & fireworks', 'Custom decor is welcome with prior approval. Indoor fireworks are strictly prohibited.', 'VENUE', 6, 1],
    ['Damages', 'Any damage to venue property will be charged to the host at actual cost.', 'GENERAL', 7, 1],
  ]]);

  // ── Employees ──
  console.log('→ Seeding employees...');
  await conn.query(`INSERT INTO employees (name, phone, designation, monthly_salary, joined_date, is_active) VALUES ?`, [[
    ['Rashid Ali', '0300-1111001', 'Head Waiter', 35000, '2019-03-15', 1],
    ['Kamran Khan', '0300-1111002', 'Waiter', 28000, '2021-07-01', 1],
    ['Saleem Iqbal', '0300-1111003', 'Waiter', 28000, '2022-01-10', 1],
    ['Naeem Ahmed', '0300-1111004', 'Cook', 45000, '2018-06-20', 1],
    ['Farhan Malik', '0300-1111005', 'Cleaner', 22000, '2023-02-05', 1],
    ['Junaid Shah', '0300-1111006', 'Valet', 25000, '2022-09-12', 1],
    ['Imran Baig', '0300-1111007', 'Security', 30000, '2020-11-03', 1],
    ['Waqas Nadeem', '0300-1111008', 'Electrician', 32000, '2021-04-18', 1],
  ]]);
  const [emps] = await conn.query<any[]>(`SELECT id FROM employees ORDER BY id`);

  // ── Employee loans (a couple outstanding) ──
  console.log('→ Seeding employee loans...');
  await conn.query(`INSERT INTO employee_loans (employee_id, amount, date_taken, note, is_settled, created_by) VALUES ?`, [[
    [emps[0].id, 100000, '2026-05-10', 'Personal loan — home repair', 0, ownerId],
    [emps[3].id, 50000, '2026-06-02', 'Medical advance', 0, ownerId],
  ]]);
  const [loans] = await conn.query<any[]>(`SELECT id, employee_id FROM employee_loans ORDER BY id`);
  // One partial repayment already made against the first loan
  await conn.query(`INSERT INTO loan_repayments (loan_id, employee_id, amount, repay_date, note) VALUES (?,?,?,?,?)`,
    [loans[0].id, loans[0].employee_id, 20000, '2026-06-30', 'Deducted from June salary']);

  // ── Attendance (June 2026) ──
  console.log('→ Seeding attendance...');
  const attRows: any[] = [];
  for (const e of emps) {
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(YEAR, MONTH - 1, day).getDay();
      const r = rnd(e.id * 31 + day * 7);
      let status = 'PRESENT';
      if (dow === 5) status = r < 0.5 ? 'LEAVE' : 'PRESENT';      // many take Friday off
      else if (r < 0.06) status = 'ABSENT';
      else if (r < 0.20) status = 'LATE';
      else if (r < 0.24) status = 'LEAVE';
      const date = `${YEAR}-${pad(MONTH)}-${pad(day)}`;
      attRows.push([e.id, date, status, null, managerId]);
    }
  }
  // bulk insert
  await conn.query(`INSERT INTO attendance (employee_id, att_date, status, note, marked_by) VALUES ?`, [attRows]);

  console.log(`\n✓ Seed complete.`);
  console.log(`   Users: Usama (owner), Naseem (manager), Viewer — password: royal123`);
  console.log(`   Bookings: ${SETTLED.length} settled + ${NEW_BOOKINGS.length} new (June ${YEAR})`);
  console.log(`   Petty cash entries: ${pcCount} | Disbursements: 2`);
  console.log(`   Rules: 7 | Employees: ${emps.length} | Attendance rows: ${attRows.length}`);

  await conn.end();
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  console.error(err);
  process.exit(1);
});
