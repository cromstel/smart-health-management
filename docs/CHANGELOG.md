# Project Changelog - Smart Health Manager

All notable changes to the Smart Health Manager application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-09-08

### Added
- **WebAuthn Biometric Authentication**: Native WebAuthn API integration for clinician fingerprint/facial recognition login with public key registration and fallback options (`webauthn.ts`).
- **Global Voice Command Navigation**: Floating mic listener allowing hands-free voice route navigation (e.g. "Go to patients", "Open appointments") with speech feedback (`VoiceNavigationButton.tsx`).
- **Speech-to-Text Vitals Dictation**: Integrated microphone dictation inside Vitals modal parsing natural speech into BP, heart rate, temperature, SpO2, and nurse notes (`VitalsVoiceDictationButton.tsx`, `vitalsVoiceParser.ts`).
- **Emergency Mode High-Pressure Dashboard**: Header toggle simplifying UI layout, hiding non-critical widgets, and providing immediate access to trauma records and triage tools (`EmergencyModeContext.tsx`, `EmergencyModeToggle.tsx`).
- **Shift Handover Report Generator**: Concise handover summary of active patients, critical alerts, and pending tasks with secure internal messaging dispatcher (`ShiftHandoverModal.tsx`).
- **AI Inventory Forecasting**: Burn-rate analytics, depletion countdowns, epidemic surge simulator (0.8x-2.0x), and auto-generated purchase orders (`InventoryForecastingModule.tsx`).
- **Constraint-Based Shift Scheduler**: Multi-department weekly shift matrix, constraint solver auto-balancing algorithm, and clinician swap request manager (`ShiftSchedulerModule.tsx`).
- **Real-Time Wait Time Monitor**: Live department queue monitor with target thresholds, mini trend sparklines, and admin intervention triggers (`WaitTimeMonitorWidget.tsx`).
- **Post-Discharge Outreach Manager**: Automated 4-phase outreach protocol (24h, 72h, 1w, 2w), red-flag symptom screening, and 1-click physician escalation (`PostDischargeFollowupModule.tsx`).
- **Visual PWA Offline Indicator**: Header network status badge syncing with service worker state to notify clinicians during offline operation (`OfflineStatusIndicator.tsx`).
- **Form Auto-Save Engine**: LocalStorage-backed auto-save hook with normalized key sorting to prevent data loss on browser refresh (`useFormAutoSave.ts`).
- **Audit Log CSV/JSON Compliance Exporter**: Audit trail exporter generating timestamped JSON/CSV logs for HIPAA compliance reporting (`AuditContext.tsx`, `AuditLogsPage.tsx`).
- **Fault-Tolerant React Error Boundary**: Module-level error isolation boundary preventing full UI crashes on runtime exceptions (`ErrorBoundary.tsx`).

### Security & Bug Fixes
- Sanitized HTML entity interpolation in patient QR print previews to eliminate Reflected XSS risks (`PatientsPage.tsx`).
- Improved `hasPermission` handling for single-word roles and wildcard rules (`AuthContext.tsx`).
- Appended token query parameters to SSE `EventSource` connections for server-side auth stream compatibility.
- Resolved ESLint hook dependency warnings across all custom hooks and components.

---

## [1.2.0] - 2026-09-08

### Added
- **Rapid Intake QR Code Generator**: Modal component (`VitalsQrCodeModal.tsx`) producing scannable intake passes with patient ID, latest biometrics, and triage classification.
- **Diagnostic Helper Outlier Alert System**: Banner component (`DiagnosticHelperBanner.tsx`) flagging abnormal blood pressure, pulse, temperature, and hypoxemia readings in bold red text, triggering stat clinician toast notifications.
- **Side-by-Side Session Baseline Comparison**: Data grid (`VitalsSessionComparison.tsx`) rendering current biometric readings against previous session baselines with calculated deltas and trend badges.
- **Health Trend Insight Card**: Analytical card (`HealthTrendCard.tsx`) calculating longitudinal biometric stability scores and displaying `'Improving'`, `'Stable'`, or `'Concerning'` trend badges.
- **Staff Capacity 7-Day AI Workload Forecast**: Predictive tab inside `StaffCapacityWidget.tsx` identifying future high-load days, risk levels, and Recharts daily load trend lines.
- **Shift Filter Controls**: Toggle buttons (`Morning`, `Afternoon`, `Night`, `All Shifts`) filtering staff capacity and workload metrics.
- **Global Cmd+K Search Overlay**: Header component (`GlobalSearch.tsx`) offering multi-entity fuzzy lookup across patients, appointments, staff, and routes.
- **Notification Badge Engine**: Reactive header notifications (`NotificationContext.tsx`) tracking pending appointment authorizations and stat clinical alerts.
- **User-Facing Dark/Light Theme Switcher**: Persistent theme toggle in `SettingsPage.tsx` and `Header.tsx`.

### Changed
- Refactored authentication pages (`LoginPage.tsx`, `SuperAdminLogin.tsx`, `TwoFactorPage.tsx`) for unified branding and visual consistency.
- Standardized imports and type declarations across `@/types/vitals` and `@/utils/triage`.
- Cleaned up ESLint linter warnings to enforce a 0-error, 0-warning baseline.

---

## [1.1.0] - 2026-09-01

### Added
- Pharmacy & Medication Compliance Tracker module.
- Financials & Insurance Claims Ledger module.
- Super Admin Multi-Tenancy Hospital Onboarding & System License Key Manager.
- Two-Factor Authentication (TOTP) setup modal with backup recovery codes.

---

## [1.0.0] - 2026-08-15

### Added
- Initial Release of Smart Health Manager.
- Core React 19 + Vite + Express Full-Stack architecture.
- Patient Management, Appointment Scheduling, and Basic Vitals Logging.
- Role-Based Access Control (RBAC) authorization layer.
