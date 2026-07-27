# Royal Gold Banquet — Booking, POS & Accounting Platform

Production-grade platform for Royal Gold Banquet (Karachi). Next.js 15 · TypeScript · raw MySQL (mysql2, **no ORM**) · Tailwind · Framer Motion · react-three-fiber · NextAuth.

Currency **PKR (Rs.)** · Locale **en-PK** · Dates **DD-MMM-YY**.

## Quick start

1. **MySQL** — start MAMP (MySQL on `localhost:8889`, user `root`, pass `root`). Creds live in `.env.local`.
2. **Install**
   ```bash
   npm install --legacy-peer-deps
   ```
3. **Create schema + seed a full month of June-2026 demo data**
   ```bash
   npm run db:reset
   ```
4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 (public site) · http://localhost:3000/login (staff portal).

### Demo logins (password `royal123`)
| Role | Email | Sees |
|------|-------|------|
| Owner (Usama) | `usama@royalgold.pk` | Everything incl. net profit, reconciliation, user management |
| Manager (Naseem) | `naseem@royalgold.pk` | Bookings, petty cash, float, sale — **no net profit** |
| Viewer | `viewer@royalgold.pk` | Read-only bookings |

## Scripts
- `npm run db:migrate` — create/reset schema (`migrations/001_init.sql`)
- `npm run db:seed` — seed demo data
- `npm run db:reset` — migrate + seed
- `npm test` — accounting engine unit tests (20 assertions)
- `npm run build` — production build

## Architecture

- **Accounting engine** (`src/lib/accounting/`) — all derived money figures are computed here in **pure, unit-tested** functions. Never in components. Key rule: **Naseem Return is a profit recovery, added back — never an expense line.**
- **Data layer** (`src/lib/data.ts`) — raw parameterised SQL; feeds the engine.
- **Auth/RBAC** (`src/lib/auth.ts`, `permissions.ts`) — NextAuth credentials + bcrypt, role + granular per-user permissions in the JWT. Owner-configurable per user under **Users**.
- **Audit** (`src/lib/audit.ts`) — every mutation writes to `audit_log`.
- **Money** is always `DECIMAL(12,2)`; multi-table writes use transactions (`withTransaction`).

## Modules
Dashboard · Calendar · Bookings POS (two-amount model + itemizer + slip + payments) · Petty Cash matrix (spreadsheet, autosave, month-lock) · Manager Float ledger · Monthly Sale · Income Statement · Reports (print pack) · Leads · Users & Access · Settings · Public marketing site (3D hero + WhatsApp CTA + enquiry form).

## Notes
- **User creation is owner-driven** (behind the `users.manage` permission), not open public sign-up — appropriate for an internal financial system. Any user granted `users.manage` can create others and assign granular access (e.g. a finance manager).
- **Print**: every accounting screen + Reports has a working print view (A4, monochrome-safe). Use the browser's Print → Save as PDF.
- `sale_attribution` setting (Settings screen) toggles sale crediting between **event month** (default) and **settlement month**.
