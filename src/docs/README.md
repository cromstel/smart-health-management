# Smart Health Manager - Documentation

Welcome to the Smart Health Manager documentation directory.

## 📚 Available Documentation

### [Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md)
Comprehensive checklist tracking the development progress of all system modules and features.

## 📖 Quick Links

- **Project Status**: See [Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md) for current progress
- **Next Steps**: Check the "Next Steps" section in the implementation checklist
- **Known Issues**: Review the "Known Issues" section for current limitations

## 🎯 Project Overview

Smart Health Manager is a comprehensive web-based healthcare management platform designed to streamline:
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
- **CSS-in-JS**: Emotion

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: MySQL
- **Authentication**: JWT
 - **Dev Ports**: Frontend `5174`, Backend `5600`

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
├── contexts/            # React contexts (Auth, etc.)
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
├── docs/                # Documentation
│     ├─ overview.md
│     ├─ architecture.md
│     ├─ api-reference.md
│     ├─ deployment-guide.md
│     ├─ TROUBLESHOOTING.md
│     └─ faq.md
├── App.tsx              # Main app component
├── main.tsx             # Entry point
└── index.css            # Global styles

```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

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
Backend authentication is active. Use valid credentials. Tokens are stored in `localStorage`.
During development, use the `/api` prefix; the dev server proxies requests to the backend.

## 📊 Current Status

**Overall Progress**: 45% Complete

- ✅ Frontend UI: Complete
- 🟡 Backend Integration: Pending
- ⏳ Testing: Pending
- ⏳ Deployment: Pending

See [Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md) for detailed progress.

## 🔐 Security Features

### Implemented (UI Only)
- JWT-based authentication interface
- Role-based access control UI
- Session management UI
- Audit logging UI

### Pending Implementation
- Actual JWT token handling
- Two-factor authentication
- Password encryption
- Data encryption (AES)
- SSL/TLS
- Rate limiting
- Brute-force protection

## 📝 Contributing

Please refer to the implementation checklist for areas that need development.

## 📞 Support

For questions or issues, please contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: January 2024
### API: Pharmacy Reports
- Binary formats supported via Accept headers: 
  - XLSX `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - PDF `application/pdf`
- Query fallback: `?format=xlsx|pdf|csv|json`
- Endpoint: `/api/pharmacy/reports?reportType=stock_levels|expiry_dates|low_stock`
- Responses set appropriate `Content-Type` and `Content-Disposition` for attachments.

### Validation: Drug Interactions
- Server-side contraindications with severity: `high`, `medium`, `low`
- On prescription create/update:
  - `high` → request blocked with error body
  - `medium|low` → request succeeds with `warnings` payload
- Data source: `contraindications` table (category-category rules)
