-- 004 — Prescription duration
--
-- The refill rule needs to know how long a prescription is valid for. The
-- table had no duration column, so the browser kept its own copy of the
-- prescription list with a hardcoded duration instead of reading real rows.
--
-- The column add is guarded through information_schema rather than using
-- `ADD COLUMN IF NOT EXISTS`. That clause is a MariaDB extension: MySQL 8 has
-- no equivalent and refuses the statement, so a migration written that way
-- only works on one of the two engines the project runs against.

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'duration_days'
);
SET @col_sql = IF(
  @col_exists = 0,
  'ALTER TABLE prescriptions ADD COLUMN duration_days INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
