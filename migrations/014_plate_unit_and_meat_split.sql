-- ═══════════════════════════════════════════════════════════════
-- CATERING — PER-PLATE PRICING, AND DISHES THAT USE TWO MEATS
--
-- Two things the kitchen actually needs.
--
--   1. PLATE as a unit. Plenty of the menu is quoted per head rather than by
--      weight: a plate of biryani, a plate of dessert. It behaves like PCS,
--      a count, so the same conversion rules apply and nothing else changes.
--
--   2. A dish variant can draw on MORE THAN ONE meat. Mixed karahi is half
--      chicken and half beef, and until now a variant could name exactly one
--      meat, so the second never reached the slip and the costing was wrong.
--
--      Modelled as its own table with a percentage share rather than a second
--      meat column, because "half and half" is only the common case: a mixed
--      grill can be three ways, and a column pair cannot express that. Shares
--      are percentages of the dish quantity, so 50/50 on 20 kg of karahi bills
--      10 kg of chicken and 10 kg of beef.
--
-- The existing single-meat links are carried across at 100%, so every dish
-- that already pulled a meat keeps behaving exactly as it did.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. PLATE joins the unit lists ──
-- ENUMs are only ever widened here; narrowing one truncates existing rows.
SET @sql := (SELECT IF(LOCATE('PLATE', COLUMN_TYPE) = 0,
  'ALTER TABLE catering_menu_items MODIFY COLUMN unit ENUM(''KG'',''GRAM'',''LITRE'',''ML'',''PCS'',''PLATE'') NOT NULL DEFAULT ''KG''',
  'SELECT ''menu unit already has PLATE''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_menu_items' AND COLUMN_NAME = 'unit');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(LOCATE('PLATE', COLUMN_TYPE) = 0,
  'ALTER TABLE catering_quotation_items MODIFY COLUMN unit ENUM(''KG'',''GRAM'',''LITRE'',''ML'',''PCS'',''PLATE'') NOT NULL DEFAULT ''KG''',
  'SELECT ''line unit already has PLATE''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_quotation_items' AND COLUMN_NAME = 'unit');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(LOCATE('PLATE', COLUMN_TYPE) = 0,
  'ALTER TABLE catering_template_items MODIFY COLUMN unit ENUM(''KG'',''GRAM'',''LITRE'',''ML'',''PCS'',''PLATE'') NOT NULL DEFAULT ''KG''',
  'SELECT ''template unit already has PLATE''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_template_items' AND COLUMN_NAME = 'unit');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Meat is bought by weight, so PLATE is deliberately NOT added to
-- catering_meat_types.unit.

-- ── 2. A variant's meats, with shares ──
CREATE TABLE IF NOT EXISTS catering_variant_meats (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  variant_id   INT NOT NULL,
  meat_type_id INT NOT NULL,
  -- Percent of the dish quantity. 50 + 50 for half and half.
  share        DECIMAL(6,2) NOT NULL DEFAULT 100,
  CONSTRAINT fk_cvm_variant FOREIGN KEY (variant_id) REFERENCES catering_menu_item_categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_cvm_meat FOREIGN KEY (meat_type_id) REFERENCES catering_meat_types(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cvm (variant_id, meat_type_id),
  INDEX idx_cvm_variant (variant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Carry the existing single-meat links across at 100% ──
-- Guarded, so a second run neither duplicates a row nor overwrites a split the
-- client has since set up by hand.
INSERT IGNORE INTO catering_variant_meats (variant_id, meat_type_id, share)
SELECT v.id, v.meat_type_id, 100
  FROM catering_menu_item_categories v
 WHERE v.meat_type_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM (SELECT variant_id FROM catering_variant_meats) x WHERE x.variant_id = v.id);
