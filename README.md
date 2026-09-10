# Smart Health Management System (SHMS)

**Smart Health Management System (SHMS)** is an enterprise-grade, web-based healthcare management platform for managing patient records, appointments, clinical AI diagnostics with Google Search Grounding, pharmacy inventory, hospital operations, and financial accounting, developed and maintained by **Cromstel IT Group**.

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
- **AI-native development**: canonical rules in [AGENTS.md](AGENTS.md), agent/skill/workflow definitions in [`.opencode/`](.opencode/), and AI memory in [`ai/`](ai/) keep every coding agent aligned with the project's constraints

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
- Node.js 18+
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
cp .env.example .env
# Edit .env with your configuration
```

Backend:
The backend reads environment variables from the project root `.env` / `.env.local` while developing.
Ensure the following keys are set:
```
PORT=5000
VITE_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:5000/api
```
> Dev note: in development, `/api` requests are served by the mock API middleware (`src/server/mockApi.ts`) on the Vite server itself, so the frontend runs standalone on `:3000` without the backend. Connect to the real API by pointing `VITE_API_URL` at the backend and disabling/changing the mock mount in `vite.config.ts`.

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

* Frontend: `http://localhost:3000`
* Backend API: `http://localhost:5000` (unless `PORT` is overridden in `.env`)

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
├── docs/
│   ├── developer-guide.md
│   ├── api-reference.md
│   ├── CHANGELOG.md
│   ├── CONTRIBUTING.md
│   └── SECURITY.md
├── LICENSE
└── NOTICE
```

## 🎨 Design System

* **Primary Color**: Navy Blue (#001F3F)
* **Accent Color**: Sea Blue (#00BFFF)
* **Background**: #0A192F
* **Text**: #EAEAEA
* **Theme**: Dark mode by default

## 📊 Current Status

**Overall Progress**: Production-ready

* ✅ Frontend UI: Complete (React 19 + TypeScript + Vite + Tailwind v4, refactored for best UI/UX)
* ✅ Backend API: Complete (Express 5 + MySQL2, all modules implemented and building with zero TS errors)
* ✅ Testing: Vitest suites green (frontend + backend); Playwright e2e available in `e2e/`
* ✅ Dependency Hygiene: All packages on latest stable versions; residual advisories tracked (see `docs/CHANGELOG.md`)
* 🟡 Deployment: Configured per environment — see `docs/DEPLOYMENT.md` (requires operator-provided credentials/DB)

See [docs/developer-guide.md](docs/developer-guide.md) for detailed implementation guidance.

## 🔐 Default Credentials (Development)

* Email: `admin@hospital.com`
* Password: `admin123`

Alternatively, create a user via the registration endpoint.

## 📝 Documentation Links

* **Developer Guide**: [docs/developer-guide.md](docs/developer-guide.md)
* **API Reference**: [docs/api-reference.md](docs/api-reference.md)
* **Security Policy**: [docs/SECURITY.md](docs/SECURITY.md)
* **Contribution Guidelines**: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
* **Changelog**: [docs/CHANGELOG.md](docs/CHANGELOG.md)
* **License**: [LICENSE](LICENSE)
* **Notice**: [NOTICE](NOTICE)

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

Please see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for full contribution guidelines.

## 🔐 Security

Refer to [docs/SECURITY.md](docs/SECURITY.md) for reporting vulnerabilities and supported version details.

## 👥 Team

Cromstel IT Group - Smart Health Management Team

## 📞 Support

For issues or questions, open a GitHub issue or contact us via [https://cromstelit.com/contact-us/](https://cromstelit.com/contact-us/).


**Version**: 1.4.0
**Last Updated**: September 2026

✅ This updated `README.md`:  
- Links all the docs (`SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `api-reference.md`, `developer-guide.md`, `LICENSE`, `NOTICE`).  
- Maintains your corporate and professional tone.  
- Keeps your tech stack, installation, project structure, and current status sections intact.  
- Makes it easier for developers to navigate and contribute.
