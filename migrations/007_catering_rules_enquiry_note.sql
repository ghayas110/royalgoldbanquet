-- ═══════════════════════════════════════════════════════════════
-- CATERING RULES, and an enquiry note that is no longer hard-coded
--
-- Two changes, both about text the client needs to change without a deploy.
--
--   1. Catering gets its own rules. The ballroom has two kinds — a reusable
--      library (`rules`) and per-booking lines (`booking_rules`). Catering
--      needs neither shape: its slip carries the SAME standing conditions every
--      time, so this is one flat, ordered, switchable list that prints on every
--      quotation under the terms already held in `settings`.
--
--   2. The enquiry slip's "Please Note" block moves into `settings`. It was
--      four numbered sentences hard-coded into the print component, so changing
--      a word meant a rebuild.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. Standing conditions printed on every catering quotation ──
CREATE TABLE IF NOT EXISTS catering_rules (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  text       VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_crule_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Starter rules ──
-- Only into an empty table, so a second run never duplicates them or restores
-- one the client has since deleted.
INSERT INTO catering_rules (text, sort_order)
SELECT * FROM (
  SELECT 'If Tax Apply Pay by Party' AS t, 10 AS so
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM catering_rules LIMIT 1);

-- ── 3. `settings.value` widened to TEXT ──
-- It was VARCHAR(255), which the four-point enquiry note overflows. Widening
-- only — every existing value keeps its content. Guarded so a second run is a
-- no-op rather than a needless table rebuild.
SET @sql := (SELECT IF(
  DATA_TYPE = 'varchar',
  'ALTER TABLE settings MODIFY COLUMN `value` TEXT NOT NULL',
  'SELECT ''settings.value already widened''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'value');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 4. The enquiry slip's "Please Note" block ──
-- One line per numbered point. Seeded with exactly the text that was previously
-- compiled into the slip, so nothing on paper changes until someone edits it.
INSERT INTO settings (`key`, `value`)
SELECT * FROM (
  SELECT 'enquiry.note' AS k, CONCAT_WS(CHAR(10),
    'This is a quotation / enquiry only — it does NOT reserve the hall or date.',
    'The date is confirmed only once an advance is received and a booking slip is issued.',
    'Prices are an estimate and valid until the date shown above.',
    'Advance payment (once made) is non-refundable.'
  ) AS v
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE `key` = 'enquiry.note');
