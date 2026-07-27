import { config as loadEnv } from 'dotenv';
import mysql from 'mysql2/promise';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function main() {
  const dbName = process.env.DB_NAME ?? 'royal_gold_banquet';

  // Connect without a database first, to create it.
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 8889),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    multipleStatements: true,
  });

  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.query(`USE \`${dbName}\``);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
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
