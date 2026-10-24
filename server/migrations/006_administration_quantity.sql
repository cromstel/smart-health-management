-- 006 — Numeric quantity on the administration record
--
-- The stock decrement had to parse the leading number out of the free-text
-- dosage ("3 Tablets" -> 3), which is unreliable: a dose written as "One
-- tablet" has no number at all. The record now carries the quantity
-- explicitly, and the dosage text stays a human-readable description.
--
-- The column add is guarded through information_schema rather than using
-- `ADD COLUMN IF NOT EXISTS`. That clause is a MariaDB extension: MySQL 8 has
-- no equivalent and refuses the statement, so a migration written that way
-- only works on one of the two engines the project runs against.

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_administrations' AND COLUMN_NAME = 'quantity'
);
SET @col_sql = IF(
  @col_exists = 0,
  'ALTER TABLE medication_administrations ADD COLUMN quantity INT NULL COMMENT ''Units consumed by this dose; NULL = derive from the dosage text''',
  'SELECT 1'
);
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
