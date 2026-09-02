-- ═══════════════════════════════════════════════════════════════
-- CATERING — categories as a real entity, and unit conversion
--
-- Three changes:
--   1. Categories become a managed table instead of free text.
--   2. A dish can carry SEVERAL categories, each with its own rate —
--      QORMA sells as BEEF QORMA and CHICKEN QORMA at different prices.
--   3. Units gain GRAM / LITRE / ML so a line can be quoted in a smaller
--      unit than the rate. Conversion is done in code (see UNIT_META in
--      src/lib/types.ts); the database only records which unit was used.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. Categories ──
CREATE TABLE IF NOT EXISTS catering_categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(60) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ccat_name (name),
  INDEX idx_ccat_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Wider unit lists ──
-- ENUMs are only ever widened here; narrowing one truncates existing rows.
SET @sql := (SELECT IF(
  LOCATE('GRAM', COLUMN_TYPE) = 0,
  'ALTER TABLE catering_menu_items MODIFY COLUMN unit ENUM(''KG'',''GRAM'',''LITRE'',''ML'',''PCS'') NOT NULL DEFAULT ''KG''',
  'SELECT ''menu unit already widened''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_menu_items' AND COLUMN_NAME = 'unit');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  LOCATE('GRAM', COLUMN_TYPE) = 0,
  'ALTER TABLE catering_quotation_items MODIFY COLUMN unit ENUM(''KG'',''GRAM'',''LITRE'',''ML'',''PCS'') NOT NULL DEFAULT ''KG''',
  'SELECT ''line unit already widened''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotation_items' AND COLUMN_NAME = 'unit');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3. A dish's categories, each with its own rate ──
-- The rate is quoted per the item's BASE unit (KG, LITRE or PCS). A line
-- entered in GRAM or ML is converted before the amount is worked out.
CREATE TABLE IF NOT EXISTS catering_menu_item_categories (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT NOT NULL,
  category_id  INT NOT NULL,
  rate         DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_cmic_item FOREIGN KEY (menu_item_id) REFERENCES catering_menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_cmic_cat FOREIGN KEY (category_id) REFERENCES catering_categories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cmic (menu_item_id, category_id),
  INDEX idx_cmic_item (menu_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Quotation lines point at the variant they were priced from ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE catering_quotation_items ADD COLUMN category_id INT NULL AFTER category',
  'SELECT ''category_id already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotation_items' AND COLUMN_NAME = 'category_id');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 5. Lift the existing free-text categories into the new table ──
-- Runs once: after this the join table is populated and the guard below
-- stops a second run from duplicating anything.
INSERT IGNORE INTO catering_categories (name, sort_order)
SELECT DISTINCT TRIM(category), 0
  FROM catering_menu_items
 WHERE TRIM(COALESCE(category,'')) <> '';

INSERT IGNORE INTO catering_menu_item_categories (menu_item_id, category_id, rate)
SELECT m.id, c.id, m.default_rate
  FROM catering_menu_items m
  JOIN catering_categories c ON c.name = TRIM(m.category)
 WHERE TRIM(COALESCE(m.category,'')) <> '';

-- Backfill the id on lines that already name a category.
UPDATE catering_quotation_items i
  JOIN catering_categories c ON c.name = TRIM(i.category)
   SET i.category_id = c.id
 WHERE i.category_id IS NULL AND TRIM(COALESCE(i.category,'')) <> '';
