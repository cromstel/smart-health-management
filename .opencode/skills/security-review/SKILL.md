---
name: security-review
description: Use when auditing secrets, PHI protection, authN/authZ, injection risks, dependency advisories, or production exposure in SHMS. Read-only — produces findings and remediation plan, never edits code.
---

# Security Review (SHMS)

## Trigger
User asks to audit security, check for leaked secrets, review auth, run npm audit, or prepare for production/pen-test.

## Procedure (read-only)
1. `git ls-files | grep -i env` — detect tracked env/secret files.
2. Grep for secret-shaped literals (sk-, AKIA, password=, BEGIN PRIVATE KEY, twilio SID, API keys) across tracked source (exclude node_modules/dist).
3. AuthZ sweep: every route in `server/src/routes/` must mount `requireAuth`/`requirePermission`.
4. Input handling: `express-validator` usage, parameterized SQL, `helmet`, `cors` origins, CSRF (`middleware/csrf.ts`).
5. PHI surfaces: service-worker caching in `vite.config.ts`, logs, emails, exported reports, shared patient-summary tokens (`/shared/patient-summary/:token`).
6. `npm audit` in root and `server/`.
7. Dependency on `morgan` request logging — confirm no body logging.

## Report format
- CRITICAL / HIGH / MEDIUM / LOW findings with `file:line`.
- Remediation plan (ordered).
- Questions requiring the human operator (secret rotation, cloud keys, DB access, certs, Stripe/Twilio/Google credentials).

## Hard rule
No edits. No commits. Security-sensitive remediation involving external accounts MUST be confirmed by the human operator first.