-- 014 -- Make user preferences belong to a real account
--
-- Migration 013 created `user_preferences` without a foreign key, so a row
-- could outlive the account it was written for and nothing would notice. The
-- table is also not in `schema.sql` until this change, which broke the
-- fresh-install contract: a new install got the table only after running the
-- migrations, and an install that ran neither had no table at all.
--
-- Four things are corrected here, and each one is guarded so the file can be
-- applied to an installation that already has the change:
--
-- 1. `id` was declared INT UNSIGNED while `schema.sql` declares BIGINT
--    UNSIGNED. The two install paths must produce the same table, so the
--    surrogate key is widened too. Widening is lossless.
--
-- 2. `user_id` was declared INT UNSIGNED while `users.id` is BIGINT UNSIGNED.
--    A foreign key requires both sides to have the same type and sign, so the
--    column has to be widened first. Widening is lossless.
--
-- 3. Rows whose account no longer exists are removed before the constraint is
--    added. They cannot be read by anyone -- every query is scoped by
--    user_id -- and the alternative is a migration that cannot complete.
--
-- 4. The foreign key is added, with ON DELETE CASCADE: deleting an account
--    deletes its preferences rather than leaving them behind.
--
-- The checks are made against information_schema rather than with
-- "ADD CONSTRAINT IF NOT EXISTS", which MySQL and MariaDB do not both accept.

-- 1. Widen the surrogate key to match schema.sql.
SET @id_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_preferences'
    AND COLUMN_NAME = 'id'
);

SET @statement := IF(
  @id_type IS NULL OR @id_type = 'bigint unsigned',
  'SELECT 1',
  'ALTER TABLE user_preferences MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- 2. Widen user_id to match users.id.
SET @column_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_preferences'
    AND COLUMN_NAME = 'user_id'
);

SET @statement := IF(
  @column_type IS NULL OR @column_type = 'bigint unsigned',
  'SELECT 1',
  'ALTER TABLE user_preferences MODIFY COLUMN user_id BIGINT UNSIGNED NOT NULL'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;

-- 3. Remove rows whose account is gone. A preference with no owner can never
--    be served, so deleting it loses nothing that could still be used.
DELETE FROM user_preferences
WHERE user_id NOT IN (SELECT id FROM users);

-- 4. Add the foreign key when it is missing.
--
-- The check looks for any foreign key from this column to `users(id)`, not for
-- a constraint by name. `schema.sql` declares the constraint inline, so a
-- fresh install has an auto-generated name while an installation that ran 013
-- gets the name written below. Testing the name alone would add a second,
-- identical constraint to every fresh install.
SET @constraint_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_preferences'
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);

SET @statement := IF(
  @constraint_exists > 0,
  'SELECT 1',
  'ALTER TABLE user_preferences ADD CONSTRAINT fk_user_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'
);

PREPARE prepared_statement FROM @statement;
EXECUTE prepared_statement;
DEALLOCATE PREPARE prepared_statement;
