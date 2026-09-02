-- ═══════════════════════════════════════════════════════════════
-- CATERING — QUOTATION TEMPLATES
--
-- The same menus go out again and again: a 250-head mehndi, a valima package,
-- a corporate lunch. Retyping twenty dish lines each time is the slowest part
-- of raising a quotation, and the easiest place to make a mistake.
--
-- A template is a saved set of lines. Applying one fills a new quotation with
-- those lines; the quotation is then edited freely, and nothing it does
-- reaches back into the template.
--
-- Its own tables rather than another `doc_type` on catering_quotations. A
-- template is not a document: it has no customer, no date, no money owed, and
-- it must never be picked up by the event ledger, the reports, or the quota
-- numbering. Keeping it separate makes that structural instead of a filter
-- everyone has to remember.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS catering_templates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  description VARCHAR(400) NOT NULL DEFAULT '',
  -- The headcount the template was costed for. Carried onto the quotation as
  -- a starting point, because the line quantities were chosen to match it.
  persons     INT NOT NULL DEFAULT 0,
  note        VARCHAR(1000) NOT NULL DEFAULT '',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ctpl_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_ctpl_name (name),
  INDEX idx_ctpl_active (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mirrors catering_quotation_items exactly, so applying a template is a
-- straight column-for-column copy with no translation step to get wrong.
CREATE TABLE IF NOT EXISTS catering_template_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  template_id  INT NOT NULL,
  section      ENUM('DISH','CHARGE','MEAT') NOT NULL DEFAULT 'DISH',
  menu_item_id INT NULL,
  description  VARCHAR(200) NOT NULL,
  category     VARCHAR(60) NOT NULL DEFAULT '',
  category_id  INT NULL,
  meat_type_id INT NULL,
  qty          DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit         ENUM('KG','GRAM','LITRE','ML','PCS') NOT NULL DEFAULT 'KG',
  rate         DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order   INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_ctpli_template FOREIGN KEY (template_id) REFERENCES catering_templates(id) ON DELETE CASCADE,
  -- Deliberately ON DELETE SET NULL, not CASCADE: retiring a dish from the
  -- menu must not silently gut every template that used it. The line keeps its
  -- description and rate and simply stops being linked.
  CONSTRAINT fk_ctpli_menu FOREIGN KEY (menu_item_id) REFERENCES catering_menu_items(id) ON DELETE SET NULL,
  INDEX idx_ctpli_template (template_id, section, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
