-- Performance Optimization: Add Missing Indexes
-- This migration adds indexes to improve query performance for frequently accessed columns

-- Users table indexes
CREATE INDEX idx_users_role_id ON users(role_id);

-- Permissions table indexes (composite for common queries)
CREATE INDEX idx_permissions_role_module ON permissions(role_id, module);

-- Departments table indexes
CREATE INDEX idx_departments_hospital_id ON departments(hospital_id);
CREATE INDEX idx_departments_status ON departments(status);

-- Staff table indexes
CREATE INDEX idx_staff_hospital_id ON staff(hospital_id);
CREATE INDEX idx_staff_department_id ON staff(department_id);
CREATE INDEX idx_staff_user_id ON staff(user_id);

-- Patients table indexes
CREATE INDEX idx_patients_hospital_id ON patients(hospital_id);
CREATE INDEX idx_patients_last_visit ON patients(last_visit);
CREATE INDEX idx_patients_created_at ON patients(created_at);

-- Medical History table indexes
CREATE INDEX idx_medical_history_patient_id ON medical_history(patient_id);
CREATE INDEX idx_medical_history_diagnosis_date ON medical_history(diagnosis_date);

-- Allergies table indexes
CREATE INDEX idx_allergies_patient_id ON allergies(patient_id);

-- Appointments table indexes (composite for common queries)
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_department_id ON appointments(department_id);
CREATE INDEX idx_appointments_date_status ON appointments(appointment_date, status);
CREATE INDEX idx_appointments_doctor_date_time ON appointments(doctor_id, appointment_date, appointment_time);
CREATE INDEX idx_appointments_dept_date_time ON appointments(department_id, appointment_date, appointment_time);

-- Documents table indexes
CREATE INDEX idx_documents_patient_id ON documents(patient_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_storage_type ON documents(storage_type);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at);

-- Transactions table indexes
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date_account ON transactions(date, account_id);

-- Accounts table indexes
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);
CREATE INDEX idx_accounts_type_parent ON accounts(type, parent_id);

-- Invoices table indexes
CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_date ON invoices(date);
CREATE INDEX idx_invoices_status_date ON invoices(status, date);

-- Invoice Items table indexes
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Payments table indexes
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_date ON payments(date);

-- Prescriptions table indexes
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_medicine_id ON prescriptions(medicine_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);

-- Medicine Batches table indexes
CREATE INDEX idx_medicine_batches_medicine_id ON medicine_batches(medicine_id);
CREATE INDEX idx_medicine_batches_expiry_date ON medicine_batches(expiry_date);
CREATE INDEX idx_medicine_batches_recalled ON medicine_batches(recalled);

-- Purchase Orders table indexes
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX idx_purchase_orders_created_by ON purchase_orders(created_by);

-- Audit Logs table indexes (composite for common queries)
CREATE INDEX idx_audit_logs_user_module ON audit_logs(user_id, module);
CREATE INDEX idx_audit_logs_module_created ON audit_logs(module, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Settings table indexes
CREATE INDEX idx_settings_category ON settings(category);

