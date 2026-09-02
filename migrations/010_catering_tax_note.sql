-- ═══════════════════════════════════════════════════════════════
-- THE TAX LINE MOVES INTO THE SLIP HEADER
--
-- "If Tax Apply Pay by Party" was seeded as an ordinary catering rule in 007,
-- so it printed in the conditions at the foot of the slip. It belongs at the
-- top instead, next to the status, where a customer reads the money terms.
--
-- So it becomes a setting of its own rather than one rule among many, and the
-- seeded rule is removed so it cannot print twice.
--
-- The DELETE matches the seeded wording exactly. A rule the client has since
-- reworded is left alone: better a duplicate they can delete than silently
-- discarding something they wrote.
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

INSERT INTO settings (`key`, `value`)
SELECT * FROM (SELECT 'catering.tax_note' AS k, 'If Tax Apply Pay by Party' AS v) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE `key` = 'catering.tax_note');

DELETE FROM catering_rules WHERE text = 'If Tax Apply Pay by Party';
