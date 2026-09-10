# AI Scratchpad (transient notes)

## 2026-09-10 — Production hardening pass (COMPLETED)
- Clone → branch `feat/production-hardening` → commit `330d9da` → PR #12 (open, awaiting review/merge).
- ✅ All root + server deps at latest stable; server build now passes with **0 TS errors** (14 missing modules implemented).
- ✅ Frontend UI/UX refactor complete; 19 FE tests + 25 BE tests green (financialModule.test.ts is MySQL-gated).
- ✅ Agents/skills/workflows created in `.opencode/`, `AGENTS.md` written, `ai/*` refreshed, docs updated (README, DOCUMENTATION, API, CHANGELOG).
- NEXT (transient): none — hardening done. Future sessions should start with `/verify`.

## Open operator questions (from this pass — resolved by human)
1. **Rotate secrets**: `.env.local` was committed in repo history with Twilio SID/token, SMTP password, Gemini key, Google Drive OAuth secret, ENCRYPTION_KEY/IV, SESSION_SECRET, JWT_SECRET, DB password → **rotate all of them**; update local `.env.local` with new values.
2. **Production DB**: provide real DB credentials (dev fallback `Password#123` still hardcoded in `server/src/config/database.ts`); run `schema.sql` + `seed.sql`; decide if `auth_gssapi_client` MySQL plugin should be used.
3. **PHI caching**: approve or change PWA runtime-caching of `/api/patients` in `vite.config.ts` (operator decision per AGENTS.md §8).
4. **Deployment target**: choose platform (docs/DEPLOYMENT.md + `src/docs/deployment-guide*` have cPanel/Vercel/Render variants) and confirm TLS cert provisioning.
5. **Residual advisories**: xlsx (no npm fix — plan migration), csurf→cookie (archived — plan replacement), sequelize→uuid (low).