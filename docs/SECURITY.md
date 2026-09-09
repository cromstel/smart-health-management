# Security Architecture & Compliance - Smart Health Manager

## 1. Security Philosophy & Threat Model
Smart Health Manager enforces a **Zero Trust, Security-in-Depth Architecture** designed to protect Protected Health Information (PHI) and safeguard healthcare operations against unauthorized access, data leaks, and privilege escalation.

---

## 2. Authentication & Role-Based Access Control (RBAC)

### 2.1 Credential & Session Hygiene
- **Passwords**: Hashed server-side using Argon2id / bcrypt with high work factors.
- **Session Tokens**: Transmitted via `HttpOnly`, `SameSite=Strict`, `Secure` cookies (`smart_health_session`), preventing client-side script access and XSS theft.
- **Session Timeout**: Inactive clinician sessions expire automatically after **30 minutes**.

### 2.2 Role Permissions Matrix
```
+------------------+-------------+----------------+-----------+------------+----------------+
| Permission       | Super Admin | Hospital Admin | Clinician | Pharmacist | Patient Portal |
+------------------+-------------+----------------+-----------+------------+----------------+
| View All Vitals  |      X      |       X        |     X     |     -      |    Self Only   |
| Log Vitals       |      -      |       -        |     X     |     -      |       -        |
| Dispatch Stat    |      -      |       -        |     X     |     -      |       -        |
| Manage Staff     |      X      |       X        |     -     |     -      |       -        |
| Fulfill Scripts  |      -      |       -        |     -     |     X      |       -        |
| System Audit Logs|      X      |       -        |     -     |     -      |       -        |
+------------------+-------------+----------------+-----------+------------+----------------+
```

---

## 3. Multi-Factor Authentication (2FA)
- Mandatory 2FA for Super Admin and Hospital Admin accounts.
- Uses Standard Time-based One-Time Password (TOTP, RFC 6238) compatible with Google Authenticator or Authy.
- Provides 10 cryptographically generated single-use backup recovery codes.

---

## 4. API Key & Secret Management
- **Zero Client Key Exposure**: All third-party secrets (database strings, external AI keys) reside exclusively on the Node.js backend server (`process.env`).
- **`.env.example` Declaration**: All environment configuration keys are documented in `.env.example` without publishing actual credentials.
- **Client Variables**: Non-sensitive client settings use the `VITE_` prefix and are strictly restricted to public parameters.

---

## 5. Input Sanitization & Attack Mitigations

| Threat Vector | Mitigation Strategy | Implementation Details |
| :--- | :--- | :--- |
| **XSS (Cross-Site Scripting)** | Input Escaping & CSP | React auto-escaping + strict Content Security Policy headers |
| **CSRF (Cross-Site Request)** | Anti-CSRF Tokens | Custom `X-CSRF-Token` validation middleware on state-changing endpoints |
| **SQL Injection** | Parameterized Queries | ORM parameterized statements / prepared statement binding |
| **Brute Force Attacks** | Rate Limiting | `express-rate-limit` restricting login attempts to 5 per minute |
| **Data Exposure in Logs** | Redaction Pipeline | Automatic masking of PHI, SSNs, and passwords in backend logs |

---

## 6. Temporary Patient Summary Token Security
- Temporary patient summary links (`/shared/patient-summary/:token`) use 256-bit entropy random tokens.
- Tokens self-destruct after **15 minutes**.
- Summary view displays anonymized demographic data without exposing MRN or permanent contact details.
