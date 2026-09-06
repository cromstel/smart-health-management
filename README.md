# Smart Health Management System (SHMS)

**Smart Health Management System (SHMS)** is a comprehensive web-based healthcare management platform for managing patient records, appointments, hospital operations, and financial accounting, developed and maintained by **Cromstel IT Group**.  
This project delivers robust, scalable, and maintainable solutions for enterprise environments. All versions are fully supported with security updates.


## 🪶 Model Guide

- Enterprise-grade reliability
- Clean architecture
- Modular and extensible design
- Comprehensive documentation
- Full security support across all versions

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
- Node.js + Express
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
git clone https://github.com/cromstel/smart-health-manager
cd smart-health-manager
````

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
The backend reads environment variables from the project root `.env` while developing.
Ensure the following keys are set:
```
PORT=5600
VITE_BASE_URL=http://localhost:5174
FRONTEND_URL=http://localhost:5174
VITE_API_URL=http://localhost:5600/api
```

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

* Frontend: `http://localhost:5174`
* Backend API: `http://localhost:5600`

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

**Overall Progress**: 55% Complete

* ✅ Frontend UI: Complete
* ✅ Backend Setup: Complete
* 🟡 API Integration: In Progress
* ⏳ Testing: Pending
* ⏳ Deployment: Pending

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


**Version**: 1.0.0
**Last Updated**: November 2025

```

✅ This updated `README.md`:  
- Links all the docs (`SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `api-reference.md`, `developer-guide.md`, `LICENSE`, `NOTICE`).  
- Maintains your corporate and professional tone.  
- Keeps your tech stack, installation, project structure, and current status sections intact.  
- Makes it easier for developers to navigate and contribute.
