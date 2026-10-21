-- Application database schema (BIGINT Schema)
--
-- The schema does not select a database. A schema file that picks its own
-- database quietly defeats the caller: the CI applied this file to its test
-- database and the tests then ran against an empty one, which turned the
-- database-backed checks into silent skips.
--
-- The caller chooses: `npm run db:setup` creates and selects the database
-- first, and the CI passes the database on the command line.

-- 1. Roles table
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  user_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'locked') DEFAULT 'active',
  login_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  last_login DATETIME NULL,
  password_must_change BOOLEAN DEFAULT FALSE,
  -- The account's token version. It changes when the credentials change, and
  -- a token minted before the change stops being accepted.
  token_version INT NOT NULL DEFAULT 0,
  password_changed_at DATETIME NULL,
  password_postpone_count INT DEFAULT 0,
  totp_secret VARCHAR(64) NULL,
  recovery_codes JSON NULL,
  hospital_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  onedrive_access_token TEXT NULL,
  onedrive_refresh_token TEXT NULL,
  googledrive_access_token TEXT NULL,
  googledrive_refresh_token TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- 3. Permissions for each role
CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  module VARCHAR(50) NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_add BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  UNIQUE KEY unique_role_module (role_id, module),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 4. Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hospital_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  departments INT DEFAULT 0,
  staff_count INT DEFAULT 0,
  beds INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hospital_id (hospital_id),
  INDEX idx_status (status)
);

-- 5. Departments table
CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hospital_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  head_of_department VARCHAR(255),
  staff_count INT DEFAULT 0,
  beds INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- users affiliation: hospitals/departments are created after users above, so
-- the FK constraints are wired in a follow-up ALTER for fresh installs.
--
-- Re-running this file on a database that already has these constraints failed
-- with ER_FK_DUP_NAME, because the constraints are added without IF NOT EXISTS
-- support in MySQL. The tables themselves use CREATE TABLE IF NOT EXISTS, so
-- the file was otherwise written to be safely re-runnable.
--
-- The two constraints are therefore added through a guarded statement: the
-- name is looked up in information_schema first, and the ALTER only runs when
-- it is missing. A prepared statement is used because the constraint name has
-- to be a literal -- MySQL will not accept a bound parameter there.
SET @fk_hospital_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_hospital'
);
SET @fk_hospital_sql = IF(
  @fk_hospital_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @fk_hospital_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_department_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_department'
);
SET @fk_department_sql = IF(
  @fk_department_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @fk_department_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Staff table
CREATE TABLE IF NOT EXISTS staff (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(20) UNIQUE NOT NULL,
  user_id BIGINT UNSIGNED UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  department_id BIGINT UNSIGNED,
  hospital_id BIGINT UNSIGNED,
  email VARCHAR(255),
  -- Wide enough to hold the encrypted form of the value.
  phone VARCHAR(255),
  join_date DATE,
  status ENUM('active', 'on_leave', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  INDEX idx_staff_id (staff_id),
  INDEX idx_status (status)
);

-- 7. Patients table
CREATE TABLE IF NOT EXISTS patients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  age INT,
  gender ENUM('male', 'female', 'other'),
  -- Wide enough to hold the encrypted form of the value.
  phone VARCHAR(255),
  email VARCHAR(255),
  address TEXT,
  hospital_id BIGINT UNSIGNED,
  last_visit DATE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patient_id (patient_id),
  INDEX idx_status (status),
  -- The index the tenant filter needs: the list of a hospital's patients,
  -- newest first.
  INDEX idx_patients_hospital_created (hospital_id, created_at, id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
);

-- 8. Medical History table
CREATE TABLE IF NOT EXISTS medical_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  condition_name VARCHAR(255),
  diagnosis_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 9. Allergies table
CREATE TABLE IF NOT EXISTS allergies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  allergen VARCHAR(255) NOT NULL,
  severity ENUM('mild', 'moderate', 'severe'),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 10. Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id VARCHAR(20) UNIQUE NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED,
  department_id BIGINT UNSIGNED,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  type VARCHAR(50),
  status ENUM('scheduled', 'confirmed', 'completed', 'cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_appointment_id (appointment_id),
  INDEX idx_date (appointment_date),
  INDEX idx_status (status),
  INDEX idx_appointments_status_start (status, appointment_date, appointment_time)
);

-- 11. Appointment Reminders table
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNSIGNED NOT NULL,
  reminder_date DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- 12. Documents table
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED,
  document_type VARCHAR(100),
  document_id VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  category ENUM('medical_record', 'lab_report', 'prescription', 'administrative'),
  file_path VARCHAR(500),
  file_size BIGINT,
  storage_type VARCHAR(20) DEFAULT 'local',
  notes TEXT NULL,
  uploaded_by BIGINT UNSIGNED,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_document_id (document_id),
  INDEX idx_category (category)
);

-- 12.1 Tags table
CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- 12.2 Document_Tags table
CREATE TABLE IF NOT EXISTS document_tags (
  document_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 13. Medicines table
CREATE TABLE IF NOT EXISTS medicines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  medicine_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  stock INT DEFAULT 0,
  min_stock INT DEFAULT 0,
  price DECIMAL(10, 2),
  expiry_date DATE,
  supplier VARCHAR(255),
  status ENUM('in_stock', 'low_stock', 'out_of_stock') DEFAULT 'in_stock',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_medicine_id (medicine_id),
  INDEX idx_status (status)
);

-- 14. Chart of Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('asset', 'liability', 'income', 'expense') NOT NULL,
  parent_id BIGINT UNSIGNED,
  level INT DEFAULT 0,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_account_code (account_code),
  INDEX idx_type (type)
);

-- 15. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(20) UNIQUE NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  account_id BIGINT UNSIGNED NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  balance DECIMAL(15, 2) DEFAULT 0,
  reference VARCHAR(50),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_date (date)
);

-- 16. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  -- Record ids are not uniform: numeric primary keys on most tables, string
  -- keys on the pharmacy tables. Stored as text so both are recordable.
  record_id VARCHAR(64),
  -- The actor's display name is kept so the trail still reads correctly if
  -- the user is later removed.
  user_name VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_module (module),
  INDEX idx_created_at (created_at)
);

-- 17. Settings table
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  category VARCHAR(50),
  updated_by BIGINT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 18. Super Admin Settings table
CREATE TABLE IF NOT EXISTS super_admin_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  category VARCHAR(50),
  updated_by BIGINT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 19. Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 20. Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) UNIQUE NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  hospital_id BIGINT UNSIGNED NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  status ENUM('pending', 'ordered', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  total_amount DECIMAL(15, 2) DEFAULT 0,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_status (status),
  INDEX idx_po_hospital (hospital_id)
);

-- 13.1 Medicines Inventory table (used by pharmacy module)
CREATE TABLE IF NOT EXISTS medicines_inventory (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  medicine_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  supplier VARCHAR(255),
  supplier_id BIGINT UNSIGNED NULL,
  -- The hospital the stock belongs to. The stock is per hospital, so a
  -- hospital's low-stock list is its own.
  hospital_id BIGINT UNSIGNED NULL,
  stock_level INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  expiry_date DATE,
  storage_location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inventory_stock (low_stock_threshold, stock_level),
  INDEX idx_inventory_expiry (expiry_date),
  INDEX idx_inventory_hospital (hospital_id)
);

-- 20.0 Purchase Order Items table
-- Declared after the inventory table, because the line items reference it.
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
);

-- 20.1 Medicine Batches table
CREATE TABLE IF NOT EXISTS medicine_batches (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  medicine_id VARCHAR(64) NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INT DEFAULT 0,
  recalled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines_inventory(id) ON DELETE CASCADE
);

-- 21. Prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED,
  medicine_id VARCHAR(64) NOT NULL,
  dose VARCHAR(100),
  frequency VARCHAR(100),
  quantity INT DEFAULT 0,
  -- How long the prescription is valid for. Drives the refill rule.
  duration_days INT NULL,
  status ENUM('new','dispensed','cancelled') DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (medicine_id) REFERENCES medicines_inventory(id) ON DELETE RESTRICT
);

-- 22. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(20) UNIQUE NOT NULL,
  patient_id BIGINT UNSIGNED,
  date DATE NOT NULL,
  due_date DATE,
  status ENUM('draft','finalized','paid','cancelled') DEFAULT 'draft',
  total_amount DECIMAL(15,2) DEFAULT 0,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_status (status)
);

-- 22.1 Invoice Items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- 23. Payments table
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(20) UNIQUE NOT NULL,
  invoice_id BIGINT UNSIGNED,
  amount DECIMAL(15,2) NOT NULL,
  method ENUM('cash','card','bank','other') DEFAULT 'other',
  date DATE NOT NULL,
  reference VARCHAR(50),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payment_id (payment_id)
);

-- 24. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_id VARCHAR(20) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  vendor VARCHAR(255),
  date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_expense_id (expense_id),
  INDEX idx_category (category)
);

-- 25. Payroll table
CREATE TABLE IF NOT EXISTS payroll (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payroll_id VARCHAR(20) UNIQUE NOT NULL,
  staff_id BIGINT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_amount DECIMAL(15,2) NOT NULL,
  deductions DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  status ENUM('processed','pending') DEFAULT 'processed',
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 26. Tax Rules table
CREATE TABLE IF NOT EXISTS tax_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  applies_to ENUM('income','invoice','payroll','expense') NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL
);

-- 27. Forecasts table
CREATE TABLE IF NOT EXISTS forecasts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  metric ENUM('income','expense','cash_flow') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  predicted_value DECIMAL(15,2) NOT NULL,
  model VARCHAR(50) NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 28. WebAuthn passkey credentials (real browser attestation/assertion)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  credential_id VARCHAR(255) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INT NOT NULL DEFAULT 0,
  device_name VARCHAR(120) NOT NULL DEFAULT 'Passkey',
  transports JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_webauthn_user (user_id)
);

-- 29. Drug interaction rules (read by the drug-interaction service)
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
);

-- 30. Password reset tokens (only the hash is stored, and every row expires)
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
);

-- 31. Patient vitals
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
);

-- 32. Time-limited patient summary share links
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
);

-- 33. Analytics event sink
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
);

-- 34. Revoked access tokens (logout invalidates the token it is handed)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_revoked_token (token_hash),
  INDEX idx_revoked_expiry (expires_at)
);

-- 35. Notifications (per-user inbox)
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
);

-- 35.1 Idempotency marker for the upcoming-appointment alert
CREATE TABLE IF NOT EXISTS notification_dedupe (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  dedupe_key VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_dedupe (user_id, dedupe_key),
  INDEX idx_dedupe_created (created_at)
);

-- 36. Medication administration records (MAR)
CREATE TABLE IF NOT EXISTS medication_administrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  medicine_id VARCHAR(64) NULL,
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  -- Units consumed by this dose. NULL means it is derived from the dosage
  -- text, which is unreliable for doses written in words.
  quantity INT NULL,
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
);

-- 37. Emergency beds and admissions
CREATE TABLE IF NOT EXISTS emergency_beds (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  -- The hospital the bay belongs to. The board is per hospital.
  hospital_id BIGINT UNSIGNED NULL,
  status ENUM('occupied', 'available', 'cleaning') DEFAULT 'available',
  patient_id BIGINT UNSIGNED NULL,
  triage_level VARCHAR(20) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_erbed_hospital (hospital_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS emergency_admissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  -- The hospital the admission belongs to. It is the hospital of the patient
  -- who was admitted, and it is what the board is narrowed by.
  hospital_id BIGINT UNSIGNED NULL,
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
  INDEX idx_eradmission_patient (patient_id),
  INDEX idx_eradmission_hospital (hospital_id)
);

-- 38. Clinical notes
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
);

-- 39. Dispensing events
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
);