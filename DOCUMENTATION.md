# 🏥 Smart Health Management System (SHMS)
## Master Platform & Onboarding Documentation

> **Welcome to Smart Health Management System (SHMS)!**  
> This comprehensive guide provides everything a new developer, clinician, or administrator needs to understand, operate, and maintain the SHMS platform efficiently.

---

## 📋 Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Target Audience & Role Personas](#2-target-audience--role-personas)
3. [System Architecture & Technology Stack](#3-system-architecture--technology-stack)
4. [Key Modules & Operational Features](#4-key-modules--operational-features)
   - [Authentication & Access Control](#41-authentication--access-control)
   - [Clinical Dashboard & Analytics](#42-clinical-dashboard--analytics)
   - [Clinical AI & Grounded Research Workspace](#43-clinical-ai--grounded-research-workspace)
   - [Patient Management & Shared Summaries](#44-patient-management--shared-summaries)
   - [Appointments & Calendar Scheduling](#45-appointments--calendar-scheduling)
   - [Hospital & Department Operations](#46-hospital--department-operations)
   - [Staff & HR Roster](#47-staff--hr-roster)
   - [Pharmacy & Inventory Management](#48-pharmacy--inventory-management)
   - [Financial Management & Chart of Accounts](#49-financial-management--chart-of-accounts)
   - [Super Admin Governance Portal](#410-super-admin-governance-portal)
   - [HIPAA Audit Logging & Compliance](#411-hipaa-audit-logging--compliance)
   - [Settings & Preferences](#412-settings--preferences)
5. [Quick-Start Demo Credentials](#5-quick-start-demo-credentials)
6. [User Workflows & Operational How-To](#6-user-workflows--operational-how-to)
7. [Developer Setup & Environment Guide](#7-developer-setup--environment-guide)
8. [Folder & File Directory Structure](#8-folder--file-directory-structure)
9. [Security, Privacy & HIPAA Compliance](#9-security-privacy--hipaa-compliance)
10. [Troubleshooting & Frequently Asked Questions](#10-troubleshooting--frequently-asked-questions)

---

## 1. Executive Overview

**Smart Health Management System (SHMS)** is an enterprise-grade, multi-hospital digital healthcare ecosystem built for modern hospitals, medical centers, and clinical research environments. It seamlessly bridges clinical workflows, patient record management, AI-driven diagnostics, pharmacy logistics, financial accounting, and institutional governance into a unified, secure web interface.

### Core Value Proposition
- **Unified Clinical Workflows**: Consolidates EHR, appointment scheduling, pharmacy prescription fulfillment, and billing.
- **AI-Powered Decision Support**: Server-proxied Gemini AI with **Google Search Grounding** for real-time access to current PubMed medical literature, WHO/CDC guidelines, and 2025/2026 clinical consensus statements.
- **HIPAA Compliance & Governance**: Immutable audit trails, biometric WebAuthn authentication, 2FA, session timeout protection, and granular Role-Based Access Control (RBAC).
- **Multi-Tenant / Multi-Facility Support**: Scalable across regional networks with dedicated Super Admin controls.

---

## 2. Target Audience & Role Personas

The platform adapts dynamically based on the signed-in user's role:

| Role | Primary Responsibilities & Features |
| :--- | :--- |
| **Doctor / Physician** | Patient EHR access, clinical notes, prescribing medication, appointment scheduling, AI research workspace. |
| **Nurse / Clinical Staff** | Patient triage, vitals recording, appointment queue management, bed allocation monitoring. |
| **Pharmacist** | Prescription fulfillment, drug inventory control, purchase order tracking, low-stock alerts. |
| **Hospital Administrator**| Hospital department management, staff scheduling, financial reporting, system settings. |
| **Financial Officer** | Chart of Accounts, General Ledger, invoicing, Stripe payment processing, revenue analytics. |
| **Patient** | Personal health record view, appointment requests, shared summary links, medical history. |
| **Super Admin** | Platform-wide oversight, multi-tenant facility provisioning, global user management, system audit logs. |

---

## 3. System Architecture & Technology Stack

SHMS follows a modern full-stack architecture prioritizing type safety, responsive performance, dark/light accessibility, and server-side secret isolation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER CLIENT (SPA)                             │
│  React 19 • TypeScript • React Router v7 • Tailwind CSS v4 • Lucide Icons   │
│  Context APIs (Auth, Theme, Notification, Audit) • React Hook Form + Zod    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API / JSON Proxies
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        NODE.JS + EXPRESS BACKEND                             │
│  Express Routing • JWT Auth • WebAuthn Passkeys • Stripe Proxy • CORS       │
│  Server-Side Gemini API Proxy with Google Search Grounding Tool Integration   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ SQL / Data Engine
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           DATABASE & STORAGE LAYER                          │
│  MySQL / PostgreSQL Schema • Encrypted Credentials • Local / Cloud Assets    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stack Breakdown
- **Frontend Framework**: React 19 + TypeScript + Vite
- **Styling & Design System**: Tailwind CSS v4 + Lucide React Icons + Custom CSS Themes (`dark` / `light` with CSS variables)
- **State & Validation**: React Context API (`AuthContext`, `ThemeContext`, `AuditContext`, `NotificationContext`) + React Hook Form + Zod Schemas
- **Visualizers & Charts**: Recharts (Disease trends, occupancy visualizers, financial graphs)
- **Backend Runtime**: Node.js + Express
- **AI Engine**: Server-side `@google/genai` SDK using `gemini-2.5-flash` / `gemini-2.5-pro` with `googleSearch` Grounding Tool enabled
- **Authentication**: JWT Tokens, bcryptjs hashing, WebAuthn Passkey (Biometrics) API, 2FA OTP verification

---

## 4. Key Modules & Operational Features

### 4.1 Authentication & Access Control
- **Form Validation**: Strict email format and password strength complexity enforcement (minimum 8 characters, uppercase, lowercase, numbers, special characters).
- **WebAuthn Biometric/Passkey Login**: Fingerprint / Face ID authentication integration.
- **Two-Factor Authentication (2FA)**: Time-based OTP challenge screen for high-security roles.
- **HIPAA Agreement Enforcement**: Mandatory policy acknowledgment checkbox during registration.
- **Session Auto-Timeout**: Inactivity detection automatically logs out users to protect patient data on shared hospital terminals.

### 4.2 Clinical Dashboard & Analytics
- **Live Hospital Vitals**: Real-time stats on active patients, available beds, pending appointments, and daily revenue.
- **Triage Queue**: Color-coded queue management (Emergency, Urgent, Routine).
- **Disease Trends & Analytics**: Recharts visualizer tracking seasonal disease outbreaks (e.g., Malaria, Hypertension, Upper Respiratory Infections).
- **Upcoming Appointments Alert Widget**: Live alert feed highlighting appointments starting within the next hour.
- **Quick Actions Launcher**: Direct shortcuts to register patients, create appointments, dispense drugs, or launch the AI assistant.

### 4.3 Clinical AI & Grounded Research Workspace
- **Server-Side API Proxy**: Routes AI queries through backend `/api/gemini/chat` to protect secret API keys from client exposure.
- **Google Search Grounding**: Automatically searches and grounds medical answers in peer-reviewed journals (PubMed, NEJM, The Lancet), WHO, CDC, and 2025/2026 clinical guidelines.
- **Grounding Metadata Display**: Shows executed web search queries and clickable external citation links for verification.
- **Specialized Personas**:
  1. *Medical Research & Guidelines Grounding*: Focuses on clinical trial consensus and up-to-date treatment guidelines.
  2. *Clinical Diagnostic Assistant*: Differential diagnosis support with ICD-10 suggestions.
  3. *Clinical Scribe & EHR Synthesizer*: Transforms unstructured clinician notes into standardized SOAP notes.
  4. *Medical Code Lookup*: Converts descriptions into ICD-10 / CPT billing codes.
- **Simulated Preview Mode**: If no `GEMINI_API_KEY` is provided, automatically provides realistic simulated grounded medical research responses without crashing.

### 4.4 Patient Management & Shared Summaries
- **Comprehensive Patient Records**: Full demographics, vitals history, blood group, chronic conditions, and allergies.
- **Timeline View**: Historical log of patient visits, prescriptions, and diagnostic lab test results.
- **Shared Patient Summary Link**: Generates tokenized public URLs (`/shared/patient-summary/:token`) for safe multi-facility referral sharing.

### 4.5 Appointments & Calendar Scheduling
- **Flexible Views**: Calendar and list layouts for managing daily clinical schedules.
- **Doctor Assignment**: Maps appointments directly to available healthcare professionals.
- **Status Workflow**: Tracks appointments from `Scheduled` ➔ `In-Progress` ➔ `Completed` or `Cancelled`.

### 4.6 Hospital & Department Operations
- **Multi-Facility Support**: Switch between facility locations (e.g., General Hospital, St. Jude Medical Center).
- **Department Oversight**: Capacity, bed allocation, and specialized unit management (Cardiology, Pediatrics, Emergency, ICU).

### 4.7 Staff & HR Roster
- **Staff Directory**: Professional roster including specialization, license numbers, department assignments, and contact details.
- **Shift Scheduling**: Manage duty rosters and clinician availability.

### 4.8 Pharmacy & Inventory Management
- **Drug Inventory**: Stock levels, unit pricing, dosage forms, batch numbers, and expiration dates.
- **Low-Stock Alerts**: Instant visual notifications when drug inventory drops below reorder thresholds.
- **Purchase Orders**: Workflow to generate, approve, and receive supplier shipments.
- **Prescription Fulfillment**: Real-time pharmacist queue to verify and dispense prescribed medications directly to patients.

### 4.9 Financial Management & Chart of Accounts
- **Chart of Accounts**: General Ledger tracking Assets, Liabilities, Equity, Revenue, and Expenses.
- **Financial Statements**: Automated Balance Sheet, Income Statement (P&L), and Cash Flow views.
- **Stripe Invoicing & Billing**: Create customer records and process live credit card charges for hospital services.

### 4.10 Super Admin Governance Portal
- **Protected Endpoint (`/super-admin/login`)**: Isolated administrative portal.
- **Multi-Tenant Operations**: Monitor system metrics, manage cross-hospital accounts, provision new facilities, and inspect platform health.

### 4.11 HIPAA Audit Logging & Compliance
- **Immutable Log Engine**: Captures every critical system mutation (Logins, Record updates, Prescription fulfillments, AI queries).
- **Audit Metadata**: Tracks User ID, User Name, Action Type, Module, IP Address, Timestamp, and Details.

### 4.12 Settings & Preferences
- **Theme Selector**: Instant toggle between Dark and Light mode across all components.
- **Security & Passkey Registration**: Manage WebAuthn credentials, password updates, and session preferences.

---

## 5. Quick-Start Demo Credentials

For instant testing and evaluation without manual registration, use the pre-configured credentials below:

| Role / Persona | Email Address | Password | Quick Fill Access |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor@smarthealth.com` | `doctor123` | Click "Doctor" button on Login page |
| **Nurse** | `nurse@smarthealth.com` | `nurse123` | Click "Nurse" button on Login page |
| **Administrator** | `admin@smarthealth.com` | `admin123` | Click "Administrator" button on Login page |
| **Pharmacist** | `pharmacy@smarthealth.com` | `pharmacy123` | Type directly into Login form |
| **Super Admin** | `superadmin@smarthealth.com` | `super123` | Accessible at `/super-admin/login` |

---

## 6. User Workflows & Operational How-To

### How to Sign In using Biometrics / Passkeys
1. Go to the Login page (`/login`).
2. Type your work email (or click a quick-fill demo account).
3. Click **"Sign in with Biometrics / Touch ID"**.
4. Confirm your device's biometric prompt.

### How to Query the Grounded Clinical AI Assistant
1. Navigate to **Clinical AI** from the left navigation sidebar.
2. Ensure **Google Search Grounding** is toggled ON (enabled by default).
3. Select a **Persona** (e.g., *Medical Research & Guidelines Grounding*).
4. Type your clinical question (e.g., *"What are the 2025 ADA guidelines for GLP-1 in diabetic kidney disease?"*).
5. Review the AI's response along with the **Google Search Grounding & Medical Literature Sources** box showing executed search queries and PubMed/WHO links.

### How to Dispense a Prescription in Pharmacy
1. Navigate to **Prescriptions** or **Pharmacy** from the sidebar.
2. Locate the pending prescription in the queue.
3. Verify patient details, allergy warnings, and prescribed dosages.
4. Click **"Fulfill Prescription"** to automatically deduct inventory stock and log the audit record.

### How to Toggle Dark / Light Theme
1. Look at the top navigation header bar.
2. Click the Sun/Moon icon toggle button next to your user avatar.

---

## 7. Developer Setup & Environment Guide

### Prerequisites
- **Node.js**: v20.19.0 or higher (v22 LTS recommended — required by Vite 8)
- **npm**: v10.0.0 or higher
- **Git**
- **MySQL**: 8.0+ (backend data store; see `server/src/database/schema.sql`)

### Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/cromstel/smart-health-management.git
   cd smart-health-management
   ```

2. **Install Frontend & Root Dependencies**:
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**:
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Environment Configuration**:
   ```bash
   cp .env.example .env.local   # local-only; NEVER commit (policy in AGENTS.md §2.4)
   ```
   Key variables (see `.env.example` for the full list):
   ```env
   # Server Port
   PORT=5000

   # Frontend
   VITE_BASE_URL=http://localhost:3000
   FRONTEND_URL=http://localhost:3000
   VITE_API_URL=http://localhost:5000/api

   # Database
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=smart_health_manager
   DB_USER=root
   DB_PASSWORD=your_db_password

   # Gemini API Key (Required for live Gemini AI calls)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Stripe Keys (Optional for payments)
   STRIPE_SECRET_KEY=your_stripe_secret_key_here
   ```
   ⚠️ `.env.local` (and any `.env*`) is in `.gitignore`. Real secrets must never be committed — the repo history previously exposed a committed `.env.local`; all of those secrets must be rotated.

5. **Initialize the Database**:
   ```bash
   mysql -u root -p < server/src/database/schema.sql
   mysql -u root -p < server/src/database/seed.sql
   ```

6. **Start the Development Server**:
   ```bash
   npm run dev        # Frontend (Vite + mock API) at http://localhost:3000
   cd server
   npm run dev        # Backend API (tsx watch) at http://localhost:5000
   ```
   Or from the root: `npm run dev:all` (requires `concurrently`).

7. **Verify Code Quality & Build**:
   ```bash
   # Run Linter
   npm run lint

   # Run Type-check & Production Build
   npm run build
   ```

---

## 8. Folder & File Directory Structure

```
smart-health-management/
├── AGENTS.md                   # Canonical operating rules for AI agents (read first)
├── opencode.json                # opencode config: agents, skills paths, permissions
├── .opencode/                   # AI agent definitions, skills, and command workflows
│   ├── agent/                   # build, frontend, backend, review, docs, dependencies, security
│   ├── skills/                  # frontend-refactor, backend-api, security-review, testing, documentation, production-readiness
│   └── command/                 # /verify, /test, /build, /docs, /deploy workflows
├── ai/                          # AI memory: context, agents, skills, memory, scratchpad
├── public/                      # Static assets & public images
├── src/                         # Frontend Application Source
│   ├── components/              # UI Components
│   │   ├── common/              # ErrorBoundary, SearchInput, Pagination
│   │   ├── dashboard/           # TriageQueue, DiseaseTrends, AppointmentsAlert
│   │   ├── layout/              # Header, Sidebar, AppLayout
│   │   ├── ui/                  # shadcn/ui components (Button, Card, Input, Label, Select, Switch...)
│   │   └── ShortcutManager.tsx  # Global keyboard shortcuts
│   ├── contexts/                # React Context Providers
│   │   ├── AuthContext.tsx      # User session, login, logout, WebAuthn
│   │   ├── ThemeContext.tsx     # Dark / Light theme toggle & state
│   │   ├── AuditContext.tsx     # HIPAA audit log tracking
│   │   └── NotificationContext.tsx # Toast & alert notifications
│   ├── layouts/                 # SuperAdminLayout
│   ├── pages/                   # Application Screen Views
│   │   ├── LoginPage.tsx        # Sign-in page with Zod validation & WebAuthn
│   │   ├── RegisterPage.tsx     # Sign-up page with HIPAA agreement
│   │   ├── DashboardPage.tsx    # Primary clinical metrics & queues
│   │   ├── AiAssistantPage.tsx  # Gemini Clinical AI workspace with Search Grounding
│   │   ├── PatientsPage.tsx     # EHR patient management
│   │   ├── AppointmentsPage.tsx # Clinical scheduling
│   │   ├── PharmacyPage.tsx     # Drug inventory & stock alerts
│   │   ├── PrescriptionFulfillmentPage.tsx # Pharmacist queue
│   │   ├── FinancialPage.tsx    # Chart of Accounts & Stripe billing
│   │   ├── SuperAdminDashboard.tsx # Governance portal
│   │   └── ...                  # Other module screens
│   ├── services/                # API service connectors & mock data generators
│   ├── server/                  # Backend Express Server & Gemini API Handler
│   │   ├── mockApi.ts           # Express endpoints & Gemini chat proxy with search grounding
│   │   └── server.ts            # Entry point for production Express server
│   ├── types.ts                 # Global TypeScript interfaces & type definitions
│   ├── App.tsx                  # Main Router setup
│   ├── index.css                # Global Tailwind CSS styles & CSS variables
│   └── main.tsx                 # DOM Entry point
├── DOCUMENTATION.md             # Master Documentation (This File)
├── README.md                    # Root Readme file
├── package.json                 # Dependencies & NPM scripts
├── tsconfig.json                # TypeScript configuration
└── vite.config.ts               # Vite build configuration
```

---

## 9. Security, Privacy & HIPAA Compliance

SHMS is architected to conform with healthcare security standards:

1. **Client Confidentiality**: No secret API keys (`GEMINI_API_KEY`, `STRIPE_SECRET_KEY`) are exposed in frontend bundles. All external requests proxy through server endpoints.
2. **Data Minimization & Encryption**: Passwords are hashed using `bcryptjs`. Session tokens are managed securely.
3. **Auditability**: All sensitive read/write operations log immutable entries to the `AuditContext` containing timestamps and user identification.
4. **Access Governance**: Pages and API routes strictly validate role permissions (e.g., non-pharmacists cannot approve drug fulfillment).

---

## 10. Troubleshooting & Frequently Asked Questions

### Q1: The AI Assistant says "[Simulation Mode - GEMINI_API_KEY is not set]". How do I activate real Gemini responses?
**Answer**: Provide your Gemini API key in the `.env` file as `GEMINI_API_KEY=your_key` or in the platform environment settings. Once set, the AI will execute real-time reasoning and live Google Search grounding.

### Q2: How do I test dark mode vs light mode?
**Answer**: Click the Sun/Moon icon in the top header bar next to your profile avatar. The layout will instantly update CSS theme variables and `color-scheme`.

### Q3: How do I test the Super Admin panel?
**Answer**: Navigate directly to `/super-admin/login` and log in with `superadmin@smarthealth.com` / `super123`.

### Q4: Build fails with "Vite or Typescript error". How do I resolve it?
**Answer**: Ensure all node modules are installed by running `npm install`, then run `npm run lint` followed by `npm run build`.

---

*Documentation Version: 2.0.0*  
*Maintained by: Cromstel IT Group - Smart Health Management Team*  
*Last Updated: September 2026*
