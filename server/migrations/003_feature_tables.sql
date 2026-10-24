-- 003 — Backend for the features that had no API at all
--
-- Notifications, medication administration records, emergency triage and bed
-- state, clinical notes, and dispensing events all existed only as hardcoded
-- arrays in the browser. This adds the tables those features need.

-- ---------------------------------------------------------------------------
-- Notifications (per-user inbox)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  type VARCHAR(50) NOT NULL,
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  status ENUM('pending', 'confirmed', 'resolved', 'dismissed') DEFAULT 'pending',
  read_at DATETIME NULL,
  patient_id BIGINT UNSIGNED NULL,
  patient_name VARCHAR(255),
  appointment_id BIGINT UNSIGNED NULL,
  doctor_name VARCHAR(255),
  appointment_time VARCHAR(50),
  action_url VARCHAR(255),
  data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (read_at),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

-- Idempotency marker for the upcoming-appointment alert, so a user is not
-- alerted twice for the same appointment and the marker survives a cache
-- clear or a different device.
CREATE TABLE IF NOT EXISTS notification_dedupe (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  dedupe_key VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_dedupe (user_id, dedupe_key),
  INDEX idx_dedupe_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Medication administration records (MAR)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medication_administrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  medicine_id VARCHAR(64) NULL,
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  scheduled_time DATETIME NOT NULL,
  status ENUM('pending', 'administered', 'overdue', 'missed') DEFAULT 'pending',
  assigned_staff_id BIGINT UNSIGNED NULL,
  assigned_staff_name VARCHAR(255),
  critical_notes TEXT,
  administered_at DATETIME NULL,
  administered_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines_inventory(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (administered_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_mar_patient (patient_id),
  INDEX idx_mar_status (status),
  INDEX idx_mar_scheduled (scheduled_time)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Emergency triage and bed state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_beds (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  status ENUM('occupied', 'available', 'cleaning') DEFAULT 'available',
  patient_id BIGINT UNSIGNED NULL,
  triage_level VARCHAR(20) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS emergency_admissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  triage_level ENUM('RED', 'AMBER', 'GREEN', 'YELLOW') DEFAULT 'AMBER',
  -- "condition" is a reserved word in MariaDB, so the column is named
  -- condition_note and the API exposes it as `condition`.
  condition_note VARCHAR(255),
  bed_id VARCHAR(32) NULL,
  systolic_bp INT NULL,
  diastolic_bp INT NULL,
  heart_rate INT NULL,
  spo2 DECIMAL(5, 2) NULL,
  status ENUM('admitted', 'discharged', 'deceased') DEFAULT 'admitted',
  admitted_at DATETIME NOT NULL,
  discharged_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (bed_id) REFERENCES emergency_beds(id) ON DELETE SET NULL,
  INDEX idx_eradmission_status (status),
  INDEX idx_eradmission_patient (patient_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Clinical notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NULL,
  author_name VARCHAR(255),
  content TEXT NOT NULL,
  tags JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_clinicalnote_patient (patient_id),
  INDEX idx_clinicalnote_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Dispensing events (who dispensed what, when)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispensing_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prescription_id VARCHAR(64) NULL,
  patient_id BIGINT UNSIGNED NULL,
  medicine_id VARCHAR(64) NULL,
  medicine_name VARCHAR(255),
  quantity INT NOT NULL DEFAULT 0,
  dispensed_by BIGINT UNSIGNED NULL,
  dispensed_at DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (medicine_id) REFERENCES medicines_inventory(id) ON DELETE SET NULL,
  FOREIGN KEY (dispensed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_dispense_patient (patient_id),
  INDEX idx_dispense_time (dispensed_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Audit trail: keep the actor's display name even if the user is removed.
-- ---------------------------------------------------------------------------
-- Guarded through information_schema rather than `ADD COLUMN IF NOT EXISTS`,
-- which is a MariaDB extension that MySQL 8 does not accept.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'user_name'
);
SET @col_sql = IF(@col_exists = 0, 'ALTER TABLE audit_logs ADD COLUMN user_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @col_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
