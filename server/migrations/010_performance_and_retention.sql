-- 010 -- Query indexes, a stock invariant, and the rows that are kept for a while
--
-- Three things are addressed here, and each one is a thing the platform does
-- on every request or every day rather than a one-off.
--
-- 1. Some of the platform's busiest reads filter on a column that has no
--    index to help them. A full scan of the table is then read to answer the
--    request, and the sort that goes with it is a full sort of the table. The
--    indexes below are added for exactly those queries, in the column order
--    the query uses, so that the filter narrows the index and the ordering is
--    already in it.
--
-- 2. `medicines_inventory.stock_level` could end up below zero. A recall
--    subtracts the recalled quantity from the stock and nothing stopped it
--    from subtracting more than the stock held, so a batch of 50 recalled
--    against a stock of 10 left a stock of -40. A negative stock is not a
--    quantity that can be dispensed, and it makes the low-stock rule fire for
--    stock that does not exist. The invariant is stated in the database here
--    rather than in each of the callers that can reach the column.
--
-- 3. `audit_logs`, `analytics_events`, `notification_dedupe` and
--    `shared_summaries` only ever grow. The retention service
--    (server/src/services/retention.service.ts) purges them on a schedule;
--    the indexes it purges through are among the ones below.
--
-- `CREATE INDEX IF NOT EXISTS` is a MariaDB extension that MySQL 8 does not
-- accept, so every index is guarded by a lookup in information_schema and
-- created through a prepared statement -- the same shape the column adds in
-- migration 009 use. The file is therefore safe to apply twice, and safe to
-- apply to an installation that already has some of these indexes.

-- ---------------------------------------------------------------------------
-- medicines_inventory
--
-- The table had no secondary index at all: only the primary key. Three reads
-- depend on it.
--
-- `idx_inventory_stock` is for the low-stock scanner, which asks for
-- `low_stock_threshold > 0 AND stock_level <= low_stock_threshold`. The
-- threshold comes first because it is the equality part of the predicate, and
-- the stock level second because it is the range part: the index narrows on
-- the threshold and then reads the stock levels in order.
--
-- `idx_inventory_expiry` is for the expiry scan, which asks for the rows
-- whose expiry date has passed and orders them by that date. The ordering is
-- the index's own order, so the scan does not sort afterwards.
--
-- `idx_inventory_hospital` is for the tenant filter: the stock belongs to a
-- hospital, and a hospital's stock list is its own.
-- ---------------------------------------------------------------------------

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'medicines_inventory'
    AND INDEX_NAME = 'idx_inventory_stock'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_inventory_stock ON medicines_inventory (low_stock_threshold, stock_level)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'medicines_inventory'
    AND INDEX_NAME = 'idx_inventory_expiry'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_inventory_expiry ON medicines_inventory (expiry_date)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'medicines_inventory'
    AND INDEX_NAME = 'idx_inventory_hospital'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_inventory_hospital ON medicines_inventory (hospital_id)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- ---------------------------------------------------------------------------
-- prescriptions
--
-- The table carried only the indexes its foreign keys needed, so a read by
-- status was a full scan.
--
-- `idx_prescriptions_status` is for the interaction check, which asks for the
-- prescriptions of a patient that are still active. It is a narrow index on
-- the status alone, so the lookup for the active ones does not carry the
-- wider ordering column of the composite below through the index.
--
-- `idx_prescriptions_status_created` is for the refill scan, which asks for
-- the active prescriptions and orders them by when they were written. The
-- status comes first and the creation time second, so the scan reads the
-- statuses in order and the creation time is already sorted inside each of
-- them: the refill scan no longer sorts the whole table.
-- ---------------------------------------------------------------------------

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'prescriptions'
    AND INDEX_NAME = 'idx_prescriptions_status'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_prescriptions_status ON prescriptions (status)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'prescriptions'
    AND INDEX_NAME = 'idx_prescriptions_status_created'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_prescriptions_status_created ON prescriptions (status, created_at)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- ---------------------------------------------------------------------------
-- vitals
--
-- The table grows on every reading, so the reads that ask for a patient's
-- history get slower for as long as the installation runs.
--
-- `idx_vitals_patient_recorded` is for the "latest reading per patient"
-- query, which groups the readings by patient and takes the most recent one.
-- With the patient first and the recording time second, the group needs one
-- index entry per patient rather than one per reading, and the most recent
-- reading of a patient is the last entry of its own run.
--
-- The single-column index on `patient_id` that the foreign key needed is left
-- in place: dropping an index is not an additive change, and the composite
-- above already answers the lookups it answered.
-- ---------------------------------------------------------------------------

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vitals'
    AND INDEX_NAME = 'idx_vitals_patient_recorded'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_vitals_patient_recorded ON vitals (patient_id, recorded_at)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- ---------------------------------------------------------------------------
-- notification_dedupe
--
-- The index on the creation time was already here, and nothing read it,
-- because there was no purge to read it for. The retention service now
-- removes the rows that are older than the configured window, and this is the
-- index that makes that removal a range read instead of a full scan. It is
-- re-asserted so that this file leaves the installation in the shape it
-- describes even when it is applied to a database that was set up by hand.
-- ---------------------------------------------------------------------------

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_dedupe'
    AND INDEX_NAME = 'idx_dedupe_created'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_dedupe_created ON notification_dedupe (created_at)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- ---------------------------------------------------------------------------
-- emergency_admissions
--
-- The board of a hospital reads the admissions of that hospital and the ones
-- that are still admitted. The status filter already had an index; the
-- hospital filter, added with the column in migration 009, had none, so
-- narrowing the board to one hospital still read the whole table.
-- ---------------------------------------------------------------------------

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'emergency_admissions'
    AND INDEX_NAME = 'idx_eradmission_hospital'
);

SET @statement := IF(
  @index_exists > 0,
  'SELECT 1',
  'CREATE INDEX idx_eradmission_hospital ON emergency_admissions (hospital_id)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- ---------------------------------------------------------------------------
-- patients
--
-- The patient list is sorted by the creation time inside a hospital, and the
-- index for that was added in migration 009. It is re-asserted for the same
-- reason as the deduplication index above: this file describes the shape the
-- installation is in, and it leaves it in that shape on its own.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- The stock invariant
--
-- A row that is already below zero is lifted to zero before the constraint
-- is added, because the constraint cannot be added while such a row exists.
-- Zero is the only value that is true of it: the quantity that can be
-- dispensed from a stock of -40 is none, and a negative figure is not a
-- quantity. The statement is idempotent -- once the rows are lifted, it
-- matches nothing.
--
-- The constraint is enforced by MySQL 8.0.16 and later and by MariaDB 10.2
-- and later. On an older server the statement is accepted and the constraint
-- is parsed but not enforced, which is why the constraint is added by name
-- and guarded rather than assumed.
-- ---------------------------------------------------------------------------

UPDATE medicines_inventory SET stock_level = 0 WHERE stock_level < 0;

SET @constraint_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'medicines_inventory'
    AND CONSTRAINT_NAME = 'chk_medicines_inventory_stock_level'
);

SET @statement := IF(
  @constraint_exists > 0,
  'SELECT 1',
  'ALTER TABLE medicines_inventory ADD CONSTRAINT chk_medicines_inventory_stock_level CHECK (stock_level >= 0)'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;
