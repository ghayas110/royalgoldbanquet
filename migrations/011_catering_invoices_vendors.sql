-- ═══════════════════════════════════════════════════════════════
-- CATERING — INVOICES, VENDORS, AND THE EVENT LEDGER
--
-- Three things, all hanging off one idea: an event costs money to run, and
-- until the vendors are paid nobody knows what it earned.
--
--   1. INVOICES. A quotation is a pre-booking estimate. An invoice is what is
--      billed after the event, and the two are deliberately separate records
--      here: they carry their own line items and editing one never touches the
--      other. They share this table, distinguished by `doc_type`, because
--      otherwise every column, every query and every screen would exist twice.
--      An invoice remembers where it was copied from via `source_quotation_id`.
--
--   2. VENDORS and their bills. Catering buys from butchers, decorators,
--      crockery hire, transport. Each bill belongs to one event.
--
--   3. The EVENT LEDGER falls out of the two: revenue from the invoice, costs
--      from the vendor bills, profit is the difference.
--
-- Payables attach to the EVENT ROOT — the original quotation's id, or the
-- invoice's own id when it has no quotation behind it. That way a bill entered
-- before the invoice exists and one entered after land on the same event
-- instead of splitting the ledger in two.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. Quotation or invoice ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE catering_quotations ADD COLUMN doc_type ENUM(''QUOTATION'',''INVOICE'') NOT NULL DEFAULT ''QUOTATION'' AFTER quota_no',
  'SELECT ''doc_type already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotations' AND COLUMN_NAME = 'doc_type');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE catering_quotations ADD COLUMN source_quotation_id INT NULL AFTER doc_type',
  'SELECT ''source_quotation_id already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotations' AND COLUMN_NAME = 'source_quotation_id');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE catering_quotations ADD INDEX idx_cq_doctype (doc_type, quotation_date)',
  'SELECT ''doc_type index already present''')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotations' AND INDEX_NAME = 'idx_cq_doctype');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Invoices get their own series, so SC-18709 and SI-1 can coexist.
INSERT INTO settings (`key`, `value`)
SELECT * FROM (SELECT 'catering.invoice_prefix' AS k, 'SI' AS v) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE `key` = 'catering.invoice_prefix');

-- ── 2. Vendors ──
CREATE TABLE IF NOT EXISTS catering_vendors (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  category   VARCHAR(60) NOT NULL DEFAULT '',
  phone      VARCHAR(40) NOT NULL DEFAULT '',
  note       VARCHAR(500) NOT NULL DEFAULT '',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cvendor_name (name),
  INDEX idx_cvendor_active (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. What each event owes each vendor ──
-- `paid_amount` rather than a boolean: part payments to a butcher are normal,
-- and the ledger needs to show what is still outstanding, not just settled or
-- not.
CREATE TABLE IF NOT EXISTS catering_payables (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  event_id     INT NOT NULL,
  vendor_id    INT NULL,
  description  VARCHAR(200) NOT NULL DEFAULT '',
  amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date     DATE NULL,
  note         VARCHAR(500) NOT NULL DEFAULT '',
  created_by   INT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Constraint names are global to the schema, not per table: `catering_payments`
  -- from 004 already owns fk_cpay_*, so these carry the longer prefix.
  CONSTRAINT fk_cpayable_event FOREIGN KEY (event_id) REFERENCES catering_quotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cpayable_vendor FOREIGN KEY (vendor_id) REFERENCES catering_vendors(id) ON DELETE SET NULL,
  CONSTRAINT fk_cpayable_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_cpayable_event (event_id),
  INDEX idx_cpayable_vendor (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Starter vendor categories ──
-- Only into an empty table, so a second run never duplicates them.
INSERT INTO catering_vendors (name, category, phone)
SELECT * FROM (
  SELECT 'Butcher' AS n, 'MEAT' AS c, '' AS p UNION ALL
  SELECT 'Decorator', 'DECOR', '' UNION ALL
  SELECT 'Crockery Hire', 'CROCKERY', '' UNION ALL
  SELECT 'Transport', 'TRANSPORT', ''
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM catering_vendors LIMIT 1);
