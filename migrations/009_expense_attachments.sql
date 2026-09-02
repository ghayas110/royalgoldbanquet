-- ═══════════════════════════════════════════════════════════════
-- A PHOTO OR A CLIP AGAINST A PETTY CASH LINE
--
-- The client photographs what he buys and wants that photo filed against the
-- expense, so a line in the book can be checked against the thing it paid for.
--
-- Only the stored filename lives in the database. The file itself sits in the
-- upload directory (UPLOAD_DIR, default ./uploads next to the server), NOT in
-- public/: these are financial records, and anything under public/ is served
-- to anyone who guesses the URL. They are read back through an authenticated
-- route instead. Keeping them outside public/ also means a redeploy, which
-- replaces public/, cannot wipe them.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE petty_cash_entries ADD COLUMN attachment VARCHAR(200) NULL AFTER qty_note',
  'SELECT ''attachment already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'petty_cash_entries' AND COLUMN_NAME = 'attachment');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 'IMAGE' or 'VIDEO'. Stored rather than sniffed from the extension, so the
-- viewer knows which element to render without parsing filenames.
SET @sql := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE petty_cash_entries ADD COLUMN attachment_kind ENUM(''IMAGE'',''VIDEO'') NULL AFTER attachment',
  'SELECT ''attachment_kind already present''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'petty_cash_entries' AND COLUMN_NAME = 'attachment_kind');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
