-- 001 — API completion schema
--
-- Idempotent MariaDB/MySQL DDL for the tables and columns the API layer
-- already references but which were never created. Run against an existing
-- database; server/src/database/schema.sql is kept in sync so a fresh install
-- gets the same shape in one pass.
--
-- Every statement is guarded so the file can be re-applied safely.

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------

-- Purchase-order lines. Referenced by purchaseOrder.controller and the
-- inventory low-stock job; the table itself never existed.
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  medicine_id VARCHAR(64) NULL,
  medicine_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines_inventory(id) ON DELETE SET NULL,
  INDEX idx_po_items_order (purchase_order_id)
) ENGINE=InnoDB;

-- Drug-interaction rules, read by drugInteractions.service.
CREATE TABLE IF NOT EXISTS contraindications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_a VARCHAR(100) NOT NULL,
  category_b VARCHAR(100) NOT NULL,
  severity ENUM('low', 'moderate', 'high') DEFAULT 'moderate',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_contra_pair (category_a, category_b),
  INDEX idx_contra_a (category_a),
  INDEX idx_contra_b (category_b)
) ENGINE=InnoDB;

-- Password reset tokens. Only the hash is stored, and every row expires.
CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_user (user_id),
  INDEX idx_reset_expiry (expires_at)
) ENGINE=InnoDB;

-- Patient vitals. The frontend kept these in localStorage only, so readings
-- were per-device and vanished with the browser.
CREATE TABLE IF NOT EXISTS vitals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  recorded_by BIGINT UNSIGNED NULL,
  recorded_by_name VARCHAR(255),
  recorded_at DATETIME NOT NULL,
  systolic_bp INT NOT NULL,
  diastolic_bp INT NOT NULL,
  heart_rate INT NOT NULL,
  temperature DECIMAL(4, 1) NOT NULL,
  respiratory_rate INT NULL,
  oxygen_saturation DECIMAL(5, 2) NULL,
  notes TEXT NULL,
  status ENUM('normal', 'elevated', 'high', 'critical') DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_vitals_patient (patient_id),
  INDEX idx_vitals_recorded (recorded_at),
  INDEX idx_vitals_status (status)
) ENGINE=InnoDB;

-- Time-limited share links for a patient summary.
CREATE TABLE IF NOT EXISTS shared_summaries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  patient_name VARCHAR(255),
  shared_by BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  access_count INT DEFAULT 0,
  last_accessed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_shared_token (token),
  INDEX idx_shared_expiry (expires_at)
) ENGINE=InnoDB;

-- Analytics event sink. The endpoint previously accepted events and dropped
-- them on the floor.
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  event_data JSON NULL,
  user_id BIGINT UNSIGNED NULL,
  session_id VARCHAR(100),
  page_url VARCHAR(500),
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_event_name (event_name),
  INDEX idx_event_occurred (occurred_at)
) ENGINE=InnoDB;

-- Revoked access tokens. Logout has to invalidate the token it is handed;
-- without a server-side record the JWT stays usable until it expires.
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_revoked_token (token_hash),
  INDEX idx_revoked_expiry (expires_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Column fixes
-- ---------------------------------------------------------------------------
--
-- The column adds are guarded through information_schema rather than using
-- `ADD COLUMN IF NOT EXISTS`. That clause is a MariaDB extension: MySQL 8 has
-- no equivalent and refuses the statement, so a migration written that way
-- only works on one of the two engines the project runs against. A prepared
-- statement is used because the column name has to be a literal.

-- Hospitals: the create endpoint has always written these.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hospitals' AND COLUMN_NAME = 'city'
);
SET @col_sql = IF(@col_exists = 0, 'ALTER TABLE hospitals ADD COLUMN city VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hospitals' AND COLUMN_NAME = 'state'
);
SET @col_sql = IF(@col_exists = 0, 'ALTER TABLE hospitals ADD COLUMN state VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hospitals' AND COLUMN_NAME = 'zip_code'
);
SET @col_sql = IF(@col_exists = 0, 'ALTER TABLE hospitals ADD COLUMN zip_code VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Inventory rows need a supplier reference so a low-stock run can raise a
-- purchase order against a real supplier. Stock level stays the single
-- source of truth in `stock_level`; the low-stock job reads that column.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines_inventory' AND COLUMN_NAME = 'supplier_id'
);
SET @col_sql = IF(@col_exists = 0, 'ALTER TABLE medicines_inventory ADD COLUMN supplier_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Purchase orders are raised per hospital.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'hospital_id'
);
SET @col_sql = IF(@col_exists = 0, 'ALTER TABLE purchase_orders ADD COLUMN hospital_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Audit rows record ids from tables whose keys are not all numeric.
-- A MODIFY is idempotent, so it needs no guard.
ALTER TABLE audit_logs MODIFY COLUMN record_id VARCHAR(64) NULL;
