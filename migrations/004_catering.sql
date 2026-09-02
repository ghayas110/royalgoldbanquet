-- ═══════════════════════════════════════════════════════════════
-- SKYLIGHT — CATERING
--
-- A business line run independently of the ballroom halls: its own customers,
-- its own quotation series (SC-…), its own staff login, its own books. Nothing
-- here joins to `bookings`, and no ballroom query joins to these tables — the
-- only place the two meet is the Super Admin's combined view.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. CATERING role ──
-- Sits at the bottom of the ENUM: it is not a rank above or below the ballroom
-- roles, it is a different business. Access is decided by permission, not rank.
SET @sql := (SELECT IF(
  LOCATE('CATERING', COLUMN_TYPE) = 0,
  'ALTER TABLE users MODIFY COLUMN role ENUM(''SUPER_ADMIN'',''OWNER'',''MANAGER'',''ACCOUNTANT'',''SUPERVISOR'',''RECEPTIONIST'',''VIEWER'',''CATERING'') NOT NULL DEFAULT ''VIEWER''',
  'SELECT ''CATERING already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 2. Customers ──
CREATE TABLE IF NOT EXISTS catering_customers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  phone      VARCHAR(40) NOT NULL DEFAULT '',
  phone2     VARCHAR(40) NOT NULL DEFAULT '',
  address    VARCHAR(400) NOT NULL DEFAULT '',
  note       VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ccust_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Menu / rate catalogue ──
-- `unit` is the KG/PCS column on the slip. `category` is the CATEGORIES column
-- (CHICKEN, BEEF B, BAR B Q, DEEP FRY …) and is free text, because the client
-- adds new ones constantly and a fixed ENUM would need a migration each time.
CREATE TABLE IF NOT EXISTS catering_menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  category     VARCHAR(60) NOT NULL DEFAULT '',
  unit         ENUM('KG','PCS') NOT NULL DEFAULT 'KG',
  default_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cmenu_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Quotations ──
CREATE TABLE IF NOT EXISTS catering_quotations (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  quota_no          VARCHAR(40) NOT NULL,
  customer_id       INT NULL,
  -- Snapshotted onto the quotation: the slip is handed over and must not
  -- change if the customer record is later edited.
  customer_name     VARCHAR(160) NOT NULL DEFAULT '',
  contact_no        VARCHAR(40) NOT NULL DEFAULT '',
  place_of_function VARCHAR(200) NOT NULL DEFAULT '',
  quotation_date    DATE NOT NULL,
  delivery_date     DATE NULL,
  persons           INT NOT NULL DEFAULT 0,
  -- DISH + CHARGE lines. The first TOTAL on the slip.
  items_total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- MEAT lines, added underneath to reach the grand total.
  meat_total        DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  status            ENUM('QUOTATION','CONFIRMED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'QUOTATION',
  note              VARCHAR(1000) NULL,
  created_by        INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cq_customer FOREIGN KEY (customer_id) REFERENCES catering_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_cq_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_cq_no (quota_no),
  INDEX idx_cq_date (quotation_date),
  INDEX idx_cq_delivery (delivery_date),
  INDEX idx_cq_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Quotation lines ──
-- One table for all three bands of the slip, distinguished by `section`:
--   DISH   the numbered dishes, with category and KG/PCS
--   CHARGE TRANSPORT / SERVICE — an amount with no qty or rate
--   MEAT   the raw meat supplied, listed under the first TOTAL
-- Keeping them in one table preserves the operator's row order within each
-- band and means the slip renders from a single ordered query.
CREATE TABLE IF NOT EXISTS catering_quotation_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  quotation_id  INT NOT NULL,
  section       ENUM('DISH','CHARGE','MEAT') NOT NULL DEFAULT 'DISH',
  menu_item_id  INT NULL,
  description   VARCHAR(200) NOT NULL,
  category      VARCHAR(60) NOT NULL DEFAULT '',
  qty           DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit          ENUM('KG','PCS') NOT NULL DEFAULT 'KG',
  rate          DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order    INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_cqi_quotation FOREIGN KEY (quotation_id) REFERENCES catering_quotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cqi_menu FOREIGN KEY (menu_item_id) REFERENCES catering_menu_items(id) ON DELETE SET NULL,
  INDEX idx_cqi_quotation (quotation_id, section, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. Receipts ──
CREATE TABLE IF NOT EXISTS catering_payments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  quotation_id INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  method       VARCHAR(40) NOT NULL DEFAULT 'CASH',
  received_by  INT NULL,
  note         VARCHAR(255) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cpay_quotation FOREIGN KEY (quotation_id) REFERENCES catering_quotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cpay_user FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_cpay_quotation (quotation_id),
  INDEX idx_cpay_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. Catering business profile ──
-- The catering arm trades under its own name, number and shop address, which
-- print on its slip instead of the ballroom's. Stored in `settings` under a
-- `catering.` prefix, mirroring how the ballroom profile is held.
INSERT INTO settings (`key`, `value`)
SELECT * FROM (
  SELECT 'catering.name'    AS k, 'Skylight Catering Service' AS v UNION ALL
  SELECT 'catering.person',        'M. Tahir'                        UNION ALL
  SELECT 'catering.phone',         '0300-2238418'                    UNION ALL
  SELECT 'catering.address',       'Shop No 1 Ground Floor # AM 32 Street No.1, Kaziq Road Burns Road, Karachi' UNION ALL
  SELECT 'catering.terms',         'Terms of Payment: 75% Advance & Balance After Program.' UNION ALL
  SELECT 'catering.note',          'Please note that prices quoted are based on prevailing price of meat which may change at the time of program. The revised rates will be applicable in billing if prices of meat increase.' UNION ALL
  SELECT 'catering.quota_prefix',  'SC'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE `key` LIKE 'catering.%' LIMIT 1);
