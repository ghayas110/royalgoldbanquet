import { config as loadEnv } from 'dotenv';
import mysql from 'mysql2/promise';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConnectionConfig } from '../src/lib/db';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' }); // production: .env next to server.js

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function main() {
  const { host, port, user, password, database: dbName } = getConnectionConfig();

  // Connect without a database first, to create it.
  const admin = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.query(`USE \`${dbName}\``);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  /**
   * 001_init.sql DROPs every table before recreating it. That is correct for a
   * fresh install and catastrophic on a live one — running `db:migrate` to pick
   * up a new migration would silently destroy the client's bookings.
   *
   * So it is skipped whenever the database already has tables. The numbered
   * upgrades after it are all idempotent and safe to re-run. Pass --reset (or
   * use `db:reset`) to deliberately wipe and rebuild.
   */
  const [existing] = await admin.query<any[]>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [dbName],
  );
  const isPopulated = Number(existing[0]?.n ?? 0) > 0;
  const force = process.argv.includes('--reset');

  for (const file of files) {
    const destructive = /^001_/.test(file);
    if (destructive && isPopulated && !force) {
      console.log(`→ Skipping ${file} (database already exists — pass --reset to rebuild it)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`→ Running ${file} ... `);
    await admin.query(sql);
    console.log('done');
  }

  await admin.end();
  console.log(`\n✓ Migrations complete on database "${dbName}".`);
}

main().catch((err) => {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
});
