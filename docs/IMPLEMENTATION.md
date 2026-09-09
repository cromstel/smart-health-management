# Technical Implementation Guide - Smart Health Manager

## 1. Overview
This document provides an in-depth technical breakdown of the key modules, component patterns, algorithms, and data structures implemented across the Smart Health Manager application.

---

## 2. Implemented Modules & Technical Details

### 2.1 Patient Vitals Module & Diagnostic Engine

Located in `/src/components/vitals/`:

#### A. Main Orchestrator (`PatientVitalsModule.tsx`)
- Manages patient selection state (`selectedPatientId`), time ranges (`7d`, `30d`, `90d`, `all`), unit toggles (`°C` / `°F`), and modal triggers (`LogVitalsDialog`, `VitalsQrCodeModal`, `VideoConsultationModal`).
- Generates high-fidelity A4 clinical PDF reports using `jsPDF` and `html2canvas`, rendering patient metadata blocks, anomaly alerts, chart snapshots, and signature lines.

#### B. Diagnostic Helper Banner (`DiagnosticHelperBanner.tsx`)
- **Outlier Logic**:
  - Blood Pressure: Systolic $\ge 140$ / Diastolic $\ge 90$ (High/Stage 2) or Systolic $\ge 180$ / Diastolic $\ge 120$ (Critical Crisis); Systolic $< 90$ / Diastolic $< 60$ (Hypotension).
  - Heart Rate: $\ge 100\text{ bpm}$ (Tachycardia) or $< 50\text{ bpm}$ (Bradycardia).
  - Temperature: $\ge 38.0^\circ\text{C}$ (Pyrexia/Fever) or $< 35.0^\circ\text{C}$ (Hypothermia).
  - Oxygen Saturation: $\text{SpO2} < 92\%$ (Hypoxemia).
- **UI Highlights**: Renders outlier values in bold red text with glowing red container borders (`text-rose-600 bg-rose-50 border-rose-300 dark:bg-rose-950/40`).
- **Clinician Dispatch**: Triggers `toast.error` upon load/entry and provides a **"Dispatch Stat Alert"** button.

#### C. Side-by-Side Baseline Comparison (`VitalsSessionComparison.tsx`)
- Sorts `vitalsList` chronologically descending (`vitalsList[0]` = Current, `vitalsList[1]` = Baseline).
- Renders a 4-column biometric comparison grid showing current readings, previous baseline readings, and calculated deltas ($\Delta \text{BP}$, $\Delta \text{HR}$, $\Delta \text{Temp}$, $\Delta \text{SpO2}$) with directional arrow badges (`ArrowUpRight`, `ArrowDownRight`, `Minus`).

#### D. Health Trend Insight Card (`HealthTrendCard.tsx`)
- Evaluates longitudinal progression across all historical records.
- Computes a **Biometric Stability Index** (0–100%) and assigns a 'Health Trend' badge:
  - `Improving`: Positive trajectory, elevated vitals returning to normal bounds.
  - `Stable`: Readings remaining consistent within normal ranges ($<5\%$ delta).
  - `Concerning`: Escalating pressure/pulse across consecutive sessions or persistent fever.

#### E. Rapid Intake QR Code Generator (`VitalsQrCodeModal.tsx`)
- Encodes structured JSON payloads containing Patient ID, Name, Triage Score, and latest biometrics using `QRCode.toDataURL()`.
- Allows clinicians to copy JSON data, download PNG QR code images, or print rapid intake passports.

---

### 2.2 Staff Capacity & Load Balancer Widget

Located in `/src/components/dashboard/StaffCapacityWidget.tsx`:

#### Features
- **Shift Filtering**: Dynamic shift selection (`All Shifts`, `Morning`, `Afternoon`, `Night`) updating utilization metrics in real-time.
- **Visual Threshold Alerts**: Bouncing badge (`DAILY THRESHOLD EXCEEDED`) and pulsing red alert bar for clinicians where $\text{load} \ge \text{maxCapacity}$.
- **7-Day AI Workload Forecast**: Interactive tab projecting future daily patient loads, risk categories (`Low`, `Moderate`, `High`), and predicted surge days.
- **Trend Line Charts**: Mini Recharts `<LineChart>` inside expandable rows displaying daily load fluctuations over the past 7 days against a red dashed reference line (`y = maxCapacity`).
- **Reporting**: Export CSV and PDF utility reports using `jsPDF`.

---

### 2.3 Global Search Overlay (`GlobalSearch.tsx`)
- Bound to `Cmd+K` / `Ctrl+K` keyboard shortcut across the app header.
- Performs fuzzy multi-field lookup across:
  - **Patients**: Matching Name, MRN ID, Email, Phone.
  - **Appointments**: Matching Patient Name, Clinician Name, Status, Date.
  - **Staff Records**: Matching Staff Name, Role, Department.
  - **Navigation Routes**: Direct links to Dashboard, Vitals, Patients, Pharmacy, Billing, Settings.

---

### 2.4 Appointment Notification Engine (`UpcomingAppointmentsAlertWidget.tsx`)
- Integrates with `NotificationContext.tsx`.
- Displays status counters for appointments (`Pending Confirmation`, `Confirmed`, `Checked In`, `Completed`).
- Features single-click confirmation triggers and dispatch reminders that broadcast system-wide notifications.

---

### 2.5 Theme Management & Styling
- Dual-mode support using Tailwind CSS v4 class utilities (`dark:` variant selectors).
- Settings page toggle button (`SettingsPage.tsx`) and header sun/moon button updating `localStorage.setItem('theme', mode)` and toggling `.dark` on `document.documentElement`.

---

## 3. Key TypeScript Interfaces

```typescript
// Vitals Record Schema
export interface VitalsRecord {
  id: string;
  patientId: string;
  patientName: string;
  recordedAt: string;
  recordedBy: string;
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  temperature: number; // in Celsius
  respiratoryRate?: number;
  oxygenSaturation?: number;
  notes?: string;
  status: 'normal' | 'elevated' | 'high' | 'critical';
}

// Clinician Capacity Schema
export interface ClinicianCapacity {
  id: string;
  name: string;
  role: string;
  department: string;
  shift: 'Morning' | 'Afternoon' | 'Night';
  currentLoad: number;
  maxCapacity: number;
  weeklyQuota: number;
  weeklyCompleted: number;
  dailyTrend: number[]; // 7-day load array
  forecast: Array<{ day: string; predictedLoad: number; riskLevel: 'low' | 'moderate' | 'high' }>;
}
```
