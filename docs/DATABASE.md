# Database & Data Model Specification - Smart Health Manager

## 1. Relational Entity Relationship Diagram (ERD) Schema

```
+----------------+      +-------------------+      +---------------------+
|    hospitals   |1    *|       users       |1    *|  two_factor_creds   |
+----------------+------ +-------------------+------+---------------------+
| id (PK)        |      | id (PK)           |      | user_id (FK)        |
| name           |      | hospital_id (FK)  |      | secret_key          |
| license_key    |      | email             |      | is_enabled          |
| status         |      | role              |      +---------------------+
+----------------+      +-------------------+
                                  | 1
                                  | *
+----------------+      +-------------------+      +---------------------+
|    patients    |1    *|  vitals_records   |1    *|   critical_alerts   |
+----------------+------ +-------------------+------+---------------------+
| id (PK)        |      | id (PK)           |      | id (PK)             |
| mrn            |      | patient_id (FK)   |      | vital_record_id(FK) |
| name           |      | recorded_by (FK)  |      | patient_id (FK)     |
| dob            |      | systolic_bp       |      | severity            |
| blood_type     |      | diastolic_bp      |      | status              |
+----------------+      | heart_rate        |      +---------------------+
                        | temperature       |
                        | spo2              |
                        +-------------------+
```

---

## 2. Table Definitions & Field Schemas

### 2.1 `vitals_records`
Primary ledger for patient biometric readings.
```sql
CREATE TABLE vitals_records (
  id VARCHAR(36) PRIMARY KEY,
  patient_id VARCHAR(36) NOT NULL,
  recorded_by VARCHAR(36) NOT NULL,
  systolic_bp INT NOT NULL,
  diastolic_bp INT NOT NULL,
  heart_rate INT NOT NULL,
  temperature DECIMAL(4,1) NOT NULL, -- Stored in Celsius
  oxygen_saturation INT NULL,
  respiratory_rate INT NULL,
  status ENUM('normal', 'elevated', 'high', 'critical') DEFAULT 'normal',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE INDEX idx_vitals_patient_time ON vitals_records(patient_id, created_at DESC);
```

---

### 2.2 `staff_members`
Stores clinician capacity, weekly quotas, and shift allocations.
```sql
CREATE TABLE staff_members (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  hospital_id VARCHAR(36) NOT NULL,
  department VARCHAR(100) NOT NULL,
  shift ENUM('Morning', 'Afternoon', 'Night') DEFAULT 'Morning',
  max_capacity INT DEFAULT 12,
  weekly_quota INT DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);
```

---

### 2.3 `appointments`
Tracks scheduled and completed patient consultations.
```sql
CREATE TABLE appointments (
  id VARCHAR(36) PRIMARY KEY,
  patient_id VARCHAR(36) NOT NULL,
  clinician_id VARCHAR(36) NOT NULL,
  appointment_date DATETIME NOT NULL,
  shift ENUM('Morning', 'Afternoon', 'Night') NOT NULL,
  status ENUM('pending', 'confirmed', 'checked_in', 'completed', 'cancelled') DEFAULT 'pending',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (clinician_id) REFERENCES staff_members(id)
);

CREATE INDEX idx_appointments_clinician_date ON appointments(clinician_id, appointment_date);
```

---

### 2.4 `audit_logs`
Cryptographic system activity log for compliance and security audits.
```sql
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  hospital_id VARCHAR(36) NULL,
  actor_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_resource VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Data Archiving & Retention Policy
- **Active Data**: Vitals logs within 24 months are indexed and queryable instantly.
- **HIPAA Compliance Retention**: Historical biometric ledgers and medical records are retained for **7 years**.
- **Shared Access Tokens**: Temporary portal tokens (`/api/shared/patient-summary`) expire automatically after **15 minutes** and are purged daily.
