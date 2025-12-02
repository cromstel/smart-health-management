# Smart Health Management System - Architecture Documentation

## Overview

The Smart Health Management System (SHMS) is a comprehensive healthcare management platform built with modern web technologies. This document provides an overview of the system architecture, components, and design decisions.

## System Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Reverse Proxy  │
│  (Nginx/Apache) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Frontend│ │ Backend  │
│  React │ │ Express  │
└────┬───┘ └────┬─────┘
     │          │
     │          ▼
     │    ┌──────────┐
     │    │  MySQL   │
     │    │ Database │
     │    └──────────┘
     │
     ▼
┌──────────┐
│  Static  │
│  Assets  │
└──────────┘
```

### Technology Stack

#### Frontend
- **Framework:** React 19.0.0 with TypeScript
- **Build Tool:** Vite 6.0.5
- **Styling:** Tailwind CSS v4.1.17
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Routing:** React Router v7.1.1
- **State Management:** React Context API
- **Charts:** Recharts 2.15.4
- **Forms:** React Hook Form 7.66.0 with Zod validation
- **HTTP Client:** Native Fetch API

#### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18.2
- **Language:** TypeScript 5.3.3
- **Database:** MySQL 8.0+ (mysql2 3.6.5)
- **Authentication:** JWT (jsonwebtoken 9.0.2, jose 5.2.0)
- **Security:** Helmet 7.1.0, express-rate-limit 7.1.5, CSRF protection
- **File Upload:** Multer 2.0.2
- **Email:** Nodemailer 7.0.10
- **SMS/WhatsApp:** Twilio 5.10.5
- **Payments:** Stripe 14.25.0
- **Scheduling:** node-cron 4.2.1

## Component Architecture

### Frontend Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Layout components (Sidebar, Header)
│   ├── ui/             # shadcn/ui components
│   └── security/       # Security-related components
├── contexts/           # React Context providers
│   ├── AuthContext.tsx # Authentication state
│   └── AuditContext.tsx # Audit logging context
├── pages/              # Page components (route handlers)
│   ├── DashboardPage.tsx
│   ├── PatientsPage.tsx
│   ├── AppointmentsPage.tsx
│   └── ... (28 page components)
├── services/           # API service layer
│   └── api.ts          # Centralized API client
├── hooks/              # Custom React hooks
│   ├── useSessionTimeout.ts
│   └── useAudit.ts
├── utils/              # Utility functions
└── lib/                # Library configurations
    └── utils.ts        # Shared utilities
```

### Backend Structure

```
server/src/
├── config/             # Configuration files
│   ├── database.ts     # MySQL connection pool
│   └── jwt.ts          # JWT manager with key rotation
├── controllers/        # Request handlers (18 controllers)
│   ├── auth.controller.ts
│   ├── patient.controller.ts
│   ├── appointment.controller.ts
│   └── ... (15 more controllers)
├── services/           # Business logic layer
│   ├── reminderScheduler.service.ts
│   ├── drugInteractions.service.ts
│   ├── storage.service.ts
│   └── ... (11 more services)
├── middleware/         # Express middleware
│   ├── auth.ts         # Authentication & authorization
│   ├── csrf.ts         # CSRF protection
│   ├── errorHandler.ts # Error handling
│   └── validator.ts    # Input validation
├── routes/             # Route definitions (17 route files)
│   ├── auth.routes.ts
│   ├── patient.routes.ts
│   └── ... (15 more route files)
├── database/           # Database scripts
│   ├── schema.sql      # Database schema
│   └── seed.sql        # Seed data
├── jobs/               # Scheduled jobs
│   ├── backup.job.ts   # Automated backups
│   └── inventory.job.ts # Inventory management
├── utils/              # Utility functions
│   ├── jwt/            # JWT utilities
│   ├── mail.ts         # Email service
│   └── sms.ts          # SMS service
└── tests/              # Test files
    └── ... (14 test files)
```

## Data Flow

### Authentication Flow

1. User submits credentials via login form
2. Frontend sends POST request to `/api/auth/login`
3. Backend validates credentials against database
4. Backend checks account lockout status
5. JWT token generated with user info and permissions
6. Token stored in localStorage (frontend)
7. Token sent in `Authorization: Bearer <token>` header for subsequent requests
8. `authenticate` middleware validates token on protected routes

### Authorization Flow

1. Request arrives with JWT token in Authorization header
2. `authenticate` middleware validates token and extracts user info
3. `requirePermission` middleware checks role-based permissions
4. Permission check queries database for role permissions
5. Supports hierarchical roles (parent roles)
6. Hospital-scoped modules verify user's hospital context
7. Request proceeds if authorized, otherwise returns 403

### Data Request Flow

1. Frontend component calls API service method
2. API service checks in-memory cache and localStorage
3. If not cached, sends HTTP request to backend
4. Backend controller validates request and checks permissions
5. Service layer executes business logic and database queries
6. Response returned to frontend
7. Response cached if applicable (GET requests)

## Database Schema

### Core Entities

- **Users & Authentication:**
  - `users` - User accounts with authentication info
  - `roles` - Role definitions
  - `permissions` - Role-module-action permissions matrix

- **Healthcare Entities:**
  - `hospitals` - Hospital entities
  - `departments` - Hospital departments
  - `staff` - Staff members
  - `patients` - Patient records
  - `appointments` - Appointment scheduling
  - `medical_history` - Patient medical history
  - `allergies` - Patient allergies

- **Documents:**
  - `documents` - Document metadata
  - `tags` - Document tags
  - `document_tags` - Document-tag relationships

- **Pharmacy:**
  - `medicines_inventory` - Medicine inventory
  - `medicine_batches` - Batch tracking
  - `prescriptions` - Prescription records
  - `suppliers` - Supplier information
  - `purchase_orders` - Purchase orders

- **Financial:**
  - `accounts` - Chart of accounts
  - `transactions` - Financial transactions
  - `invoices` - Invoices
  - `payments` - Payment records
  - `expenses` - Expense records

- **System:**
  - `audit_logs` - System audit trail
  - `settings` - System settings
  - `super_admin_settings` - Super admin settings
  - `forecasts` - Predictive analytics data

### Key Relationships

- Users → Roles (many-to-one)
- Roles → Permissions (one-to-many, supports hierarchical roles)
- Patients → Hospitals (many-to-one)
- Staff → Departments → Hospitals (hierarchical)
- Appointments → Patients, Staff, Hospitals
- Documents → Patients (many-to-one, optional)
- Prescriptions → Patients, Staff
- Transactions → Accounts

## Security Architecture

### Authentication

- **JWT-based authentication** with token expiration
- **Account lockout** after 5 failed login attempts (15-minute lockout)
- **Password hashing** using bcryptjs
- **Password change enforcement** with postponement limits
- **Two-factor authentication** support

### Authorization

- **Role-Based Access Control (RBAC)** with granular permissions
- **Module-level permissions** (view, add, edit, delete)
- **Hierarchical roles** (parent-child relationships)
- **Hospital-scoped access** for certain modules
- **Permission caching** (planned for optimization)

### Security Measures

- **Helmet.js** for security headers
- **CSRF protection** with token validation
- **Rate limiting** (100 requests per 15 minutes per IP)
- **Input validation** using express-validator
- **SQL injection prevention** via parameterized queries
- **XSS prevention** through proper data encoding
- **HTTPS enforcement** in production
- **Audit logging** for critical operations

## API Architecture

### RESTful API Design

- **Base URL:** `/api`
- **Authentication:** Bearer token in Authorization header
- **Response Format:** JSON
- **Error Handling:** Standardized error responses

### API Endpoints

- `/api/auth/*` - Authentication endpoints
- `/api/dashboard/*` - Dashboard data
- `/api/patients/*` - Patient management
- `/api/appointments/*` - Appointment management
- `/api/hospitals/*` - Hospital management
- `/api/staff/*` - Staff management
- `/api/documents/*` - Document management
- `/api/pharmacy/*` - Pharmacy operations
- `/api/financial/*` - Financial operations
- `/api/roles/*` - Role and permission management
- `/api/settings/*` - System settings
- `/api/super-admin/*` - Super admin operations

## Deployment Architecture

### Development Environment

- **Frontend:** Vite dev server on `localhost:5174`
- **Backend:** Express server on `localhost:5600`
- **Database:** MySQL on `localhost:3306`
- **Proxy:** Vite proxy forwards `/api` to backend

### Production Environment

- **Frontend:** Static files served via Nginx/Apache
- **Backend:** Node.js process (PM2 recommended)
- **Database:** MySQL (same server or separate instance)
- **Reverse Proxy:** Nginx/Apache serves frontend and proxies API
- **SSL/TLS:** HTTPS with SSL certificates (Let's Encrypt)
- **File Storage:** Local filesystem with optional cloud storage (OneDrive/Google Drive)

### Deployment Options

1. **Local Deployment:** Apache/Nginx reverse proxy
2. **Cloud Deployment:** AWS, Azure, GCP, DigitalOcean
3. **Containerization:** Docker (optional)

## Design Patterns

### Backend Patterns

- **MVC Architecture:** Controllers, Services, Models separation
- **Middleware Pattern:** Request processing pipeline
- **Repository Pattern:** Database abstraction (can be enhanced with ORM)
- **Service Layer:** Business logic separation

### Frontend Patterns

- **Component-Based Architecture:** Reusable React components
- **Context API:** Global state management
- **Custom Hooks:** Reusable logic extraction
- **Service Layer:** API abstraction

## Performance Considerations

### Current Optimizations

- **Database Connection Pooling:** 10 connections (configurable)
- **Frontend Caching:** In-memory cache and localStorage
- **Code Splitting:** Vite automatic code splitting
- **Asset Optimization:** Vite build optimization

### Planned Optimizations

- **Redis Caching:** For frequently accessed data
- **Database Indexing:** Optimize query performance
- **API Response Caching:** Reduce database load
- **CDN Integration:** For static assets
- **Database Read Replicas:** For read-heavy operations

## Monitoring and Logging

### Current Implementation

- **Morgan:** HTTP request logging
- **Console Logging:** Application logs
- **Audit Logs:** Critical operation tracking
- **Error Handling:** Centralized error handler

### Planned Enhancements

- **Application Metrics:** Performance monitoring
- **Log Aggregation:** Centralized logging
- **Health Checks:** System health monitoring
- **Alerting:** Automated alerts for issues

## Testing Strategy

### Current Testing

- **Unit Tests:** Vitest for backend, Vitest/React Testing Library for frontend
- **Integration Tests:** API integration tests
- **Security Tests:** Input validation, XSS, SQL injection tests
- **Test Coverage:** Target ≥80% (in progress)

### Test Structure

- Backend: `server/src/tests/*.test.ts`
- Frontend: `src/tests/*.test.tsx`, `src/pages/*.test.tsx`
- Test Configuration: `vitest.config.ts`

## Future Considerations

### Scalability

- **Horizontal Scaling:** Load balancer configuration
- **Microservices:** Consider for high-traffic modules
- **Caching Layer:** Redis implementation
- **Database Sharding:** For very large datasets

### Maintainability

- **ORM Migration:** Consider Prisma or TypeORM
- **API Documentation:** OpenAPI/Swagger
- **Code Documentation:** Enhanced JSDoc comments
- **Migration System:** Database migration framework

### Security

- **HttpOnly Cookies:** For JWT storage
- **Encryption at Rest:** For sensitive data
- **Compliance:** HIPAA, GDPR considerations
- **Security Audits:** Regular security reviews

## References

- [Architecture Review](./ARCHITECTURE_REVIEW.md) - Comprehensive architecture analysis
- [Database Schema](./DATABASE_SCHEMA.md) - Detailed database documentation
- [Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md) - Development progress
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Deployment instructions

---

**Last Updated:** January 2025  
**Version:** 1.2.0
