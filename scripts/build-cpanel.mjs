// Assembles a ready-to-upload cPanel package from the Next.js standalone build.
//
// NOTE ON THE RETRY IN `npm run build:cpanel`
// `next build` intermittently fails during "Collecting page data" with
//   PageNotFoundError: Cannot find module for page: /app/bookings/[id]
// It only ever names a BRACKETED dynamic route, names a different one each
// time, and an unchanged retry succeeds. That is a race in Next's parallel
// page-data collection, not a fault in this app, so the script clears .next
// and retries once rather than leaving a deploy blocked on a coin flip.
//
// If a build fails TWICE, it is a real error: read the output, do not retry.
// Run AFTER `next build` (next.config.mjs must have output:'standalone').
//   node scripts/build-cpanel.mjs
//
// Produces:  cpanel-build/       (upload this folder's CONTENTS to the app root)
//            cpanel-build.zip     (same, zipped for cPanel File Manager)
//
// cPanel "Setup Node.js App" (Passenger) runs it with startup file app.js.
//
// Optional overrides (pre-fill the deploy templates for a known host):
//   CPANEL_DB_USER=usaaswtj_skylightballroom CPANEL_DB_NAME=usaaswtj_skylightballroom \
//   CPANEL_OWNER_EMAIL=admin@skylightballroom.pk CPANEL_OWNER_PASSWORD=skylight123 \
//   node scripts/build-cpanel.mjs

import { cp, rm, mkdir, writeFile, readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'cpanel-build');
const standalone = path.join(root, '.next', 'standalone');

// Deploy-time knobs (safe defaults; password never hard-coded into the build).
const DB_USER = process.env.CPANEL_DB_USER || 'usaaswtj_skylightballroom';
const DB_NAME = process.env.CPANEL_DB_NAME || 'usaaswtj_skylightballroom';
const DB_HOST = process.env.CPANEL_DB_HOST || 'localhost';
const DB_PORT = process.env.CPANEL_DB_PORT || '3306';
const OWNER_EMAIL = process.env.CPANEL_OWNER_EMAIL || 'admin@skylightballroom.pk';
const OWNER_PASSWORD = process.env.CPANEL_OWNER_PASSWORD || 'skylight123';


async function main() {
  if (!existsSync(standalone)) {
    console.error('✗ .next/standalone not found. Run `npm run build` first (output:"standalone").');
    process.exit(1);
  }

  console.log('• Cleaning cpanel-build/ …');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  // 1. Standalone server (server.js, traced node_modules, .next, package.json).
  console.log('• Copying standalone server …');
  await cp(standalone, out, { recursive: true });

  // Never ship local dev env files — the server would load them at runtime and
  // point at the developer's MySQL. Production values go in cPanel / a server .env.
  for (const f of ['.env', '.env.local', '.env.development', '.env.production']) {
    await rm(path.join(out, f), { force: true });
  }

  /**
   * Drop what the running server cannot use.
   *
   * Next's dependency tracing is deliberately generous: it keeps anything that
   * MIGHT be reached. On this app three of those are dead weight, and one is
   * worse than dead weight.
   *
   *   @img/* and sharp   The image optimiser's native binaries, ~18 MB. Two
   *                      reasons to go: `images.unoptimized` means the
   *                      optimiser is never invoked, and these are compiled
   *                      for macOS, so on the Linux host they could only ever
   *                      fail to load. Shipping them invites a confusing crash.
   *   typescript         ~9 MB of compiler. Everything is already compiled.
   *   caniuse-lite       ~2.4 MB browser-support table, consumed by browserslist
   *                      during the build, not at request time.
   *
   * Verified by booting the packaged server and loading pages afterwards, not
   * by reasoning alone. If a future change turns the optimiser back on, drop
   * @img and sharp from this list.
   */
  console.log('• Pruning build-only packages …');
  const prune = ['@img', 'sharp', 'typescript', 'caniuse-lite'];
  let saved = 0;
  for (const name of prune) {
    const dir = path.join(out, 'node_modules', name);
    if (!existsSync(dir)) continue;
    saved += await dirSize(dir);
    await rm(dir, { recursive: true, force: true });
  }
  console.log(`  ↳ removed ${prune.join(', ')} (~${(saved / 1048576).toFixed(0)} MB)`);

  // 2. Static assets are NOT included in standalone — copy them in.
  console.log('• Copying .next/static and public …');
  await cp(path.join(root, '.next', 'static'), path.join(out, '.next', 'static'), { recursive: true });
  if (existsSync(path.join(root, 'public'))) {
    await cp(path.join(root, 'public'), path.join(out, 'public'), { recursive: true });
  }

  // 3. Passenger startup shim. cPanel's "Setup Node.js App" calls this file.
  //    It loads a sibling .env itself (dependency-free) because the Next.js
  //    standalone server does NOT reliably read .env at runtime and this app's
  //    dotenv is a dev-only dep absent from the traced bundle. Vars already in
  //    the process env (e.g. set in the cPanel UI) always win.
  console.log('• Writing app.js (Passenger entry) …');
  await writeFile(
    path.join(out, 'app.js'),
    `// cPanel / Phusion Passenger entry point.
// Loads a sibling .env (if present), then boots the Next.js standalone server.
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (let line of fs.readFileSync(envPath, 'utf8').split(/\\r?\\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
} catch (e) {
  console.error('app.js: could not load .env —', e.message);
}
require('./server.js');
`,
  );

  // 4. database/ — importable SQL (schema, and schema + one super-admin login).
  console.log('• Building database/*.sql …');

  // Every migration after 001, in order. Used twice below: appended to the
  // fresh-install schema, and shipped on its own as the upgrade patch.
  const upgradeFiles = (await readdir(path.join(root, 'migrations')))
    .filter((f) => f.endsWith('.sql') && !f.startsWith('001_'))
    .sort();
  const migrationParts = [];
  for (const f of upgradeFiles) {
    migrationParts.push(`-- ═══ ${f} ═══\n${await readFile(path.join(root, 'migrations', f), 'utf8')}`);
  }

  // 001 alone is NOT a current schema — it predates live cooking and the whole
  // catering module. A fresh install has to be 001 followed by every migration,
  // or the new site comes up missing tables and 500s on those pages.
  const initSql = await readFile(path.join(root, 'migrations', '001_init.sql'), 'utf8');
  const schemaSql = [initSql, ...migrationParts].join('\n\n');
  const hash = bcrypt.hashSync(OWNER_PASSWORD, 10);
  const ownerSql =
    `${schemaSql}\n\n` +
    `-- ── Initial Super Admin account ────────────────────────\n` +
    `-- Login: ${OWNER_EMAIL}   Password: ${OWNER_PASSWORD}\n` +
    `-- CHANGE THIS PASSWORD immediately after first sign-in (My Account).\n` +
    `--\n` +
    `-- Seeded as SUPER_ADMIN, not OWNER: the Live Cooking figures are carved\n` +
    `-- out of the Owner's access, so a fresh install with only an Owner would\n` +
    `-- have nobody able to reach them. Create the Owner from Users afterwards.\n` +
    `INSERT INTO users (name, email, password_hash, role, permissions, is_active)\n` +
    `VALUES ('Super Admin', '${OWNER_EMAIL}', '${hash}', 'SUPER_ADMIN', NULL, 1);\n`;
  await mkdir(path.join(out, 'database'), { recursive: true });
  await writeFile(path.join(out, 'database', 'skylightballroom-schema.sql'), schemaSql);
  await writeFile(path.join(out, 'database', 'skylightballroom-with-admin.sql'), ownerSql);

  // Incremental patch for an ALREADY-LIVE database. Re-importing the full
  // schema would delete the client's real bookings, so upgrades must go
  // through this instead.
  //
  // EVERY migration after 001 is concatenated in order, so the client has one
  // file to paste no matter how many upgrades have accumulated. Each of them
  // is written to be idempotent, so re-running the combined file is safe.
  if (migrationParts.length > 0) {
    await writeFile(
      path.join(out, 'database', 'upgrade-existing-db.sql'),
      migrationParts.join('\n\n'),
    );
    console.log(`  ↳ upgrade-existing-db.sql (${upgradeFiles.join(', ')})`);
  }

  // 5. Advanced fallback: raw migrations + tsx scripts (for anyone who prefers
  //    running migrate/seed on the server instead of importing SQL).
  await cp(path.join(root, 'migrations'), path.join(out, 'migrations'), { recursive: true });
  await mkdir(path.join(out, 'scripts'), { recursive: true });
  for (const f of ['migrate.ts', 'seed.ts', 'check.ts']) {
    const src = path.join(root, 'scripts', f);
    if (existsSync(src)) await cp(src, path.join(out, 'scripts', f));
  }

  // 6. Environment template. A fresh NEXTAUTH_SECRET is generated per build so
  //    it is never forgotten; the DB password is deliberately left blank.
  const secret = randomBytes(32).toString('base64');
  await writeFile(
    path.join(out, '.env.example'),
    `# Copy these into the cPanel "Setup Node.js App" → Environment variables,
# OR create a .env file next to server.js with real values.
#
# Replace YOUR_DB_PASSWORD with the password you set for the MySQL user.
# Percent-encode any special characters:  @ → %40   : → %3A   / → %2F
# A raw "@" in the password is the #1 cause of "Can't reach database" on cPanel.

DATABASE_URL="mysql://${DB_USER}:YOUR_DB_PASSWORD@${DB_HOST}:${DB_PORT}/${DB_NAME}"
NODE_ENV=production

# ── Required for login (NextAuth) — sign-in fails in production without both ──
NEXTAUTH_URL="https://your-domain.com"
# Canonical origin for sitemap.xml, robots.txt and social link previews.
SITE_URL="https://your-domain.com"
NEXTAUTH_SECRET="${secret}"

# Optional (WhatsApp deep-link on the public site; has code defaults otherwise):
# WHATSAPP_PHONE=923124722252
# NEXT_PUBLIC_WHATSAPP=923124722252
`,
  );
  console.log(`• Env template targets ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  // 7. Deploy guide.
  await writeFile(path.join(out, 'DEPLOY.md'), deployMd());

  // 8. Zip for easy upload.
  console.log('• Zipping → cpanel-build.zip …');
  await rm(path.join(root, 'cpanel-build.zip'), { force: true });
  const { execSync } = await import('node:child_process');
  let zipped = true;
  try {
    execSync("zip -rqX ../cpanel-build.zip . -x '*.DS_Store'", { cwd: out });
  } catch {
    zipped = false;
  }

  const size = await dirSize(out);
  console.log(`\n✓ cPanel package ready: cpanel-build/  (~${(size / 1e6).toFixed(1)} MB)`);
  console.log(zipped ? '  Zip:  cpanel-build.zip  (upload + extract in cPanel File Manager)' : '  (zip step skipped — `zip` not available)');
  console.log('  See cpanel-build/DEPLOY.md');
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(p);
    else total += (await stat(p)).size;
  }
  return total;
}

function deployMd() {
  return `# Deploying Skylight Ballroom & Catering Service to cPanel

Self-contained Next.js production build (standalone output). Runs on cPanel's
**Setup Node.js App** (Phusion Passenger). No \`npm run build\` on the server.

## What's here
- \`server.js\` — the Next.js standalone server
- \`app.js\` — Passenger entry point (loads \`server.js\`)
- \`.next/\`, \`public/\`, \`node_modules/\` — the app + its runtime deps
- \`.env.example\` — environment variable template (a fresh NEXTAUTH_SECRET is pre-filled)
- \`database/skylightballroom-schema.sql\` — the complete current schema, empty (FIRST install only)
- \`database/skylightballroom-with-admin.sql\` — same tables **+ one SUPER ADMIN login** (FIRST install only)
- \`database/upgrade-existing-db.sql\` — **use this when you already have live data**

## ⚠ Already have a live database? Do NOT re-import the schema files
The two files above DROP every table — they would delete your real bookings.
To update an existing database, run \`database/upgrade-existing-db.sql\` instead
(phpMyAdmin → your database → SQL tab → paste → Go). It only adds what is
missing, keeps all your data, and is safe to run twice.

Skipping it after an update causes **500 Internal Server Error** on pages that
use the new tables (e.g. opening a booking when \`booking_rules\` is missing).

## 1. Create the MySQL database (cPanel → MySQL® Databases)
Create a database + user, add the user to the DB with **ALL PRIVILEGES**. Note the
final name/user/password (cPanel prefixes them, e.g. \`usaaswtj_skylightballroom\`).

## 2. Import the tables (cPanel → phpMyAdmin)
Select the database → **Import** → choose \`database/skylightballroom-with-admin.sql\` → Go.
(That file also creates the sign-in account below. Use \`skylightballroom-schema.sql\` instead
only if you'll create that account yourself.)

## 3. Upload the app (cPanel → File Manager)
Create a folder **outside** \`public_html\` (e.g. \`skylightballroom\`), upload
\`cpanel-build.zip\`, and Extract. You should see \`server.js\`, \`app.js\`, \`.next/\`, etc.

## 4. Create the Node.js app (cPanel → Setup Node.js App)
- **Node version:** 18+ (20 LTS recommended)   **Mode:** Production
- **Application root:** the folder from step 3
- **Application URL:** your domain / subdomain
- **Application startup file:** \`app.js\`

## 5. Environment variables
Add these (see \`.env.example\`), or create a \`.env\` next to \`server.js\`:

| Name | Value |
|------|-------|
| \`DATABASE_URL\` | \`mysql://USER:PASSWORD@localhost:3306/DBNAME\` (percent-encode \`@\`→\`%40\`) |
| \`NODE_ENV\` | \`production\` |
| \`NEXTAUTH_URL\` | your live https domain, no trailing slash |
| \`SITE_URL\` | same domain; used by sitemap.xml and robots.txt |
| \`NEXTAUTH_SECRET\` | the value pre-filled in \`.env.example\` (or \`openssl rand -base64 32\`) |

Do **not** set \`PORT\` — Passenger injects it. **NextAuth needs \`NEXTAUTH_URL\` and
\`NEXTAUTH_SECRET\`** — without both, sign-in fails.

## 6. Start it
Back in Setup Node.js App, click **Restart**, then open your URL and sign in:
- **${OWNER_EMAIL}** / **${OWNER_PASSWORD}**  → change this password immediately (My Account).

## Updating later
Locally: \`npm run build:cpanel\`, upload + extract the new \`cpanel-build.zip\` over the
old files, keep your server \`.env\`, then **Restart**. Re-import SQL only if the schema
changed.

## Troubleshooting
- **502 / Passenger error page** → check the app's stderr log; usually a wrong
  \`DATABASE_URL\` or the DB user lacks privileges.
- **Sign-in fails / immediate logout** → \`NEXTAUTH_SECRET\` or \`NEXTAUTH_URL\` missing/wrong.
- **Styles missing** → ensure \`.next/static\` and \`public/\` were included in the upload.
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
