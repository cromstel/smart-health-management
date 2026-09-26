# Smart MediCare - Documentation

Welcome to the Smart MediCare documentation directory.

## 📚 Available Documentation

The canonical, public-facing documentation lives at the repository root:

- **[DOCUMENTATION.md](../../DOCUMENTATION.md)** — master platform & onboarding documentation (architecture, modules, demo credentials, security & HIPAA).
- **[README.md](../../README.md)** — quick start, technology stack, and installation.
- **[LICENSE](../../LICENSE)** / **[NOTICE](../../NOTICE)** — licensing information.

Local-only developer notes (implementation checklists, completion summaries, and change notes) are intentionally kept out of the public repository per project policy and remain in this directory and the internal `docs/` folder in the full checkout.

## 📖 Quick Links

- **Project Status**: See the [Master Documentation](../../DOCUMENTATION.md) for the current feature set and status
- **Getting Started**: Follow [README.md](../../README.md) installation instructions
- **Known Issues**: Tracked in the local-only implementation checklist and `docs/CHANGELOG.md` in the internal checkout

## 🎯 Project Overview

Smart MediCare is a comprehensive web-based healthcare management platform designed to streamline:
- Patient records management
- Appointment scheduling
- Hospital and staff operations
- Document management
- Pharmacy inventory
- Financial accounting (Chart of Accounts)
- Role-based access control (RBAC)

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Routing**: React Router v7
- **Charts**: Recharts
- **State Management**: React Context API

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: MySQL
- **Authentication**: JWT, WebAuthn passkeys, TOTP 2FA
- **Dev Ports**: Frontend `3000`, Backend `5000`

## 🎨 Design System

### Color Palette
- **Background**: `#0A192F`
- **Primary**: `#001F3F` (Navy Blue)
- **Accent**: `#00BFFF` (Sea Blue)
- **Text**: `#EAEAEA`

### Theme
- Dark mode enabled by default
- Navy blue and sea blue color scheme
- Modern, clean interface

## 📁 Project File Structure

```
src/
├── components/
│   ├── layout/          # Layout components (Sidebar, Header, etc.)
│   └── ui/              # shadcn UI components
├── contexts/            # React contexts (Auth, Theme, Audit, Notification)
├── pages/               # Page components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── PatientsPage.tsx
│   ├── AppointmentsPage.tsx
│   ├── HospitalsPage.tsx
│   ├── StaffPage.tsx
│   ├── DocumentsPage.tsx
│   ├── PharmacyPage.tsx
│   ├── FinancialPage.tsx
│   ├── RolesPage.tsx
│   └── SettingsPage.tsx
├── App.tsx              # Main app component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## 🚀 Getting Started

### Prerequisites
- Node.js 24+ (LTS)
- MySQL 8.0+

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Authentication
Backend authentication is active (JWT, WebAuthn passkeys, TOTP 2FA). Demo credentials are listed in [DOCUMENTATION.md §5](../../DOCUMENTATION.md#5-quick-start-demo-credentials). During development, the Vite dev server serves the mock API for `/api` requests on `:3000` when running standalone.

## 📊 Current Status

**Overall Progress**: Production-ready

- ✅ Frontend UI: Complete
- ✅ Backend API: Complete
- ✅ Testing: Vitest suites green (frontend + backend); Playwright e2e available
- ✅ Security: JWT + WebAuthn + TOTP 2FA, audit logging, RBAC, rate limiting, encryption

## 🔐 Security Features

### Implemented
- JWT-based authentication with session management
- WebAuthn passkeys and TOTP two-factor authentication
- Password encryption (bcrypt) with complexity policy
- Data encryption (AES) for sensitive records
- SSL/TLS support (HTTPS server in production)
- Rate limiting on auth routes
- Brute-force protection
- Immutable HIPAA audit logging

## 📝 Contributing

Please refer to the [Master Documentation](../../DOCUMENTATION.md) and the local-only contribution notes in the internal checkout.

## 📞 Support

For questions or issues, please contact the development team via https://cromstelit.com/contact-us/.

---

**Version**: 1.4.0  
**Last Updated**: September 2026