-- 009 -- Account token version, and the tenant keys the records are scoped by
--
-- A token is a bearer credential that says who the account was when it was
-- issued. Nothing in it noticed that the account has since changed its
-- password, been suspended, been moved to another hospital or had its role
-- changed, so a token captured before any of those still worked for the
-- length of its lifetime.
--
-- `users.token_version` is the answer to that. It changes when the account's
-- credentials change, every token carries the value it was issued with, and
-- a token whose value no longer matches is refused. A password change now
-- ends every session that account had, on every device, at once.
--
-- The column is added only when it is missing, so the file can be applied to
-- an installation that already has it. The check is made against
-- information_schema rather than with "ADD COLUMN IF NOT EXISTS", which MySQL
-- and MariaDB do not both accept.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'token_version'
);

SET @statement := IF(
  @column_exists > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER password_must_change'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- The emergency board and the pharmacy stock are the two places where the
-- records carry no hospital at all, so a board or a stock list belongs to
-- every hospital at once and cannot be narrowed to one. The key is added
-- here, nullable, because an existing row has no way of knowing which
-- hospital it belongs to: the application fills it in as it writes new
-- records, and the backfill below does what it can for the records that
-- already exist.
--
-- `emergency_admissions` can be filled from the patient it admits, because
-- an admission always has a patient and a patient always has a hospital.
-- `emergency_beds` cannot: a bed belongs to a hospital that the schema does
-- not otherwise record, so the backfill for beds is left to the deployment.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'emergency_admissions'
    AND COLUMN_NAME = 'hospital_id'
);

SET @statement := IF(
  @column_exists > 0,
  'SELECT 1',
  'ALTER TABLE emergency_admissions ADD COLUMN hospital_id BIGINT UNSIGNED NULL AFTER bed_id'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'emergency_beds'
    AND COLUMN_NAME = 'hospital_id'
);

SET @statement := IF(
  @column_exists > 0,
  'SELECT 1',
  'ALTER TABLE emergency_beds ADD COLUMN hospital_id BIGINT UNSIGNED NULL AFTER id'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'medicines_inventory'
    AND COLUMN_NAME = 'hospital_id'
);

SET @statement := IF(
  @column_exists > 0,
  'SELECT 1',
  'ALTER TABLE medicines_inventory ADD COLUMN hospital_id BIGINT UNSIGNED NULL'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- The index the tenant filter needs. Without it, narrowing the patient list
-- to one hospital is a full scan of the table and the sort on top of it is a
-- full sort of the table.
SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND INDEX_NAME = 'idx_patients_hospital_created'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_patients_hospital_created ON patients (hospital_id, created_at, id)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- The admissions that can be attributed to a hospital are attributed to it.
UPDATE emergency_admissions ea
  JOIN patients p ON p.id = ea.patient_id
   SET ea.hospital_id = p.hospital_id
 WHERE ea.hospital_id IS NULL;

-- The stock rows that can be attributed to a hospital are attributed to it
-- through the purchase orders that ordered them. The inventory row's key IS
-- the medicine it holds, which is what the order line points at.
UPDATE medicines_inventory mi
  JOIN (
    SELECT po.hospital_id, poi.medicine_id
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id
     WHERE po.hospital_id IS NOT NULL
  ) owner ON owner.medicine_id = mi.id
   SET mi.hospital_id = owner.hospital_id
 WHERE mi.hospital_id IS NULL;
