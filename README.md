# Skylight Ballroom & Catering Service — Booking, POS & Accounting Platform

Production-grade platform for Skylight Ballroom & Catering Service (Karachi). Next.js 15 · TypeScript · raw MySQL (mysql2, **no ORM**) · Tailwind · Framer Motion · react-three-fiber · NextAuth.

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

### Demo logins (password `skylight123`)
| Role | Email | Sees |
|------|-------|------|
| **Super Admin** (Areeb) | `areeb@skylightballroom.com` | Everything the Owner sees **plus the Live Cooking figures** (password `Skylight123`) |
| Super Admin | `admin@skylightballroom.pk` | Same as above |
| Owner (Usama) | `usama@skylightballroom.pk` | Everything except the Live Cooking breakdown — net profit, reconciliation, user management |
| Manager (Naseem) | `naseem@skylightballroom.pk` | Bookings, petty cash, float, sale — **no net profit** |
| Viewer | `viewer@skylightballroom.pk` | Read-only bookings |

## Scripts
- `npm run db:migrate` — create/reset schema (`migrations/001_init.sql`, then the numbered upgrades)
- `npm run db:seed` — seed demo data
- `npm run db:reset` — migrate + seed
- `npm run icons` — regenerate the favicon, PWA icons and `logo.png` from the vector mark
- `npm test` — accounting engine unit tests (20 assertions)
- `npm run build` — production build
- `npm run build:cpanel` — production build + deployable `cpanel-build/` bundle and zip

## Architecture

- **Accounting engine** (`src/lib/accounting/`) — all derived money figures are computed here in **pure, unit-tested** functions. Never in components. Key rule: **Naseem Return is a profit recovery, added back — never an expense line.**
- **Data layer** (`src/lib/data.ts`) — raw parameterised SQL; feeds the engine.
- **Auth/RBAC** (`src/lib/auth.ts`, `permissions.ts`) — NextAuth credentials + bcrypt, role + granular per-user permissions in the JWT. Owner-configurable per user under **Users**. Roles rank `SUPER_ADMIN > OWNER > MANAGER > ACCOUNTANT > SUPERVISOR > RECEPTIONIST > VIEWER`; `effectiveCan` is the single place role shortcuts are decided.
- **Audit** (`src/lib/audit.ts`) — every mutation writes to `audit_log`.
- **Money** is always `DECIMAL(12,2)`; multi-table writes use transactions (`withTransaction`).

## Modules
Dashboard · Calendar · Bookings POS (two-amount model + itemizer + slip + payments) · Petty Cash matrix (spreadsheet, autosave, month-lock) · Manager Float ledger · Monthly Sale · **Live Cooking** · Income Statement · Reports (print pack) · Leads · Users & Access · Settings · Public marketing site (3D hero + WhatsApp CTA + enquiry form).

## Live Cooking & the Super Admin role

**Live Cooking Stall** is an ordinary banquet service. Staff add it to a booking from the
services itemizer exactly like Generator or Valet Parking, it prints on the slip as its own
line, and its money is already inside the booking total and the Income Statement — there is
no second set of books.

What *is* separate is the **reporting**. Every service line is stamped
`booking_service_items.service_kind` on save (`BANQUET` or `LIVE_COOKING`), derived from the
label in `writeServiceItems`, so no screen can forget to tag it. The **Live Cooking** page
(`/app/live-cooking`) then pulls those lines back out on their own: revenue, share of total
service revenue, which bookings bought it, and how it compares with every other service.

That page is gated by the `livecooking.view` permission, which is **carved out of the Owner's
implicit "the Owner can do anything" shortcut** (`effectiveCan` in `src/lib/permissions.ts`).
So:

- **SUPER_ADMIN** — holds it, and is the only role that does by default.
- **OWNER** — sees the Live Cooking service on bookings like anyone else, but gets no sidebar
  entry and is redirected away from `/app/live-cooking`.
- Anyone else — can be granted it explicitly, per user, from **Users → Access**.

Rename the service in one place (`LIVE_COOKING_SERVICE` in `src/lib/service-presets.ts`) and
the preset list, the tagging and the reports all follow.

## Notes
- **User creation is owner-driven** (behind the `users.manage` permission), not open public sign-up — appropriate for an internal financial system. Any user granted `users.manage` can create others and assign granular access (e.g. a finance manager).
- **Print**: every accounting screen + Reports has a working print view (A4, monochrome-safe). Use the browser's Print → Save as PDF.
- **Branding** lives in Settings → Business Profile (name, contacts, socials). The **tagline must be the tail of the business name** (`Ballroom & Catering Service` for `Skylight Ballroom & Catering Service`) — the print letterhead strips it from the big wordmark line so the slip reads *Skylight* large with the tagline underneath and in the vector
  mark in `src/components/brand.tsx`. `npm run icons` re-renders every PNG from that same
  geometry, so the favicon, PWA icons and `logo.png` never drift from the on-screen logo.
- **Booking slips** are numbered `SKY-YYYY-NN` (enquiries `INQ-YYYY-NN`). Slips already issued
  under an older prefix keep their numbers.
- `sale_attribution` setting (Settings screen) toggles sale crediting between **event month** (default) and **settlement month**.
