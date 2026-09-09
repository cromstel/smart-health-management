# System Architecture - Smart Health Manager

## 1. High-Level System Architecture

Smart Health Manager is built using a **Decoupled Full-Stack Architecture** consisting of a React 19 Single Page Application (SPA) frontend served via Vite, backed by a Node.js Express API server running on Cloud Run.

```
+-----------------------------------------------------------------------+
|                            USER BROWSER                               |
|  +-----------------------------------------------------------------+  |
|  |                React 19 SPA (Port 3000 Ingress)                 |  |
|  |  +-------------------+  +-------------------+  +-------------+  |  |
|  |  |  Pages & Layouts  |  | Vitals & Analytics|  | Cmd+K Search|  |  |
|  |  +-------------------+  +-------------------+  +-------------+  |  |
|  |  | Notification Ctx  |  | Recharts Engine   |  | Theme State |  |  |
|  |  +-------------------+  +-------------------+  +-------------+  |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------||----------------------------------+
                                    || REST API Requests (/api/*)
                                    \/
+-----------------------------------------------------------------------+
|                        EXPRESS BACKEND SERVER                         |
|  +-----------------------------------------------------------------+  |
|  | Middleware: CSRF Protection | Rate Limiter | Session Auth (JWT) |  |
|  +-----------------------------------------------------------------+  |
|  | Controllers: Auth | Patients | Vitals | Appointments | Staff     |  |
|  +-----------------------------------------------------------------+  |
|  | Storage / Service Layer: Vitals Ledger | Audit Logs | Triage ESI|  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## 2. Technology Stack & Frameworks

| Layer | Technology / Library | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | ^19.2.8 | UI Component Rendering & State Management |
| **Build Tool & Bundler** | Vite | ^8.2.2 | Fast HMR Dev Server & Production Bundling |
| **Language** | TypeScript | ~6.0.0 | Type Safety & Interface Contracts |
| **Styling** | Tailwind CSS | ^4.3.3 | Utility-First Styling & Responsive Design |
| **Icons** | Lucide React | ^1.41.0 | Accessible Iconography System |
| **Data Visualization** | Recharts | ^2.15.4 | Interactive Biometric & Load Charts |
| **Report Generation** | jsPDF + html2canvas | ^4.2.1 | Client-side Clinical PDF Exports |
| **QR Generation** | qrcode | ^1.5.4 | Scannable Rapid Intake Pass Creation |
| **Backend Framework** | Express | ^4.x / ^5.x | REST API Router & Server Middleware |
| **Server Bundler** | esbuild | Modern | Production Node.js CJS Bundle Compiler |

---

## 3. Modular Layering & Component Architecture

### 3.1 Presentation & UI Layer (`/src/pages/`, `/src/components/`)
- **Layout Shell**: `AppLayout.tsx`, `Header.tsx` (Global Search + Notifications + Theme Toggle), `Sidebar.tsx`.
- **Core Modules**:
  - `components/vitals/`: `PatientVitalsModule.tsx` (Main orchestrator), `DiagnosticHelperBanner.tsx`, `VitalsSessionComparison.tsx`, `HealthTrendCard.tsx`, `VitalsQrCodeModal.tsx`, `LogVitalsDialog.tsx`.
  - `components/dashboard/`: `StaffCapacityWidget.tsx` (7-Day AI forecast + Recharts + PDF export), `UpcomingAppointmentsAlertWidget.tsx`.
  - `components/search/`: `GlobalSearch.tsx` (Cmd+K modal searching across patients, appointments, staff, routes).

### 3.2 State & Service Layer (`/src/services/`, `/src/context/`)
- **`vitalsService.ts`**: Pure functions for biometric status evaluation (`computeVitalStatus`), alert extraction (`extractRecordAlerts`), and summary computation (`computeVitalsSummary`).
- **`triage.ts`**: ESI-based automated triage priority evaluator calculating score (1–10), category, and ward recommendation.
- **`NotificationContext.tsx`**: Centralized reactive state for system-wide appointment alerts and confirmation dispatches.

### 3.3 Backend Server Layer (`/server/src/`)
- **Middleware**: Security headers, HttpOnly session cookie verification, rate limiting, CSRF validation.
- **API Controllers**: Restful route handlers serving `/api/vitals`, `/api/patients`, `/api/appointments`, `/api/staff`, `/api/shared/patient-summary`.

---

## 4. Key Data Flows & Sequence Diagrams

### 4.1 Biometric Vitals Logging & Outlier Alert Flow
```
User (Clinician)          LogVitalsDialog          vitalsService          DiagnosticHelperBanner
     |                          |                        |                          |
     |--- Fill Vitals Form ---->|                        |                          |
     |    (BP, HR, Temp, SpO2)  |                        |                          |
     |                          |--- saveVitalRecord --->|                          |
     |                          |                        |-- Evaluate Outliers ---> |
     |                          |                        |   (BP>=140, HR>=100, etc)|
     |                          |<-- Record Saved -------|                          |
     |<-- Refresh Grid ---------|                        |                          |
     |                                                   |                          |
     |<-- Trigger Red Outlier Banner & Stat Toast Alert -----------------------------|
```

### 4.2 Shared Patient Portal Token Generation & Access
1. Clinician clicks **"Share Progress"** in `PatientVitalsModule.tsx`.
2. Request sent to `/api/shared/patient-summary/generate` with Patient ID and Name.
3. Server generates a cryptographically random 15-minute token.
4. Client receives full URL (`/shared/patient-summary/:token`).
5. Public user accesses link; server validates token expiration and renders confidential summary card.

---

## 5. Deployment Architecture

The application runs in a Cloud Run container environment behind an **Nginx reverse proxy** mapping all external traffic exclusively through **Port 3000**. The backend Node.js process is bundled into a self-contained `dist/server.cjs` file using `esbuild` for fast container cold-starts.
