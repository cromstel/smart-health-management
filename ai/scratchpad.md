# AI Scratchpad (transient notes)

## 2026-09-10 — Production hardening pass (COMPLETED)
- Clone → branch `feat/production-hardening` → commit `330d9da` → PR #12 (open, awaiting review/merge).
- ✅ All root + server deps at latest stable; server build passes with **0 TS errors** (14 missing modules implemented).
- ✅ Frontend UI/UX refactor complete; 19 FE tests + 25 BE tests green (financialModule.test.ts is MySQL-gated).
- ✅ Agents/skills/workflows created in `.opencode/`, `AGENTS.md` written, `ai/*` refreshed, docs updated (README, DOCUMENTATION, API, CHANGELOG).

## 2026-09-10 — Security & Ops follow-ups (options 5, 4, 3, 2 — COMPLETED)
- ✅ **Option 5 (advisories)**: `xlsx` → `exceljs` (rewritten `reportFormatters/xlsx.ts`, call sites awaited); `csurf` removed (unused — CSRF middleware is self-contained crypto); `sequelize`/`sequelize-cli` + legacy `models/`, `migrations/`, `config/config.json` deleted (`db:setup` replaces `db:migrate`/`db:seed`). `npm audit`: **0 vulnerabilities** (root + server). Dev-only residuals tracked: js-yaml + glob CLI.
- ✅ **Option 4 (deployment)**: `docs/DEPLOYMENT.md` rewritten for the real topology (Vite SPA + Express/tsc + MySQL 8) with a VPS/Nginx/PM2 reference, fail-fast env contract, TLS, backups, and PaaS alternates.
- ✅ **Option 3 (PHI caching)**: `vite.config.ts` `/api/patients` → `NetworkOnly` (operator-approved); AGENTS.md + memory updated.
- ✅ **Option 2 (DB, no hardcoded password)**: `Password#123` fallback removed from `database.ts`/`create-db.ts`/`run-sql.ts`; MySQL TLS opt-in via `DB_SSL=true`; `getSecret()` fail-fast in production for JWT/SESSION/ENCRYPTION; backup/restore uses env config + `MYSQL_PWD` + path-traversal guard; batch alerts only when `ADMIN_EMAIL`/`ADMIN_PHONE` set; `express-session`/`cookie-parser`/`axios` moved into server package (no more root hoisting); legacy `server/backups/*.sql` untracked + gitignored.
- Validation: root type-check/lint/test/build + server lint/build/test all green; audits clean.
- NEXT: **Operator action = Option 1** — rotate all secrets that were committed in `.env.local` (Twilio, SMTP, Gemini, Google Drive, ENCRYPTION_KEY/IV, SESSION_SECRET, JWT_SECRET, DB password), then update `.env.local`. Optional: DB history scrub for `backups/backup_2025-11-22…sql`.

## Resolved operator questions (options 2–5 handled; option 1 remains operator-owned)
1. **Rotate secrets**: `.env.local` was committed in repo history — **operator rotates** (user performs option 1 manually).
2. **Production DB**: code is env-only now (`DB_PASSWORD` required; `DB_SSL` opt-in). Operator supplies real credentials; note local MySQL uses `auth_gssapi_client` plugin (test env).
3. **PHI caching**: **decision made 2026-09-10** → `NetworkOnly` for `/api/patients`.
4. **Deployment target**: reference deployment documented (VPS/Nginx/PM2); alternating platforms documented in `docs/DEPLOYMENT.md` §6.
5. **Residual advisories**: **all resolved** (see above); only dev-only items (js-yaml, glob CLI) remain tracked in CHANGELOG.