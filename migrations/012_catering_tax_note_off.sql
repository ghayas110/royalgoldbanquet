-- ═══════════════════════════════════════════════════════════════
-- THE TAX LINE COMES OFF THE CATERING SLIP
--
-- 010 put "If Tax Apply Pay by Party" in the slip header. It is not wanted
-- there, so the setting is blanked: the header renders the line only when
-- `catering.tax_note` has content, and an empty value hides it.
--
-- Blanked rather than deleted, and deliberately not a plain UPDATE. Migrations
-- re-run on every deploy, so an unconditional UPDATE would wipe the line again
-- every time if the client ever types it back from Catering -> Settings. The
-- marker below makes this a genuinely ONE-TIME clear.
--
-- To bring it back: Catering -> Settings -> Tax line. Nothing here fights that.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- MySQL cannot reference the target table directly in an UPDATE subquery, so
-- the marker lookup goes through a derived table.
UPDATE settings
   SET `value` = ''
 WHERE `key` = 'catering.tax_note'
   AND NOT EXISTS (
     SELECT 1 FROM (SELECT `key` FROM settings) AS m
      WHERE m.`key` = 'catering.tax_note_cleared'
   );

INSERT INTO settings (`key`, `value`)
SELECT * FROM (SELECT 'catering.tax_note_cleared' AS k, '1' AS v) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE `key` = 'catering.tax_note_cleared');
