-- ═══════════════════════════════════════════════════════════════
-- SKYLIGHT BALLROOM — Super Admin + Live Cooking
--
-- Incremental upgrade for a database that already holds real bookings.
-- It only ADDS what is missing and KEEPS ALL YOUR DATA — nothing is dropped.
-- Safe to run more than once (every step checks first).
--
-- How to run: cPanel → phpMyAdmin → pick your database → SQL tab →
-- paste this whole file → Go.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── 1. SUPER_ADMIN role ──
-- MODIFY rewrites the ENUM in place; existing rows keep their current role.
-- Listed first so it outranks OWNER in ORDER BY role.
SET @sql := (SELECT IF(
  LOCATE('SUPER_ADMIN', COLUMN_TYPE) = 0,
  'ALTER TABLE users MODIFY COLUMN role ENUM(''SUPER_ADMIN'',''OWNER'',''MANAGER'',''ACCOUNTANT'',''SUPERVISOR'',''RECEPTIONIST'',''VIEWER'') NOT NULL DEFAULT ''VIEWER''',
  'SELECT ''SUPER_ADMIN already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 2. Tag banquet service lines as Live Cooking ──
-- Live Cooking is billed as a normal banquet service. This column is what
-- lets the Super Admin pull its figures out separately without matching on
-- the label text, which staff are free to edit.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE booking_service_items ADD COLUMN service_kind ENUM(''BANQUET'',''LIVE_COOKING'') NOT NULL DEFAULT ''BANQUET'' AFTER label',
  'SELECT ''service_kind already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_service_items' AND COLUMN_NAME = 'service_kind');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE booking_service_items ADD INDEX idx_bsi_kind (service_kind)',
  'SELECT ''idx_bsi_kind already present''')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_service_items' AND INDEX_NAME = 'idx_bsi_kind');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3. Backfill any Live Cooking lines already entered by hand ──
-- Matches the label loosely, because before this migration there was nothing
-- stopping staff typing "live cooking", "Live Cooking Stall" and so on.
UPDATE booking_service_items
   SET service_kind = 'LIVE_COOKING'
 WHERE service_kind = 'BANQUET'
   AND (LOWER(label) LIKE '%live cooking%' OR LOWER(label) LIKE '%live kitchen%');
