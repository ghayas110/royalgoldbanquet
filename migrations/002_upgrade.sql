-- ═══════════════════════════════════════════════════════════════
-- SKYLIGHT BALLROOM — incremental upgrade for an EXISTING database
--
-- Run this on a live database that already holds real bookings.
-- It only ADDS what is missing and KEEPS ALL YOUR DATA — nothing is
-- dropped or deleted. Safe to run more than once (every step checks first).
--
-- How to run: cPanel → phpMyAdmin → pick your database → SQL tab →
-- paste this whole file → Go.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. Per-booking rules (missing table causes a 500 on booking detail) ──
CREATE TABLE IF NOT EXISTS booking_rules (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  text       VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_brule_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_brule_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Event-date reschedules (max 3 per booking) ──
CREATE TABLE IF NOT EXISTS booking_date_changes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  seq         TINYINT NOT NULL,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason      VARCHAR(255) NULL,
  changed_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bdc_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bdc_seq (booking_id, seq),
  INDEX idx_bdc_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. bookings.notes ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE bookings ADD COLUMN notes TEXT NULL AFTER payment_status',
  'SELECT ''notes already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'notes');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 4. Refund / reschedule columns on bookings ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE bookings ADD COLUMN refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0',
  'SELECT ''refunded_amount already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'refunded_amount');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE bookings ADD COLUMN refunded_at DATETIME NULL',
  'SELECT ''refunded_at already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'refunded_at');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE bookings ADD COLUMN date_change_count TINYINT NOT NULL DEFAULT 0',
  'SELECT ''date_change_count already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'date_change_count');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 5. 'RETURNED' booking status ──
-- MODIFY is idempotent: re-running just rewrites the same definition.
ALTER TABLE bookings
  MODIFY COLUMN status ENUM('ENQUIRY','CONFIRMED','COMPLETED','CANCELLED','RETURNED')
  NOT NULL DEFAULT 'CONFIRMED';

-- ── 6. Secondary phone on the customer record ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE parties ADD COLUMN phone2 VARCHAR(40) NULL AFTER phone',
  'SELECT ''phone2 already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties' AND COLUMN_NAME = 'phone2');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- `address` exists in older schemas too, but add it if this DB predates it.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE parties ADD COLUMN address VARCHAR(255) NULL',
  'SELECT ''address already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties' AND COLUMN_NAME = 'address');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 7. Expense head used when a booking payment is returned ──
-- Guarded the same way as the ALTERs: a plain INSERT ... WHERE NOT EXISTS
-- against the table being inserted into duplicated the row on re-run.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'INSERT INTO expense_heads (name, sort_order, has_qty_note, is_active)
     VALUES (''Booking Refund'', (SELECT * FROM (SELECT COALESCE(MAX(sort_order),0)+1 FROM expense_heads) t), 0, 1)',
  'SELECT ''Booking Refund head already present''')
  FROM expense_heads WHERE name = 'Booking Refund');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 8. Rule description becomes optional ──
ALTER TABLE rules MODIFY COLUMN body VARCHAR(1000) NOT NULL DEFAULT '';

-- ── 9. Let enquiries share a hall/date/shift ──
-- The old UNIQUE KEY blocked a tentative enquiry on a slot another booking
-- touches. Uniqueness for CONFIRMED bookings is enforced in application code.
SET @sql := (SELECT IF(COUNT(*) > 0,
  'ALTER TABLE bookings DROP INDEX uq_hall_slot',
  'SELECT ''uq_hall_slot already removed''')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'uq_hall_slot');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE bookings ADD INDEX idx_hall_slot (hall_id, event_date, shift)',
  'SELECT ''idx_hall_slot already present''')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'idx_hall_slot');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 10. Signed-in devices (device list + remote sign-out) ──
CREATE TABLE IF NOT EXISTS user_sessions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  sid          CHAR(36) NOT NULL,
  user_agent   VARCHAR(400) NULL,
  device_label VARCHAR(120) NULL,
  ip           VARCHAR(64) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at   DATETIME NULL,
  CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sess_sid (sid),
  INDEX idx_sess_user (user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 11. Salary-sheet columns (to match the paper sheet) ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE employees ADD COLUMN loan_opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'loan_opening_balance');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE salary_payments ADD COLUMN work_days DECIMAL(6,2) NOT NULL DEFAULT 0',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_payments' AND COLUMN_NAME = 'work_days');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE salary_payments ADD COLUMN attend_days DECIMAL(6,2) NOT NULL DEFAULT 0',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_payments' AND COLUMN_NAME = 'attend_days');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE salary_payments ADD COLUMN advance_deduction DECIMAL(12,2) NOT NULL DEFAULT 0',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_payments' AND COLUMN_NAME = 'advance_deduction');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE salary_payments ADD COLUMN extra_pay DECIMAL(12,2) NOT NULL DEFAULT 0',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_payments' AND COLUMN_NAME = 'extra_pay');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 12. Comments Card / guest reviews ──
CREATE TABLE IF NOT EXISTS reviews (
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

-- ── 13. More user roles ──
-- Applied ONLY when the column still holds the original three-role list.
-- Re-running this unconditionally NARROWS the ENUM back to these six, which
-- truncates every SUPER_ADMIN and CATERING row added by later migrations —
-- silently demoting those accounts to ''. A migration may widen an ENUM on a
-- re-run; it must never shrink one.
SET @sql := (SELECT IF(
  LOCATE('ACCOUNTANT', COLUMN_TYPE) = 0,
  'ALTER TABLE users MODIFY COLUMN role ENUM(''OWNER'',''MANAGER'',''ACCOUNTANT'',''SUPERVISOR'',''RECEPTIONIST'',''VIEWER'') NOT NULL DEFAULT ''VIEWER''',
  'SELECT ''role ENUM already widened''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 14. Link a portal user to their staff record ──
-- Lets a manager who is also on the payroll appear in Attendance and on the
-- salary sheet. NULL means the account is a login only.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD COLUMN employee_id INT NULL',
  'SELECT ''employee_id already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'employee_id');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- One staff record per user, so two logins can't claim the same salary row.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_user_employee (employee_id)',
  'SELECT ''uq_user_employee already present''')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_user_employee');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_user_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL',
  'SELECT ''fk_user_employee already present''')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_user_employee');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 15. Rename a signed-in device ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE user_sessions ADD COLUMN custom_label VARCHAR(120) NULL AFTER device_label',
  'SELECT ''custom_label already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_sessions' AND COLUMN_NAME = 'custom_label');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 16. Notifications (new booking / enquiry alerts) ──
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('BOOKING','ENQUIRY','LEAD','PAYMENT','REVIEW') NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(500) NULL,
  url        VARCHAR(255) NULL,
  entity     VARCHAR(40) NULL,
  entity_id  INT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_created (created_at),
  INDEX idx_notif_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INT NOT NULL,
  user_id         INT NOT NULL,
  read_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_nread_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_nread_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  endpoint     VARCHAR(500) NOT NULL,
  p256dh       VARCHAR(255) NOT NULL,
  auth         VARCHAR(255) NOT NULL,
  device_label VARCHAR(120) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_push_endpoint (endpoint(191)),
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 17. Stock / inventory ──
CREATE TABLE IF NOT EXISTS stock_categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stock_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stock_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  category_id   INT NULL,
  name          VARCHAR(140) NOT NULL,
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

CREATE TABLE IF NOT EXISTS stock_movements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  item_id         INT NOT NULL,
  kind            ENUM('PURCHASE','ISSUE','RETURN','BREAKAGE','LOSS','ADJUSTMENT') NOT NULL,
  qty             DECIMAL(12,2) NOT NULL,
  unit_cost       DECIMAL(12,2) NULL,
  booking_id      INT NULL,
  service_item_id INT NULL,
  source          ENUM('MANUAL','BOOKING') NOT NULL DEFAULT 'MANUAL',
  moved_on        DATE NOT NULL,
  note            VARCHAR(500) NULL,
  created_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sm_item FOREIGN KEY (item_id)
    REFERENCES stock_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_sm_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE SET NULL,
  INDEX idx_sm_item (item_id),
  INDEX idx_sm_date (moved_on),
  INDEX idx_sm_booking (booking_id),
  INDEX idx_sm_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 18. Link banquet service lines to stock ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE booking_service_items ADD COLUMN stock_item_id INT NULL AFTER label',
  'SELECT ''booking_service_items.stock_item_id already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_service_items' AND COLUMN_NAME = 'stock_item_id');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 19. Salary advances ──
CREATE TABLE IF NOT EXISTS employee_advances (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  employee_id       INT NOT NULL,
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_date      DATE NOT NULL,
  note              VARCHAR(255) NULL,
  recovered         DECIMAL(12,2) NOT NULL DEFAULT 0,
  salary_payment_id INT NULL,
  is_settled        TINYINT(1) NOT NULL DEFAULT 0,
  created_by        INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_adv_emp (employee_id, is_settled),
  INDEX idx_adv_date (advance_date),
  CONSTRAINT fk_adv_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 20. Petty cash day closing ──
CREATE TABLE IF NOT EXISTS petty_cash_closings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  close_date      DATE NOT NULL,
  brought_forward DECIMAL(12,2) NOT NULL DEFAULT 0,
  disbursed       DECIMAL(12,2) NOT NULL DEFAULT 0,
  expenses        DECIMAL(12,2) NOT NULL DEFAULT 0,
  returned        DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  confirmed_by    INT NULL,
  confirmed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pcc_date (close_date),
  INDEX idx_pcc_date (close_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Upgrade complete — your data was not touched.' AS result;
