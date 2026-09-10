# Project Changelog - Smart Health Manager

All notable changes to the Smart Health Manager application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-09-10 (Production Hardening — Security & Ops Follow-ups)

### Security
- **`xlsx` (SheetJS) removed → `exceljs` 4 adopted** — `server/src/services/reportFormatters/xlsx.ts` rewritten around `ExcelJS.Workbook` (async `writeBuffer`); call sites in `pharmacy.controller.ts` and `financial.controller.ts` now `await buildXlsx`. Clears the high-severity prototype-pollution/ReDoS advisories that had no npm fix.
- **`csurf` removed** — it was unused (the CSRF middleware in `server/src/middleware/csrf.ts` is a self-contained `crypto`-based implementation). Clears the low `csurf→cookie` advisory.
- **`sequelize` + `sequelize-cli` removed** — legacy ORM/migrations (`server/models/`, `server/migrations/`, `server/config/config.json`) deleted; schema remains declarative via `schema.sql` + `seed.sql` (`npm run db:setup` replaces `db:migrate`/`db:seed`, whose `seed.js` target never existed). Clears the uuid advisory and removes ~60 unused deprecated packages.
- **`superAdmin.controller.ts`** — backup/restore no longer read `config.json`; DB coordinates come from env. `mysqldump`/`mysql` now receive the password via `MYSQL_PWD` (never `-p` on the command line), paths are quoted, and `restoreBackup` gained a filename validation guard (plain names only, blocks path traversal).
- **Hardcoded DB password removed** — `server/src/config/database.ts`, `database/create-db.ts`, `database/run-sql.ts` use `DB_PASSWORD` strictly (no fallback); MySQL TLS is opt-in via `DB_SSL=true`.
- **Fail-fast secret policy** — new `server/src/config/env.ts` `getSecret()`: production startups throw when `JWT_SECRET`/`SESSION_SECRET` are missing (`auth.controller.ts`, `middleware/auth.ts`, `index.ts`); `ENCRYPTION_KEY`/`ENCRYPTION_IV` are required in production (`encryption.ts`). Dev-only named fallbacks remain for local runs.
- **Batch recall alerts** — `batch.controller.ts` only sends to `ADMIN_EMAIL`/`ADMIN_PHONE` when configured (phantom `admin@example.com`/`+1234567890` sends removed).
- **`server/backups/backup_2025-11-22T23-00-00-026Z.sql` untracked + gitignored** — a real DB dump with PHI was in the repo; `backups/` is now ignored. History scrub remains an operator decision (AGENTS.md §8).
- **PWA PHI policy set (operator-approved)** — `vite.config.ts` now uses `NetworkOnly` for `/api/patients`; patient data is never cached by the service worker.

### Changed
- **Server is dependency self-contained** — `express-session`, `cookie-parser`, `axios`, `@types/express-session`, `@types/cookie-parser` added to `server/package.json` (previously resolved via root `node_modules` hoisting). `tsconfig.json` dropped `resolveJsonModule` (no JSON imports remain).
- **`docs/DEPLOYMENT.md` rewritten** — was a fictional Cloud Run/esbuild doc; now describes the real Vite SPA + Express/tsc topology with a VPS/Nginx/PM2 reference deployment, fail-fast env contract, TLS, and backup guidance.

---

## [Unreleased] - 2026-09-10 (Production Hardening)

### Added
- **Backend module completion** — implemented all previously missing API surface so `cd server && npm run build` passes with zero TypeScript errors: `middleware/errorHandler.ts`, `middleware/notFoundHandler.ts`, `services/stripe.service.ts` (`createStripeCustomer`, `createStripeCharge`), `services/reportFormatters/xlsx.ts` (`buildXlsx`), `events/permissions.ts` (in-process pub/sub `broadcast`), `controllers/appointment.controller.ts` (CRUD + doctor availability + `.ics` export via ical-generator), `controllers/batch.controller.ts` (batch CRUD + `recallBatch` with audit, email/SMS notifications, inventory adjustment), and routes for `hospitals`, `documents`, `pharmacy` (incl. `GET /reports` CSV/XLSX export), `settings`, `batches`, `prescriptions`, `patient-load-predictions`.
- **financial controller exports** — `exportPdf` (reportFormatters/pdf) and `exportExcel` (buildXlsx) for report export parity with the frontend.
- **AI agent tooling** — `.opencode/agents` (build, frontend, backend, review, docs, dependencies, security), `.opencode/skills` (frontend-refactor, backend-api, security-review, testing, documentation, production-readiness), `.opencode/commands` (`/verify`, `/test`, `/build`, `/docs`, `/deploy`), `opencode.json`, and canonical `AGENTS.md`.

### Changed
- **Dependency upgrade to latest stable (root + server)**: React 19.3.0, Vite 8, Tailwind v4, recharts **3.10.1** (typing fixes in `chart.tsx`, `StaffCapacityWidget.tsx`), zod 4.6.1, Express **5.2.1** (param typing fixes, route reorder in `appointment.routes.ts`), helmet 8, express-rate-limit 8, multer **2.3.0** (clears advisory), bcryptjs 3, stripe 22, twilio 6, nodemailer 10, pdfkit 0.20, TypeScript **7.0.2** server-side (`moduleResolution: bundler`), uuid 14, vitest 5, plus removed unused self-dependency and legacy `@types/stripe` override.
- **Frontend UI/UX refactor**: Super Admin layout rebuilt on shadcn `Sidebar` (collapsible rail + mobile drawer), skeleton loading states across 10 pages, token-based theming (navy/sea-blue) replacing hard-coded slate/zinc/sky classes, XSS-safe HTML entity escaping in Patients QR print preview, `motion` wrapper removed from LoginPage (fixes unhandled animation rejections under happy-dom).

### Security
- **`.env.local` removed from git tracking** — the file previously contained real production secrets (Twilio, SMTP, Gemini, Google Drive OAuth, ENCRYPTION_KEY/IV, SESSION_SECRET, JWT_SECRET, DB password). Policy added to `.gitignore` (`.env*`). **All exposed secrets MUST be rotated** — see `ai/scratchpad.md`.
- Fixed reflected-XSS gap in `PatientsPage` QR print preview (entity escaping).

### Infrastructure
- Resolved `src/docs/` case-collision (`troubleshooting.md` stub removed; canonical `TROUBLESHOOTING.md` kept).
- Untracked generated artifacts (`*.tsbuildinfo`, `lint_output.txt`, `.vitest-full-output.txt`, `playwright-report/`, `test-results/`) and added `.gitignore` rules.

---

## [Unreleased] - 2026-09-10 (Frontend Hardening)

### Fixed
- Repaired 5 files with broken JSX that failed the production build (`tsc -b`): `AuditLogsPage.tsx` (missing `)}` closing the logs ternary + unused `useCallback` import), `PatientsPage.tsx` (unterminated `'''` value in QR escape map → proper HTML entity map `&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`, extra `</div>` closing the root early, missing final function `}`, missing `FileText` lucide import), `PrescriptionFulfillmentPage.tsx`, `StaffPage.tsx`, `RolesPage.tsx` (malformed self-closing/JSX close tags).
- Removed `motion` animation wrapper from `LoginPage.tsx`, eliminating 2 unhandled `AbortError: The animation was canceled` rejections under happy-dom in `src/tests/auth.test.tsx`.
- Removed unused `ErrorBoundary` import in `CompanyStaffDashboardPage.tsx`.

### Changed
- Rebuilt `SuperAdminSidebar.tsx` + `SuperAdminLayout.tsx` on the shadcn `Sidebar` primitive: icon-collapsible rail, automatic mobile Sheet drawer via `SidebarProvider`, sticky `SidebarTrigger` header bar, token-based styling, page-view analytics.
- Replaced plain-text loading placeholders with `Skeleton` loading states (with `sr-only` status text preserved where tests reference it) in `DocumentsPage`, `PharmacyPage`, `PurchaseOrdersPage`, `InventoryReportsPage`, `RolesPage`, `StaffPage`, `HospitalsPage`, `SettingsPage`, `AppointmentsPage`, `PatientsPage`.
- Refactored hard-coded `slate-*`/`zinc-*`/`sky-*` palette classes to design tokens (navy `primary`, sea-blue `accent`, `muted`, `border`, `card`) in `AuditLogsPage`, `PharmacyPage`, `InventoryReportsPage`, `StaffPage`, `PatientsPage`, `AiAssistantPage`, and the `LoginPage` dark showcase panel (now navy).

### Security
- HTML entity escaping in `PatientsPage` QR print preview now maps `'`, `"`, `&`, `<`, `>` to their entities (previously an identity no-op), closing the reflected XSS gap in the `window.open` print document.

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
