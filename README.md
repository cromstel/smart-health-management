# Smart MediCare

**Smart MediCare** is an enterprise-grade, web-based healthcare management platform for managing patient records, appointments, clinical AI diagnostics with Google Search Grounding, pharmacy inventory, hospital operations, and financial accounting, developed and maintained by **Cromstel IT Group**.

> 📚 **Complete Master Documentation Available**: For detailed onboarding, architecture breakdown, role personas, API guides, and step-by-step instructions for new team members, refer to **[DOCUMENTATION.md](DOCUMENTATION.md)**.

---

## 📖 Master Documentation Guide

If you are new to this project, start with **[DOCUMENTATION.md](DOCUMENTATION.md)** which covers:

- **[System Architecture & Tech Stack](DOCUMENTATION.md#3-system-architecture--technology-stack)**
- **[Key Modules & Features](DOCUMENTATION.md#4-key-modules--operational-features)**
- **[Clinical AI Workspace with Google Search Grounding](DOCUMENTATION.md#43-clinical-ai--grounded-research-workspace)**
- **[Quick-Start Demo Credentials](DOCUMENTATION.md#5-quick-start-demo-credentials)**
- **[Step-by-Step User Workflows](DOCUMENTATION.md#6-user-workflows--operational-how-to)**
- **[Developer Setup & Installation](DOCUMENTATION.md#7-developer-setup--environment-guide)**
- **[Project Directory Map](DOCUMENTATION.md#8-folder--file-directory-structure)**
- **[HIPAA Compliance & Security](DOCUMENTATION.md#9-security-privacy--hipaa-compliance)**

---

## 🪶 Highlights & Features

- Enterprise-grade reliability
- Clean architecture
- Modular and extensible design
- Comprehensive documentation
- Full security support across all versions
- **AI-native development**: canonical operating rules for contributors are maintained in a local-only `AGENTS.md`; agent/skill/workflow definitions (`.opencode/`) and AI memory (`ai/`) are **local-only** and not distributed with this public repository

---

## 🎯 Features

- **Patient Management** – Complete patient records, medical history, and allergies
- **Appointment Scheduling** – Calendar-based appointments with reminders
- **Hospital Management** – Multi-hospital support with department management
- **Staff Management** – Healthcare professional directory and scheduling
- **Document Management** – Secure document storage (local/cloud)
- **Pharmacy & Inventory** – Medicine tracking with low-stock alerts
- **Financial Management** – Chart of Accounts with Balance Sheet and Income Statement
- **RBAC** – Customizable role-based access control
- **Settings** – System configuration for security, storage, and notifications

---

## 🛠️ Technology Stack

### Frontend

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- React Router v7
- Recharts
- Emotion

### Backend

- Node.js + Express 5
- MySQL / PostgreSQL
- JWT Authentication
- bcryptjs for password hashing

---

## 🚀 Getting Started

### Prerequisites

- Node.js 24+ (LTS)
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/cromstel/smart-health-management.git
cd smart-health-management
```

2. **Install frontend dependencies**

```bash
npm install
```

3. **Install backend dependencies**

```bash
cd server
npm install
```

4. **Set up environment variables**

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

Backend:
The backend reads environment variables from the project root `.env` / `.env.local` while developing.
Ensure the following keys are set:

```
PORT=5000
VITE_BASE_URL=http://localhost:5175
FRONTEND_URL=http://localhost:5175
VITE_API_URL=http://localhost:5000/api
```

> Dev note: in development, `/api` requests are served by the mock API middleware (`src/server/mockApi.ts`) on the Vite server itself, so the frontend runs standalone on `:5175` without the backend. Connect to the real API by pointing `VITE_API_URL` at the backend and disabling/changing the mock mount in `vite.config.ts`.

The following environment variables are also required for certain features:

```bash
# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key

# Ghana Health Service Database
GHS_DB_HOST=your_ghs_db_host
GHS_DB_PORT=3306
GHS_DB_NAME=your_ghs_db_name
GHS_DB_USER=your_ghs_db_user
GHS_DB_PASSWORD=your_ghs_db_password
```

If you prefer separate server env files, you can still use `server/.env`.

5. **Set up the database**

```bash
mysql -u root -p < server/src/database/schema.sql
```

6. **Run the application**

**Frontend**

```bash
npm run dev
```

**Backend**

```bash
cd server
npm run dev
```

- Frontend: `http://localhost:5175`
- Backend API: `http://localhost:5000` (unless `PORT` is overridden in `.env`)

API calls to `/api` are proxied to the backend automatically during development.

## 📁 Project Structure

```
smart-health-management/
├── src/                    # Frontend source
│   ├── components/
│   ├── contexts/
│   ├── pages/
│   ├── services/
├── server/                 # Backend source
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── database/
├── public/                 # Static assets
├── docs/                   # (local-only) CHANGELOG and internal notes
├── DOCUMENTATION.md
├── LICENSE
└── NOTICE
```

## 🎨 Design System

- **Primary Color**: Navy Blue (#001F3F)
- **Accent Color**: Sea Blue (#00BFFF)
- **Background**: #0A192F
- **Text**: #EAEAEA
- **Theme**: Dark mode by default

## 📊 Current Status

**Overall Progress**: Production-ready

- ✅ Frontend UI: Complete (React 19 + TypeScript + Vite + Tailwind v4, refactored for best UI/UX)
- ✅ Backend API: Complete (Express 5 + MySQL2, all modules implemented and building with zero TS errors)
- ✅ Testing: Vitest suites green (frontend + backend); Playwright e2e available in `e2e/` (local-only)
- ✅ Dependency Hygiene: All packages on latest stable versions; residual advisories tracked in local `docs/CHANGELOG.md`
- 🟡 Deployment: Configured per environment — see **[DOCUMENTATION.md §7 Developer Setup & Environment Guide](DOCUMENTATION.md#7-developer-setup--environment-guide)** (requires operator-provided credentials/DB)

> **Note:** `docs/`, `ai/`, `.opencode/`, and `scripts/` are local-only (kept out of this public repository). Detailed guides referenced below are available in the full internal checkout.

## 🔐 Default Credentials (Development)

In the default dev setup, the frontend runs against the mock API (`src/server/mockApi.ts`) on the Vite server, so these demo accounts work without the backend:

- Super Admin: `superadmin@smarthealth.com` / `April--2024!!!!` (login at `/super-admin/login`)
- Administrator: `admin@smarthealth.com` / `Pass@135709`
- Doctor: `doctor@smarthealth.com` / `Demo@135790` (TOTP demo user)
- Patient: `patient@smarthealth.com` / `P@ssword135`

Alternatively, create a user via the registration endpoint. Full details: **[DOCUMENTATION.md §5 Quick-Start Demo Credentials](DOCUMENTATION.md#5-quick-start-demo-credentials)**.

## 📝 Documentation Links

- **Master Documentation**: [DOCUMENTATION.md](DOCUMENTATION.md) — onboarding, architecture, roles, API guides, security & HIPAA compliance.
- **License**: [LICENSE](LICENSE)
- **Notice**: [NOTICE](NOTICE)

---

### Dashboard

- `GET /api/dashboard/disease-trends` - Get disease trends data
- `GET /api/dashboard/ghana-health-data` - Get Ghana Health Service data

### Financial

- `POST /api/financial/customers` - Create Stripe customer
- `POST /api/financial/charges` - Create Stripe charge

## 🧪 Testing

```bash
# Run frontend tests
npm test

# Run backend tests
cd server
npm test
```

## 🚢 Deployment

**Frontend**

```bash
npm run build
# Deploy dist/ folder to hosting service
```

**Backend**

```bash
cd server
npm run build
npm start
```

## 🤝 Contributing

Please see the canonical guidelines in **[DOCUMENTATION.md](DOCUMENTATION.md)**; the full contribution playbook (branching, PR workflow, validation gates) lives in the local-only `docs/CHANGELOG.md` and internal checkout.

## 🔐 Security

The security model, HIPAA compliance posture, and vulnerability reporting process are documented in **[DOCUMENTATION.md §9 Security, Privacy & HIPAA Compliance](DOCUMENTATION.md#9-security-privacy--hipaa-compliance)**.

## 👥 Team

Cromstel IT Group - Smart MediCare Team

## 📞 Support

For issues or questions, open a GitHub issue or contact us via [https://cromstelit.com/contact-us/](https://cromstelit.com/contact-us/).

**Version**: 1.4.0
**Last Updated**: September 2026

✅ This updated `README.md`:

- Links the master documentation (`DOCUMENTATION.md`), `LICENSE`, and `NOTICE`.
- Lists working demonstration credentials for the dev-mode mock API.
- Maintains your corporate and professional tone.
- Keeps your tech stack, installation, project structure, and current status sections intact.
- Makes it easier for developers to navigate and contribute.
