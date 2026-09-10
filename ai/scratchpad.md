# AI Scratchpad (transient notes)

## 2026-09-10 — Production hardening pass
- Cloned repo from github.com/cromstel/smart-health-management onto branch `feat/production-hardening`.
- **Security**: `.env.local` was committed with real secrets (Twilio SID/token, SMTP password, Gemini key, Google Drive secret, ENCRYPTION_KEY/IV, SESSION_SECRET, JWT_SECRET, DB password). Removed from index 2026-09-10; policy added to .gitignore. → Human must rotate all exposed secrets.
- Case-collision fixed: only `src/docs/TROUBLESHOOTING.md` (uppercase) remains tracked.
- Created `.opencode/` agents (build, frontend, backend, review, docs, dependencies, security), 6 skills, 6 command workflows; wrote `AGENTS.md`; refreshed `ai/*.md`.
- NEXT: dependency upgrade to latest stable (root + server) → frontend UI/UX refactor → docs/CHANGELOG updates → full validation → commit/PR.

## Open questions for operator
1. Rotate: Twilio, SMTP, Gemini, Google Drive OAuth, ENCRYPTION_KEY/IV, SESSION/JWT secrets (exposed in repo history).
2. Approve PWA caching of `/api/patients` (PHI) or change policy.
3. Provide production DB credentials (dev fallback hardcoded in `server/src/config/database.ts`).
4. Target deployment platform for DEPLOYMENT.md (current docs mention cPanel/Vercel/render variants).