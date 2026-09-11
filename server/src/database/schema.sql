-- Smart Health Manager (BIGINT Schema)

CREATE DATABASE IF NOT EXISTS smart_health_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_health_manager;

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
ALTER TABLE users
  ADD CONSTRAINT fk_users_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

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
  phone VARCHAR(20),
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
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  hospital_id BIGINT UNSIGNED,
  last_visit DATE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patient_id (patient_id),
  INDEX idx_status (status),
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
  status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_appointment_id (appointment_id),
  INDEX idx_date (appointment_date),
  INDEX idx_status (status)
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
  document_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  category ENUM('medical_record', 'lab_report', 'prescription', 'administrative'),
  file_path VARCHAR(500),
  file_size BIGINT,
  storage_type ENUM('local', 'cloud') DEFAULT 'local',
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
  record_id BIGINT UNSIGNED,
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
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  status ENUM('pending', 'ordered', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  total_amount DECIMAL(15, 2) DEFAULT 0,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
-- 13.1 Medicines Inventory table (used by pharmacy module)
CREATE TABLE IF NOT EXISTS medicines_inventory (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  medicine_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  supplier VARCHAR(255),
  stock_level INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  expiry_date DATE,
  storage_location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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