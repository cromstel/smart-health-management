-- Smart MediCare Seeding Script for BIGINT Schema

-- Use the correct database
USE smart_medicare;

-- Disable foreign key checks and truncate all tables to reset them
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE roles;
TRUNCATE TABLE users;
TRUNCATE TABLE permissions;
TRUNCATE TABLE hospitals;
TRUNCATE TABLE departments;
TRUNCATE TABLE staff;
TRUNCATE TABLE patients;
TRUNCATE TABLE medical_history;
TRUNCATE TABLE allergies;
TRUNCATE TABLE appointments;
TRUNCATE TABLE appointment_reminders;
TRUNCATE TABLE documents;
TRUNCATE TABLE medicines;
TRUNCATE TABLE accounts;
TRUNCATE TABLE transactions;
TRUNCATE TABLE invoices;
TRUNCATE TABLE invoice_items;
TRUNCATE TABLE payments;
TRUNCATE TABLE expenses;
TRUNCATE TABLE payroll;
TRUNCATE TABLE tax_rules;
TRUNCATE TABLE forecasts;
TRUNCATE TABLE settings;
TRUNCATE TABLE super_admin_settings;
TRUNCATE TABLE audit_logs;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Seed Roles
INSERT INTO roles (id, name, description) VALUES
(1, 'super_admin', 'Super Administrator with ultimate control'),
(2, 'admin', 'Administrator with full access'),
(3, 'doctor', 'Medical doctor with access to patient data'),
(4, 'patient', 'Patient with access to their own data'),
(5, 'nurse', 'Registered nurse with clinical care access'),
(6, 'pharmacist', 'Pharmacist with medication-management access');

-- 2. Seed Permissions for Roles
-- Super Admin permissions (role_id = 1)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(1, 'all', 1, 1, 1, 1);
-- Admin permissions (role_id = 2)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(2, 'users', 1, 1, 1, 1),
(2, 'roles', 1, 1, 1, 1),
(2, 'hospitals', 1, 1, 1, 1),
(2, 'patients', 1, 1, 1, 1),
(2, 'appointments', 1, 1, 1, 1),
(2, 'finance', 1, 1, 1, 1),
(2, 'financial', 1, 1, 1, 1),
(2, 'settings', 1, 1, 1, 1);
-- Doctor permissions (role_id = 3)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(3, 'patients', 1, 1, 1, 0),
(3, 'appointments', 1, 1, 1, 0),
(3, 'medical_history', 1, 1, 1, 0);
-- Patient permissions (role_id = 4)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(4, 'appointments', 1, 1, 0, 0),
(4, 'medical_history', 1, 0, 0, 0);
-- Nurse permissions (role_id = 5)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(5, 'patients', 1, 0, 1, 0),
(5, 'appointments', 1, 1, 1, 0),
(5, 'medical_history', 1, 1, 1, 0);
-- Pharmacist permissions (role_id = 6)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(6, 'pharmacy', 1, 1, 1, 0),
(6, 'inventory', 1, 1, 1, 0);

-- 3. Seed Hospitals
-- Ordered by dependency: roles, then permissions, then hospitals and
-- departments, then users. users.hospital_id and users.department_id both
-- reference rows inserted after this point in the original ordering, which
-- only worked because FOREIGN_KEY_CHECKS was disabled for the whole script.
-- Seeding in dependency order is correct on its own terms rather than relying
-- on a session setting that a strict SQL mode may reject.
INSERT INTO hospitals (id, hospital_id, name, address, phone, email) VALUES
(1, 'HOSP-001', 'General Hospital', '123 Main St, Anytown, USA', '555-1234', 'contact@generalhospital.com');

-- 4. Seed Departments
INSERT INTO departments (id, hospital_id, name, head_of_department) VALUES
(1, 1, 'Cardiology', 'Dr. Heart'),
(2, 1, 'Orthopedics', 'Dr. Bones');

-- 5. Seed Users
-- After hospitals and departments, because hospital_id and department_id are
-- foreign keys into the two blocks above.
--
-- Password hashes are bcrypt (cost 10) over the demo credentials documented in
-- README.md and DOCUMENTATION.md section 5. They previously all shared one hash
-- that was commented "password is 'password'" but did not in fact verify against
-- any known value, so none of the documented demo logins could succeed against a
-- real database.
--
-- These are development-only accounts for a local seed. If this seed is ever
-- applied anywhere reachable, rotate them before doing anything else.
-- totp_secret is the base32 form of JBSWY3DPEHPK3PXP (demo seed).
INSERT INTO users (id, role_id, email, password, name, totp_secret, hospital_id, department_id) VALUES
(1, 1, 'superadmin@smarthealth.com', '$2b$10$Pe2N6QgTLKg/tLgWsHY8B.GfFBeQTMs3XXxTLoT3YzcEbH9fNTF1.', 'Super Admin', 'GEZDGNBVGY3TQOJQ', 1, NULL), -- password: April--2024!!!!
(2, 2, 'admin@smarthealth.com', '$2b$10$.YOxfK6xC5.qL.nhydYg6ewcMTa21QdjT0w4f7LR1VeXgSzG1fqtu', 'Admin User', 'GEZDGNBVGY3TQOJQ', 1, 1), -- password: Pass@135709
(3, 3, 'doctor@smarthealth.com', '$2b$10$anoAXsLwXJ4D1fUIiwQ0nOijk1vMIo9NITxEzqrqdLlNKAgLGyVUu', 'Dr. Smith', 'GEZDGNBVGY3TQOJQ', 1, 1), -- password: Demo@135790
(4, 4, 'patient@smarthealth.com', '$2b$10$cmFAQ0Oo1C6zXxB8htEJIOCiw6szAuZ8qbOZXUK83e74hSyiX0Iw2', 'John Doe', 'GEZDGNBVGY3TQOJQ', 1, NULL); -- password: P@ssword135

-- 6. Seed Staff
INSERT INTO staff (id, staff_id, user_id, first_name, last_name, role, department_id, hospital_id, email, phone, join_date) VALUES
(1, 'STAFF-001', 3, 'John', 'Smith', 'Doctor', 1, 1, 'doctor@smarthealth.com', '555-5678', '2022-01-15');

-- 7. Seed Patients
INSERT INTO patients (id, patient_id, first_name, last_name, age, gender, phone, email, address, hospital_id, last_visit) VALUES
(1, 'PAT-001', 'John', 'Doe', 45, 'male', '555-8765', 'patient@smarthealth.com', '456 Oak Ave, Anytown, USA', 1, '2023-10-26');

-- 8. Seed Medical History
INSERT INTO medical_history (patient_id, condition_name, diagnosis_date, notes) VALUES
(1, 'Hypertension', '2020-05-10', 'Managed with medication.');

-- 9. Seed Allergies
INSERT INTO allergies (patient_id, allergen, severity, notes) VALUES
(1, 'Penicillin', 'severe', 'Causes anaphylactic shock.');

-- 10. Seed Appointments
INSERT INTO appointments (id, appointment_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status) VALUES
(1, 'APP-001', 1, 1, 1, CURDATE() + INTERVAL 1 DAY, '10:00:00', 'Consultation', 'scheduled');

-- 11. Seed Appointment Reminders
INSERT INTO appointment_reminders (appointment_id, reminder_date) VALUES
(1, CURDATE() + INTERVAL 1 DAY - INTERVAL 1 HOUR);

-- 12. Seed Documents
INSERT INTO documents (id, patient_id, document_type, document_id, name, file_type, category, storage_type, uploaded_by) VALUES
(1, 1, 'Lab Report', 'DOC-001', 'Blood Test Results', 'pdf', 'lab_report', 'local', 2);

-- 13. Seed Medicines
INSERT INTO medicines (id, medicine_id, name, category, stock, min_stock, price, expiry_date, supplier) VALUES
(1, 'MED-001', 'Paracetamol 500mg', 'Painkiller', 1000, 100, 5.50, '2025-12-31', 'Pharma Inc.');

-- 14. Seed Chart of Accounts
INSERT INTO accounts (id, account_code, name, type, level, balance) VALUES
(1, '1000', 'Assets', 'asset', 0, 50000.00),
(2, '2000', 'Liabilities', 'liability', 0, 0.00),
(3, '3000', 'Income', 'income', 0, 0.00),
(4, '4000', 'Expenses', 'expense', 0, 0.00);

-- 15. Seed Transactions
INSERT INTO transactions (id, transaction_id, date, description, account_id, debit, credit) VALUES
(1, 'TRN-001', CURDATE(), 'Initial capital injection', 1, 50000.00, 0.00);

-- 16. Seed Settings
INSERT INTO settings (setting_key, setting_value, category, updated_by) VALUES
('system_name', 'Smart MediCare', 'general', 2),
('default_language', 'en', 'localization', 2),
('patient_portal_enabled', 'true', 'features', 2);

-- 17. Seed Super Admin Settings
INSERT INTO super_admin_settings (setting_key, setting_value, category, updated_by) VALUES
('maintenance_mode', 'false', 'system', 1);

-- 18. Seed Audit Logs
INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES
(1, 'CREATE', 'users', 1, 'Super Admin user created'),
(2, 'CREATE', 'users', 2, 'Admin user created');
