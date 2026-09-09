# Smart Health Manager - Product Requirements Document (PRD)

## 1. Executive Summary & Product Vision
**Smart Health Manager** is an enterprise-grade, web-based clinical management and health analytics platform designed for modern hospitals, medical centers, and multi-specialty healthcare networks. It provides healthcare professionals—including clinicians, nurses, pharmacists, administrators, and super-admins—with real-time tools for patient biometric tracking, automated triage, staff capacity load balancing, pharmacy compliance tracking, billing, and system auditing.

The platform prioritizes high operational performance, strict data privacy, rapid clinical decision-making, and an intuitive user experience featuring responsive analytics and dark/light theme flexibility.

---

## 2. Target User Roles & Permissions Matrix

| User Role | Primary Responsibilities | Access Scope |
| :--- | :--- | :--- |
| **Super Admin** | Network-wide governance, hospital onboarding, license management, system audit logs | Multi-hospital network scope; full system admin rights |
| **Hospital Admin** | Staff allocation, capacity management, scheduling, financial oversight, clinical compliance | Facility-wide access; staff and department controls |
| **Clinician / Physician** | Patient examination, vitals logging, diagnostic alerts review, video consults, prescriptions | Full clinical access for assigned & ward patients |
| **Nurse / Caregiver** | Daily vitals recording, patient intake, rapid QR scanning, medication administration | Clinical intake and patient management scope |
| **Pharmacist** | Prescription fulfillment, medication inventory, drug interaction checks, refill requests | Pharmacy & medication management module |
| **Billing Specialist** | Invoice generation, insurance claims processing, payment tracking, financial reporting | Financials & billing module |
| **Patient (Portal)** | Public progress tracking via encrypted tokens, appointment views, personal vitals pass | Personal record scope only (via secure shared link) |

---

## 3. Core Functional Requirements

### 3.1 Patient Vitals & Biometric Tracking Module
- **Biometric Data Logging**: Capture Systolic & Diastolic Blood Pressure (mmHg), Heart Rate (bpm), Body Temperature (°C/°F), Oxygen Saturation (SpO2 %), and Respiratory Rate (bpm) with clinician notes.
- **Diagnostic Helper & Outlier Alerts**: Automatically analyze incoming readings against clinical standards (AHA/ACC guidelines). Highlight abnormal readings in bold red text with glowing alert borders and trigger stat clinician notifications.
- **Rapid Intake QR Code Generator**: Generate encrypted PNG QR codes containing patient metadata, latest biometrics, and triage classification for rapid admission and scanning.
- **Side-by-Side Baseline Comparison**: Compare current session vitals against the previous session's baseline data with delta indicators (+/-) and directional trend badges.
- **Health Trend Insight Badge**: Calculate longitudinal regression across historical records to assign a 'Health Trend' badge (`Improving`, `Stable`, `Concerning`) alongside a Biometric Stability Index score (0–100%).
- **Clinical PDF & CSV Export**: Generate high-fidelity A4 PDF clinical summary reports with embedded charts and signatures, as well as raw CSV logs.

### 3.2 Staff Capacity & Workload Balancer
- **Live Utilization Tracking**: Real-time capacity metrics (scheduled vs. maximum appointments) with shift filtering (`Morning`, `Afternoon`, `Night`, `All Shifts`).
- **Over-Quota Alerts**: Visual pulsing status badges (`DAILY THRESHOLD EXCEEDED`) flagging overloaded clinicians.
- **7-Day AI Workload Forecast**: Predictive workload modeling identifying surge days, peak patient loads, and risk levels (`Low`, `Moderate`, `High`).
- **Trend Fluctuation Charts**: Mini Recharts `<LineChart>` inside expandable rows showing 7-day clinician load history against threshold reference lines.
- **Utilization Reports**: Instant PDF and CSV reporting for hospital utilization auditing.

### 3.3 Smart Appointment Scheduling & Notification System
- **Status Workflows**: Track appointments through `Pending Confirmation`, `Confirmed`, `Checked In`, and `Completed` statuses.
- **Notification Engine**: Header notification bell with badge counters alerting staff to pending appointment authorizations and urgent triage updates.
- **One-Click Actions**: Quick confirmation dispatches and reminder dispatches directly from notifications and dashboard widgets.

### 3.4 Global Search & Navigation Header
- **Cmd+K Overlay**: Global search bar positioned in the app header supporting keyboard navigation (`Cmd+K` / `Ctrl+K`).
- **Multi-Entity Lookup**: Instant search across Patients (Name, MRN, Phone), Staff (Name, Department), Appointments (Date, Status), and Application Navigation routes.

### 3.5 Pharmacy & Medication Compliance
- **Compliance Tracker**: Visual adherence percentages per patient with missed dose warnings.
- **Drug Interaction Checker**: Real-time cross-referencing of active prescriptions for adverse contraindications.
- **Refill Management**: Streamlined processing of patient refill requests and stock inventory alerts.

### 3.6 Financials & Insurance Billing
- **Claim Processing**: Automated status tracking (`Pending`, `Approved`, `Rejected`, `Paid`) for insurance claims.
- **Invoice Ledger**: Patient billing breakdown with downloadable receipts and itemized service charges.

### 3.7 Super Admin Multi-Tenancy & Security
- **Hospital Onboarding**: Multi-facility setup with license key validation and expiration management.
- **Two-Factor Authentication (2FA)**: Mandatory TOTP setup with backup recovery codes for administrative roles.
- **Audit Trail Viewer**: Searchable system event logs tracking user logins, record modifications, and privilege escalations.

---

## 4. Non-Functional Requirements

### 4.1 Performance & Scalability
- Initial SPA bundle load under **2.0 seconds** on standard broadband.
- Recharts visualizations rendering smooth 60fps animations for datasets up to 1,000 biometric points.
- Server response times under **150ms** for API proxy endpoints.

### 4.2 Security & Compliance
- **Data Protection**: OWASP-compliant headers, HttpOnly session cookies, CSRF protection, and rate limiting.
- **Secret Management**: Zero exposure of sensitive keys to the browser client; server-side proxy handling.

### 4.3 Accessibility & Usability
- Full compliance with WCAG 2.1 AA standards, including keyboard navigation, high-contrast text ratios, and screen-reader accessible ARIA roles.
- User-facing Dark/Light mode theme switch with persistent preference storage.
