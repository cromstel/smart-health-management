-- 012 -- The tenant address: subdomain and domain on hospitals
--
-- Each hospital gets an address of its own: `<subdomain>.medicare.example.com`,
-- or a custom `domain` when one is pointed at the platform. The resolver
-- matches the request's hostname against `hospitals.subdomain` and confines
-- the request to that hospital, so the address is what makes a tenant
-- reachable — and what makes it singular.
--
-- Both columns are nullable: a hospital without one is simply not addressable
-- by that route. Both are UNIQUE, and MySQL permits any number of NULLs in a
-- unique index, so "not addressable" stays the normal state.
--
-- The columns are added only when missing, and each index only when missing,
-- so the file can be applied to an installation that already has either. The
-- checks are made against information_schema rather than with "ADD COLUMN IF
-- EXISTS" / "CREATE INDEX IF NOT EXISTS", which MySQL does not accept.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hospitals'
    AND COLUMN_NAME = 'subdomain'
);

SET @statement := IF(
  @column_exists > 0,
  'SELECT 1',
  'ALTER TABLE hospitals ADD COLUMN subdomain VARCHAR(100) NULL AFTER email'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hospitals'
    AND COLUMN_NAME = 'domain'
);

SET @statement := IF(
  @column_exists > 0,
  'SELECT 1',
  'ALTER TABLE hospitals ADD COLUMN domain VARCHAR(255) NULL AFTER subdomain'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- The uniqueness the application re-checks on every write. A plain unique
-- index on a nullable column is what MySQL gives: it constrains the values
-- that are present and ignores the rows that are not, which is the behaviour
-- wanted here. No partial index is needed, and MySQL would not accept one.
SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hospitals'
    AND INDEX_NAME = 'uq_hospitals_subdomain'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE UNIQUE INDEX uq_hospitals_subdomain ON hospitals (subdomain)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hospitals'
    AND INDEX_NAME = 'uq_hospitals_domain'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE UNIQUE INDEX uq_hospitals_domain ON hospitals (domain)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- The portal looks a patient up by the account's email within the hospital.
-- Without this index that lookup scans the whole table on every portal view.
SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND INDEX_NAME = 'idx_patients_hospital_email'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_patients_hospital_email ON patients (hospital_id, email)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- Give the seeded hospital the address the seed data already declares, so an
-- installation that arrives through this file ends in the same state as one
-- that arrives through a fresh setup. Only rows that have no address yet are
-- touched: an operator who has since changed it keeps their value.
UPDATE hospitals
   SET subdomain = 'medicare',
       domain = 'medicare.cromstelit.com'
 WHERE id = 1
   AND (subdomain IS NULL OR subdomain = '');
