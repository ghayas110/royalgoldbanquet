-- ═══════════════════════════════════════════════════════════════
-- CATERING — meat types, and dishes that pull their own meat line
--
-- On the client's slip every meat-based dish is billed twice: the dish above at
-- its making cost, and again underneath the raw meat that goes into it —
--   QORMA (chicken)         ->  CHICKEN FOR QORMA, 14kg @ 850
--   BIRYANI MASALA (beef)   ->  BEEF FOR BIRYANI,  18kg @ 1,500
-- The meat always matches the dish's CATEGORY, so which meat and at what rate
-- are derived. The QUANTITY is not: how much raw meat a dish takes is a kitchen
-- judgement, not its sold weight, so the operator types it on every meat line.
--
-- Meat rates live in their own table because they move constantly — the slip
-- carries a standing note saying exactly that.
--
-- Incremental and idempotent.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. Meat types and their current rates ──
CREATE TABLE IF NOT EXISTS catering_meat_types (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(60) NOT NULL,
  unit       ENUM('KG','GRAM','LITRE','ML','PCS') NOT NULL DEFAULT 'KG',
  rate       DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cmeat_name (name),
  INDEX idx_cmeat_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Which meat a dish-category consumes ──
-- Hung off the VARIANT, not the dish: QORMA under CHICKEN pulls chicken,
-- QORMA under BEEF pulls beef.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE catering_menu_item_categories ADD COLUMN meat_type_id INT NULL AFTER rate',
  'SELECT ''meat_type_id already on variants''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_menu_item_categories' AND COLUMN_NAME = 'meat_type_id');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3. A MEAT line records which meat it is ──
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE catering_quotation_items ADD COLUMN meat_type_id INT NULL AFTER category_id',
  'SELECT ''meat_type_id already on lines''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotation_items' AND COLUMN_NAME = 'meat_type_id');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 4. Starter meat rates ──
-- Only into an empty table, so a second run never duplicates or overwrites
-- rates the client has since changed.
INSERT INTO catering_meat_types (name, unit, rate, sort_order)
SELECT * FROM (
  SELECT 'CHICKEN' AS n, 'KG' AS u,  850 AS r, 10 AS so UNION ALL
  SELECT 'BEEF',         'KG',      1500,      20 UNION ALL
  SELECT 'MUTTON',       'KG',      2200,      30 UNION ALL
  SELECT 'FISH',         'KG',      1400,      40
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM catering_meat_types LIMIT 1);
