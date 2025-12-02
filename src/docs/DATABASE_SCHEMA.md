# Database Schema Documentation

This document provides a detailed overview of the database schema for the Smart Health Manager application.

## Table of Contents

- [Roles](#roles)
- [Users](#users)
- [Permissions](#permissions)
- [Hospitals](#hospitals)
- [Departments](#departments)
- [Staff](#staff)
- [Patients](#patients)
- [Medical History](#medical_history)
- [Allergies](#allergies)
- [Appointments](#appointments)
- [Appointment Reminders](#appointment_reminders)
- [Documents](#documents)
- [Tags](#tags)
- [Document Tags](#document_tags)
- [Medicines](#medicines)
- [Accounts](#accounts)
- [Transactions](#transactions)
- [Audit Logs](#audit_logs)
- [Settings](#settings)
- [Super Admin Settings](#super_admin_settings)
- [Suppliers](#suppliers)
- [Purchase Orders](#purchase_orders)
- [Medicines Inventory](#medicines_inventory)
- [Medicine Batches](#medicine_batches)
- [Prescriptions](#prescriptions)
- [Invoices](#invoices)
- [Invoice Items](#invoice_items)
- [Payments](#payments)
- [Expenses](#expenses)
- [Payroll](#payroll)
- [Tax Rules](#tax_rules)
- [Forecasts](#forecasts)

---

### `roles`

Stores user roles within the application.

| Column      | Type            | Description                  |
|-------------|-----------------|------------------------------|
| id          | BIGINT UNSIGNED | Primary Key                  |
| name        | VARCHAR(100)    | Unique name of the role      |
| description | TEXT            | Description of the role      |
| user_count  | INT             | Number of users with this role |
| created_at  | TIMESTAMP       | Record creation timestamp    |
| updated_at  | TIMESTAMP       | Record update timestamp      |

---

### `users`

Stores user account information.

| Column                   | Type            | Description                               |
|--------------------------|-----------------|-------------------------------------------|
| id                       | BIGINT UNSIGNED | Primary Key                               |
| role_id                  | BIGINT UNSIGNED | Foreign key to `roles` table              |
| email                    | VARCHAR(255)    | Unique user email                         |
| password                 | VARCHAR(255)    | Hashed password                           |
| name                     | VARCHAR(255)    | User's full name                          |
| status                   | ENUM            | `active`, `inactive`, `locked`            |
| login_attempts           | INT             | Failed login attempts                     |
| locked_until             | DATETIME        | Timestamp until the account is locked     |
| last_login               | DATETIME        | Timestamp of the last successful login    |
| password_must_change     | BOOLEAN         | Flag to force password change             |
| password_changed_at      | DATETIME        | Timestamp of the last password change     |
| password_postpone_count  | INT             | Number of times password change was postponed |
| onedrive_access_token    | TEXT            | OneDrive API access token                 |
| onedrive_refresh_token   | TEXT            | OneDrive API refresh token                |
| googledrive_access_token | TEXT            | Google Drive API access token             |
| googledrive_refresh_token| TEXT            | Google Drive API refresh token            |
| created_at               | TIMESTAMP       | Record creation timestamp                 |
| updated_at               | TIMESTAMP       | Record update timestamp                   |

---

### `permissions`

Defines permissions for each role on different modules.

| Column     | Type            | Description                  |
|------------|-----------------|------------------------------|
| id         | BIGINT UNSIGNED | Primary Key                  |
| role_id    | BIGINT UNSIGNED | Foreign key to `roles` table |
| module     | VARCHAR(50)     | Name of the application module |
| can_view   | BOOLEAN         | View permission              |
| can_add    | BOOLEAN         | Add permission               |
| can_edit   | BOOLEAN         | Edit permission              |
| can_delete | BOOLEAN         | Delete permission            |

---

... and so on for all other tables.