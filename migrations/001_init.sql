-- ═══════════════════════════════════════════════════════════════
-- SKYLIGHT BALLROOM — Schema (raw MySQL, no ORM)
-- All money DECIMAL(12,2). InnoDB + utf8mb4.
-- ═══════════════════════════════════════════════════════════════
SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- Legacy tables from earlier schemas, cleared so a reset starts truly empty.
DROP TABLE IF EXISTS live_kitchen_payments;
DROP TABLE IF EXISTS live_kitchen_order_items;
DROP TABLE IF EXISTS live_kitchen_orders;
DROP TABLE IF EXISTS live_kitchen_items;
DROP TABLE IF EXISTS inquiry_items;
DROP TABLE IF EXISTS inquiries;
DROP TABLE IF EXISTS petty_cash_closings;
DROP TABLE IF EXISTS employee_advances;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS stock_items;
DROP TABLE IF EXISTS stock_categories;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS notification_reads;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS salary_payments;
DROP TABLE IF EXISTS loan_repayments;
DROP TABLE IF EXISTS employee_loans;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS rules;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS income_adjustments;
DROP TABLE IF EXISTS monthly_locks;
DROP TABLE IF EXISTS manager_disbursements;
DROP TABLE IF EXISTS petty_cash_entries;
DROP TABLE IF EXISTS expense_heads;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_date_changes;
DROP TABLE IF EXISTS booking_rules;
DROP TABLE IF EXISTS booking_service_items;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS halls;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;

SET foreign_key_checks = 1;

-- ── Users ──────────────────────────────────────────────
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('SUPER_ADMIN','OWNER','MANAGER','ACCOUNTANT','SUPERVISOR','RECEPTIONIST','VIEWER') NOT NULL DEFAULT 'VIEWER',
  permissions   JSON NULL,
  -- Optional link to this person's staff record, so a portal user who is also
  -- on the payroll (a manager, a supervisor) turns up in Attendance and on the
  -- salary sheet. NULL = login only, not staff. Added after `employees`.
  employee_id   INT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Signed-in devices ──────────────────────────────────
-- One row per device a user has signed in from. `sid` is a random id minted
-- into the JWT at sign-in, so revoking a row signs that device out even though
-- sessions are otherwise stateless (JWT strategy).
CREATE TABLE user_sessions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  sid          CHAR(36) NOT NULL,
  user_agent   VARCHAR(400) NULL,
  device_label VARCHAR(120) NULL,
  -- Owner-supplied name ("Reception iPad"). Wins over device_label when set,
  -- which is how an "Unknown device" gets a useful name.
  custom_label VARCHAR(120) NULL,
  ip           VARCHAR(64) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at   DATETIME NULL,
  CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sess_sid (sid),
  INDEX idx_sess_user (user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Halls ──────────────────────────────────────────────
CREATE TABLE halls (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  capacity    INT NOT NULL DEFAULT 0,
  base_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  description VARCHAR(500) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Parties ────────────────────────────────────────────
CREATE TABLE parties (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  party_name VARCHAR(160) NOT NULL,
  -- bride_name/groom_name retained for older records; no longer captured.
  bride_name VARCHAR(120) NULL,
  groom_name VARCHAR(120) NULL,
  phone      VARCHAR(40) NULL,
  phone2     VARCHAR(40) NULL,
  address    VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Bookings ───────────────────────────────────────────
CREATE TABLE bookings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  slip_no        VARCHAR(40) NOT NULL UNIQUE,
  party_id       INT NOT NULL,
  hall_id        INT NOT NULL,
  booking_date   DATE NOT NULL,
  event_date     DATE NOT NULL,
  shift          ENUM('LUNCH','DINNER') NOT NULL DEFAULT 'DINNER',
  guest_count    INT NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  banquet_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- RETURNED = event called off and the customer's money paid back.
  status         ENUM('ENQUIRY','CONFIRMED','COMPLETED','CANCELLED','RETURNED') NOT NULL DEFAULT 'CONFIRMED',
  refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  refunded_at     DATETIME NULL,
  date_change_count TINYINT NOT NULL DEFAULT 0,
  payment_status ENUM('PENDING','PARTIAL','SETTLED') NOT NULL DEFAULT 'PENDING',
  notes          TEXT NULL,
  created_by     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_book_party FOREIGN KEY (party_id) REFERENCES parties(id),
  CONSTRAINT fk_book_hall  FOREIGN KEY (hall_id)  REFERENCES halls(id),
  INDEX idx_book_event (event_date),
  INDEX idx_book_booking (booking_date),
  -- Not UNIQUE: enquiries (tentative quotes) may share a hall/date/shift with
  -- each other and with a real booking. Slot uniqueness for CONFIRMED/COMPLETED
  -- bookings is enforced in application code (see createBooking / convertEnquiry).
  INDEX idx_hall_slot (hall_id, event_date, shift)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Booking service items (Banquet Amount itemization) ─
CREATE TABLE booking_service_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  label      VARCHAR(160) NOT NULL,
  qty        DECIMAL(10,2) NOT NULL DEFAULT 1,
  rate       DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal   DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_svc_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Per-booking rules (printed as the slip's Terms & Conditions) ──
-- The rule TEXT is snapshotted, not referenced: an invoice already handed to a
-- customer must not change if someone later edits or deletes the master rule.
CREATE TABLE booking_rules (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  text       VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_brule_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_brule_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Event-date reschedules (max 3 per booking) ────────
-- One row per change so the slip can print "1st / 2nd / 3rd event date" with
-- the booking value at the time of each move.
CREATE TABLE booking_date_changes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  seq         TINYINT NOT NULL,          -- 1, 2 or 3
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,  -- booking total when moved
  reason      VARCHAR(255) NULL,
  changed_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bdc_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bdc_seq (booking_id, seq),
  INDEX idx_bdc_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Payments (many per booking) ────────────────────────
CREATE TABLE payments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  method       VARCHAR(40) NOT NULL DEFAULT 'CASH',
  received_by  INT NULL,
  note         VARCHAR(255) NULL,
  CONSTRAINT fk_pay_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_pay_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Expense heads (admin configurable) ─────────────────
CREATE TABLE expense_heads (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  has_qty_note TINYINT(1) NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Petty cash entries ─────────────────────────────────
CREATE TABLE petty_cash_entries (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  entry_date      DATE NOT NULL,
  expense_head_id INT NOT NULL,
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  qty_note        VARCHAR(80) NULL,
  booking_id      INT NULL,
  disbursement_id INT NULL,
  entered_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pc_head FOREIGN KEY (expense_head_id) REFERENCES expense_heads(id),
  INDEX idx_date_head (entry_date, expense_head_id),
  INDEX idx_pc_date (entry_date),
  INDEX idx_pc_disb (disbursement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Manager disbursements (float ledger) ───────────────
CREATE TABLE manager_disbursements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  slip_no         VARCHAR(40) NULL,
  booking_id      INT NULL,
  disbursed_by    INT NOT NULL,
  disbursed_to    INT NOT NULL,
  amount_disbursed DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_disbursed  DATE NOT NULL,
  amount_returned DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_returned   DATE NULL,
  status          ENUM('OPEN','RECONCILED','DISPUTED') NOT NULL DEFAULT 'OPEN',
  note            VARCHAR(255) NULL,
  INDEX idx_disb_date (date_disbursed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Monthly locks ──────────────────────────────────────
CREATE TABLE monthly_locks (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  year      INT NOT NULL,
  month     INT NOT NULL,
  locked_by INT NULL,
  locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lock (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Income adjustments (owner-only manual overrides) ───
CREATE TABLE income_adjustments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  year              INT NOT NULL,
  month             INT NOT NULL,
  expense_head_id   INT NOT NULL,
  adjustment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason            VARCHAR(255) NOT NULL,
  made_by           INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adj_head FOREIGN KEY (expense_head_id) REFERENCES expense_heads(id),
  INDEX idx_adj_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Leads (public enquiries) ───────────────────────────
CREATE TABLE leads (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(40) NOT NULL,
  event_date DATE NULL,
  message    VARCHAR(500) NULL,
  source     VARCHAR(40) NOT NULL DEFAULT 'WEBSITE',
  status     ENUM('NEW','CONTACTED','CONVERTED','CLOSED') NOT NULL DEFAULT 'NEW',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Audit log ──────────────────────────────────────────
CREATE TABLE audit_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  action      VARCHAR(40) NOT NULL,
  entity      VARCHAR(60) NOT NULL,
  entity_id   VARCHAR(60) NULL,
  before_json JSON NULL,
  after_json  JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity, entity_id),
  INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Settings (key/value) ───────────────────────────────
CREATE TABLE settings (
  `key`   VARCHAR(80) PRIMARY KEY,
  `value` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Rules / policies (admin-managed) ───────────────────
CREATE TABLE rules (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  -- Description is optional: a rule is often a single self-explanatory line.
  body       VARCHAR(1000) NOT NULL DEFAULT '',
  category   VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Employees (staff for attendance; not system users) ─
CREATE TABLE employees (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(40) NULL,
  designation VARCHAR(80) NOT NULL DEFAULT 'Staff',
  monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Loan carried forward from before the system went live (paper ledger).
  loan_opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  joined_date DATE NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Employee loans ─────────────────────────────────────
CREATE TABLE employee_loans (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_taken  DATE NOT NULL,
  note        VARCHAR(255) NULL,
  is_settled  TINYINT(1) NOT NULL DEFAULT 0,
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_loan_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Loan repayments (via salary deduction or manual) ───
CREATE TABLE loan_repayments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  loan_id           INT NOT NULL,
  employee_id       INT NOT NULL,
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
  repay_date        DATE NOT NULL,
  salary_payment_id INT NULL,
  note              VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repay_loan FOREIGN KEY (loan_id) REFERENCES employee_loans(id) ON DELETE CASCADE,
  INDEX idx_repay_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary payments (monthly disbursement) ─────────────
CREATE TABLE salary_payments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  employee_id       INT NOT NULL,
  year              INT NOT NULL,
  month             INT NOT NULL,
  base_salary       DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Columns mirroring the owner's paper salary sheet.
  work_days         DECIMAL(6,2) NOT NULL DEFAULT 0,
  attend_days       DECIMAL(6,2) NOT NULL DEFAULT 0,
  absent_days       DECIMAL(6,2) NOT NULL DEFAULT 0,
  absence_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  loan_deduction    DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_deduction   DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_pay         DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_paid          DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_date         DATE NOT NULL,
  note              VARCHAR(255) NULL,
  paid_by           INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sal_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sal_period (employee_id, year, month),
  INDEX idx_sal_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Attendance ─────────────────────────────────────────
CREATE TABLE attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  att_date    DATE NOT NULL,
  status      ENUM('PRESENT','ABSENT','LATE','LEAVE') NOT NULL DEFAULT 'PRESENT',
  note        VARCHAR(200) NULL,
  marked_by   INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_emp_date (employee_id, att_date),
  INDEX idx_att_date (att_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Comments Card (guest feedback after an event) ───────
-- Mirrors the printed card: seven categories, each Excellent / Good / Poor,
-- a free-text box and the guest's own contact details. A row is created when
-- staff issue the link (submitted_at NULL) and filled in when the guest submits.
CREATE TABLE reviews (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  booking_id     INT NULL,
  token          CHAR(32) NOT NULL,
  guest_name     VARCHAR(120) NULL,
  guest_phone    VARCHAR(40) NULL,
  event_date     DATE NULL,
  r_services     ENUM('EXCELLENT','GOOD','POOR') NULL,
  r_crockery     ENUM('EXCELLENT','GOOD','POOR') NULL,
  r_cleanliness  ENUM('EXCELLENT','GOOD','POOR') NULL,
  r_atmosphere   ENUM('EXCELLENT','GOOD','POOR') NULL,
  r_manager      ENUM('EXCELLENT','GOOD','POOR') NULL,
  r_head_waiter  ENUM('EXCELLENT','GOOD','POOR') NULL,
  r_overall      ENUM('EXCELLENT','GOOD','POOR') NULL,
  comments       VARCHAR(1000) NULL,
  submitted_at   DATETIME NULL,
  -- Published by default: the owner curates by hiding or deleting, so a happy
  -- guest's card reaches the website without anyone having to remember to act.
  is_published   TINYINT(1) NOT NULL DEFAULT 1,
  issued_by      INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Named fk_reviews_booking (plural): FK names are unique per SCHEMA in MySQL,
  -- and an older, unused `event_reviews` table already claims fk_review_booking.
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  UNIQUE KEY uq_review_token (token),
  INDEX idx_reviews_booking (booking_id),
  INDEX idx_reviews_pub (is_published, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- users.employee_id → employees.id. Declared here rather than inline because
-- `users` is created before `employees`.
ALTER TABLE users
  ADD CONSTRAINT fk_user_employee FOREIGN KEY (employee_id)
  REFERENCES employees(id) ON DELETE SET NULL;

-- ── Notifications ──────────────────────────────────────
-- Raised whenever a booking or enquiry arrives. Shown in the app's bell menu
-- and, for anyone who has allowed it, pushed to their device by the browser.
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('BOOKING','ENQUIRY','LEAD','PAYMENT','REVIEW') NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(500) NULL,
  -- Where the bell menu sends you when the notification is clicked.
  url        VARCHAR(255) NULL,
  entity     VARCHAR(40) NULL,
  entity_id  INT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_created (created_at),
  INDEX idx_notif_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Read state is per user: one notification is seen by several staff.
CREATE TABLE notification_reads (
  notification_id INT NOT NULL,
  user_id         INT NOT NULL,
  read_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_nread_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_nread_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per browser that has granted notification permission.
CREATE TABLE push_subscriptions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  endpoint     VARCHAR(500) NOT NULL,
  p256dh       VARCHAR(255) NOT NULL,
  auth         VARCHAR(255) NOT NULL,
  device_label VARCHAR(120) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- Endpoints are long; a 191-char prefix is unique in practice and fits the
  -- utf8mb4 index limit.
  UNIQUE KEY uq_push_endpoint (endpoint(191)),
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Stock / inventory ──────────────────────────────────
CREATE TABLE stock_categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stock_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  category_id   INT NULL,
  name          VARCHAR(140) NOT NULL,
  -- Matches a banquet service line by label, so "Cold Drinks × 240" on a
  -- booking can draw 240 out of this item automatically.
  service_label VARCHAR(160) NULL,
  kind          ENUM('DURABLE','CONSUMABLE') NOT NULL DEFAULT 'DURABLE',
  unit          VARCHAR(24) NOT NULL DEFAULT 'piece',
  opening_qty   DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes         VARCHAR(500) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_item_cat FOREIGN KEY (category_id)
    REFERENCES stock_categories(id) ON DELETE SET NULL,
  UNIQUE KEY uq_stock_item_name (name),
  INDEX idx_stock_item_cat (category_id),
  INDEX idx_stock_item_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_movements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  item_id         INT NOT NULL,
  kind            ENUM('PURCHASE','ISSUE','RETURN','BREAKAGE','LOSS','ADJUSTMENT') NOT NULL,
  qty             DECIMAL(12,2) NOT NULL,
  unit_cost       DECIMAL(12,2) NULL,
  booking_id      INT NULL,
  service_item_id INT NULL,
  -- BOOKING rows are generated from a booking's service lines and are replaced
  -- wholesale when that booking is edited; MANUAL rows are never touched.
  source          ENUM('MANUAL','BOOKING') NOT NULL DEFAULT 'MANUAL',
  moved_on        DATE NOT NULL,
  note            VARCHAR(500) NULL,
  created_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sm_item FOREIGN KEY (item_id)
    REFERENCES stock_items(id) ON DELETE CASCADE,
  -- A deleted booking must not take the breakage record with it: the
  -- stock still broke, so the movement survives and simply loses its link.
  CONSTRAINT fk_sm_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE SET NULL,
  INDEX idx_sm_item (item_id),
  INDEX idx_sm_date (moved_on),
  INDEX idx_sm_booking (booking_id),
  INDEX idx_sm_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary advances (distinct from loans) ──────────────
CREATE TABLE employee_advances (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  employee_id       INT NOT NULL,
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_date      DATE NOT NULL,
  note              VARCHAR(255) NULL,
  -- An advance is normally recovered in one go, but a part-recovery must
  -- not be lost.
  recovered         DECIMAL(12,2) NOT NULL DEFAULT 0,
  salary_payment_id INT NULL,
  is_settled        TINYINT(1) NOT NULL DEFAULT 0,
  created_by        INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_adv_emp (employee_id, is_settled),
  INDEX idx_adv_date (advance_date),
  CONSTRAINT fk_adv_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Petty cash day closing ─────────────────────────────
-- Confirming a day freezes what the manager spent and rolls whatever is still
-- in his hand onto the next date as that day's opening float.
CREATE TABLE petty_cash_closings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  close_date      DATE NOT NULL,
  brought_forward DECIMAL(12,2) NOT NULL DEFAULT 0,
  disbursed       DECIMAL(12,2) NOT NULL DEFAULT 0,
  expenses        DECIMAL(12,2) NOT NULL DEFAULT 0,
  returned        DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- brought_forward + disbursed - expenses - returned. Carries to the next day.
  closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  confirmed_by    INT NULL,
  confirmed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pcc_date (close_date),
  INDEX idx_pcc_date (close_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Columns the modules above hang off existing tables.
ALTER TABLE booking_service_items ADD COLUMN stock_item_id INT NULL AFTER label;
ALTER TABLE petty_cash_entries ADD COLUMN source ENUM('MANUAL','BOOKING') NOT NULL DEFAULT 'MANUAL';

-- Live Cooking is an ordinary banquet service line; this column is what lets
-- the Super Admin report on it separately without string-matching the label
-- (which staff can edit) on every query. Stamped on save from the label — see
-- `writeServiceItems` in src/lib/actions/bookings.ts.
ALTER TABLE booking_service_items
  ADD COLUMN service_kind ENUM('BANQUET','LIVE_COOKING') NOT NULL DEFAULT 'BANQUET' AFTER label,
  ADD INDEX idx_bsi_kind (service_kind);
