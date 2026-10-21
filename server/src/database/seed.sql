-- Application seeding script for BIGINT Schema
--
-- The database is not selected here either: the caller chooses it, the same
-- way the schema file does. `npm run db:setup` selects it before running
-- this file, and the CI passes it on the command line.

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
TRUNCATE TABLE suppliers;
TRUNCATE TABLE medicines_inventory;
TRUNCATE TABLE medicine_batches;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE purchase_order_items;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE contraindications;
TRUNCATE TABLE notifications;
TRUNCATE TABLE notification_dedupe;
TRUNCATE TABLE medication_administrations;
TRUNCATE TABLE emergency_beds;
TRUNCATE TABLE emergency_admissions;
TRUNCATE TABLE clinical_notes;
TRUNCATE TABLE dispensing_events;
TRUNCATE TABLE vitals;
TRUNCATE TABLE shared_summaries;
TRUNCATE TABLE analytics_events;
TRUNCATE TABLE password_resets;
TRUNCATE TABLE revoked_tokens;
-- schema_migrations is deliberately NOT truncated: it is the migration
-- ledger, and clearing it would make every migration re-apply.
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
-- The role is described as "Administrator with full access", so it is granted
-- every module the routes actually guard. The previous list covered 8 of them,
-- which left /pharmacy, /documents, /purchase-orders, /staff and the dashboard
-- answering 403 for an administrator.
--
-- Module names must match the strings passed to requirePermission: the routes
-- use 'role' (singular), 'purchaseOrder' and 'financial'/'finance' alongside
-- 'users', 'patients' and so on. Note 'role', not 'roles'.
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(2, 'users', 1, 1, 1, 1),
(2, 'roles', 1, 1, 1, 1),
(2, 'role', 1, 1, 1, 1),
(2, 'hospitals', 1, 1, 1, 1),
(2, 'patients', 1, 1, 1, 1),
(2, 'appointments', 1, 1, 1, 1),
(2, 'finance', 1, 1, 1, 1),
(2, 'financial', 1, 1, 1, 1),
(2, 'settings', 1, 1, 1, 1),
(2, 'dashboard', 1, 1, 1, 1),
(2, 'documents', 1, 1, 1, 1),
(2, 'pharmacy', 1, 1, 1, 1),
(2, 'purchaseOrder', 1, 1, 1, 1),
(2, 'staff', 1, 1, 1, 1),
(2, 'supplier', 1, 1, 1, 1),
-- Emergency triage board and ER bed state. The module string is the one the
-- emergency routes guard with requirePermission('emergency', ...).
(2, 'emergency', 1, 1, 1, 1);
-- Doctor permissions (role_id = 3)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(3, 'patients', 1, 1, 1, 0),
(3, 'appointments', 1, 1, 1, 0),
(3, 'medical_history', 1, 1, 1, 0),
-- A doctor runs the triage board: they may read it, admit patients and
-- update an admission. `can_delete` stays 0, so a code blue broadcast
-- (which the emergency routes guard with the 'delete' action) is reserved
-- for the roles that are allowed to raise one.
(3, 'emergency', 1, 1, 1, 0);
-- Patient permissions (role_id = 4)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(4, 'appointments', 1, 1, 0, 0),
(4, 'medical_history', 1, 0, 0, 0);
-- Nurse permissions (role_id = 5)
INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES
(5, 'patients', 1, 0, 1, 0),
(5, 'appointments', 1, 1, 1, 0),
(5, 'medical_history', 1, 1, 1, 0),
-- A nurse works the board: they read it and update an admission (triage
-- level, condition, vitals). They do not admit, and they do not broadcast.
(5, 'emergency', 1, 0, 1, 0);
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
-- The password column holds a PLACEHOLDER, not a hash. The seed runner
-- (`npm run db:setup` in server/) generates a bcrypt hash for each account
-- from the password configured in the environment -- SEED_SUPER_ADMIN_PASSWORD,
-- SEED_ADMIN_PASSWORD, SEED_DOCTOR_PASSWORD and SEED_PATIENT_PASSWORD -- and
-- substitutes it here. Nothing about a credential is written in the
-- repository, and no hash is shared between accounts or deployments.
--
-- Running this file straight through the mysql client instead of the runner
-- leaves the placeholder in the password column, and those accounts then
-- cannot sign in. Use the runner.
--
-- These are development-only accounts for a local seed. If this seed is ever
-- applied anywhere reachable, set the SEED_*_PASSWORD variables to values
-- that are not shared with anything else, and rotate them before doing
-- anything else.
--
-- totp_secret is base32 of JBSWY3DPEHPK3PXP (demo seed) for the clinical
-- accounts, so their two-factor path is exercisable out of the box.
--
-- The super admin AND the hospital admin are seeded WITHOUT a totp_secret
-- (NULL). A seeded secret forces a TOTP prompt on sign-in, which locks a fresh
-- checkout out of both privileged consoles until someone has the seeded app's
-- code. Instead both sign in with credentials and enrol two-factor themselves
-- from their own settings surfaces (/super-admin/settings and /settings), which
-- is where the setup belongs for a privileged account: the operator chooses the
-- moment it becomes mandatory.
INSERT INTO users (id, role_id, email, password, name, totp_secret, hospital_id, department_id) VALUES
(1, 1, 'superadmin@smarthealth.com', '${SEED_SUPER_ADMIN_PASSWORD_HASH}', 'Super Admin', NULL, 1, NULL), -- two-factor NOT enrolled by default
(2, 2, 'admin@smarthealth.com', '${SEED_ADMIN_PASSWORD_HASH}', 'Admin User', NULL, 1, 1), -- two-factor NOT enrolled by default
(3, 3, 'doctor@smarthealth.com', '${SEED_DOCTOR_PASSWORD_HASH}', 'Dr. Smith', 'GEZDGNBVGY3TQOJQ', 1, 1),
(4, 4, 'patient@smarthealth.com', '${SEED_PATIENT_PASSWORD_HASH}', 'John Doe', 'GEZDGNBVGY3TQOJQ', 1, NULL);

-- 6. Seed Staff
INSERT INTO staff (id, staff_id, user_id, first_name, last_name, role, department_id, hospital_id, email, phone, join_date) VALUES
-- The role holds the role NAME, and the names in `roles` are lowercase. A
-- capitalised value here matched no role, so the staff editor could not find
-- the role to send back.
(1, 'STAFF-001', 3, 'John', 'Smith', 'doctor', 1, 1, 'doctor@smarthealth.com', '555-5678', '2022-01-15');

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
-- Expiry dates are relative to the current date. Hard-coded dates went stale
-- and every seeded medicine was treated as expired, which made the pharmacy
-- and prescription paths unusable.
INSERT INTO medicines (id, medicine_id, name, category, stock, min_stock, price, expiry_date, supplier) VALUES
(1, 'MED-001', 'Paracetamol 500mg', 'Painkiller', 1000, 100, 5.50, DATE_ADD(CURDATE(), INTERVAL 300 DAY), 'Pharma Inc.');

-- 13.1 Seed Suppliers (purchase orders reference a supplier)
INSERT INTO suppliers (id, name, contact_person, email, phone, address) VALUES
(1, 'Pharma Inc.', 'Ada Mensah', 'orders@pharmainc.example', '+233200000001', 'Industrial Area, Accra'),
(2, 'MedLife Supplies', 'Kwame Owusu', 'sales@medlife.example', '+233200000002', 'Spintex, Accra');

-- 13.2 Seed Pharmacy Inventory (the pharmacy module reads this table)
INSERT INTO medicines_inventory (id, medicine_name, category, supplier, supplier_id, stock_level, low_stock_threshold, unit_price, expiry_date, storage_location) VALUES
('MED-001', 'Paracetamol 500mg', 'Painkiller', 'Pharma Inc.', 1, 1000, 100, 5.50, DATE_ADD(CURDATE(), INTERVAL 300 DAY), 'Shelf A1'),
('MED-002', 'Amoxicillin 500mg', 'Antibiotic', 'Pharma Inc.', 1, 240, 50, 8.25, DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'Shelf B2'),
('MED-003', 'Metformin 500mg', 'Antidiabetic', 'MedLife Supplies', 2, 180, 40, 12.00, DATE_ADD(CURDATE(), INTERVAL 240 DAY), 'Shelf C1'),
('MED-004', 'Lisinopril 10mg', 'Antihypertensive', 'MedLife Supplies', 2, 60, 40, 9.40, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'Shelf C3');

-- 13.3 Seed Drug Interaction Rules
-- Without these rows the contraindication check can never fire, because the
-- table starts empty on a fresh install.
INSERT INTO contraindications (category_a, category_b, severity, description) VALUES
('NSAID', 'Antibiotic', 'high', 'NSAIDs alongside antibiotics raise the risk of gastrointestinal bleeding'),
('Anticoagulant', 'NSAID', 'high', 'Anticoagulants with NSAIDs significantly increase bleeding risk'),
('Opioid', 'Benzodiazepine', 'moderate', 'Opioids with benzodiazepines risk respiratory depression'),
('Statin', 'Fibrate', 'moderate', 'Statins with fibrates risk muscle damage'),
('Antibiotic', 'NSAID', 'high', 'NSAIDs alongside antibiotics raise the risk of gastrointestinal bleeding');

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
-- The application name is rendered by the seed runner (see config/app.ts): the
-- seeded system name follows the configured application name.
INSERT INTO settings (setting_key, setting_value, category, updated_by) VALUES
('system_name', '${APP_NAME}', 'general', 2),
('default_language', 'en', 'localization', 2),
('patient_portal_enabled', 'true', 'features', 2);

-- 17. Seed Super Admin Settings
INSERT INTO super_admin_settings (setting_key, setting_value, category, updated_by) VALUES
('maintenance_mode', 'false', 'system', 1);

-- 18. Seed Audit Logs
INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES
(1, 'CREATE', 'users', 1, 'Super Admin user created'),
(2, 'CREATE', 'users', 2, 'Admin user created');
