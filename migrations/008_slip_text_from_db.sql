-- ═══════════════════════════════════════════════════════════════
-- NO SLIP TEXT LEFT IN THE CODE
--
-- The printed slips still fell back to terms compiled into the print
-- component: an invoice or enquiry with no rules saved against it, and no
-- rules in the portal library, printed five sentences that lived in
-- `print-docs.tsx` and could only be changed by a rebuild.
--
-- Those five move into `rules` here, and the fallback is removed from the
-- component. After this every line of rules or instructions on every slip —
-- booking, enquiry and catering — comes out of the database:
--
--   invoice / enquiry terms  ->  booking_rules, else the `rules` library
--   enquiry "Please Note"    ->  settings.`enquiry.note`   (007)
--   catering conditions      ->  catering_rules           (007)
--   catering terms & note    ->  settings.`catering.*`    (004)
--
-- Incremental and idempotent. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- Only into an empty library, so a second run never duplicates these and never
-- restores one the client has since deleted. A database that already has rules
-- is left completely alone.
INSERT INTO rules (title, body, category, sort_order, is_active)
SELECT * FROM (
  SELECT 'Advance payment is non-refundable.' AS t, '' AS b, 'PAYMENT' AS c, 10 AS so, 1 AS a UNION ALL
  SELECT 'Balance must be settled on or before the event date.', '', 'PAYMENT', 20, 1 UNION ALL
  SELECT 'Menu / service changes must be communicated 48 hours prior.', '', 'BOOKING', 30, 1 UNION ALL
  SELECT 'Management is not responsible for guests'' valuables.', '', 'VENUE', 40, 1 UNION ALL
  SELECT 'Event timings must be strictly observed.', '', 'VENUE', 50, 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM rules LIMIT 1);
