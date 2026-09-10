---
name: production-readiness
description: Use when preparing SHMS for production — build validation, env configuration, TLS, PWA cache policy, deployment checklist, monitoring, and backup. Coordinates the security-review skill when exposure is suspected.
---

# Production Readiness (SHMS)

## Trigger
User asks to deploy, harden, or "make it production-ready".

## Checklist
1. **Builds**: root `npm run build` and `server && npm run build` pass with zero TS errors.
2. **Env**: `.env.example` documents every variable used by code (grep `process.env.` in server/src, `import.meta.env` in src). `.env.local` must never be tracked.
3. **Secrets**: all keys referenced via env only; no hardcoded defaults for production-critical values (e.g., `DB_PASSWORD` fallback in `config/database.ts` is dev-only — flag it).
4. **TLS**: behind proxy or `HTTPS_KEY_PATH`/`HTTPS_CERT_PATH`; cookie `secure: true` in production.
5. **PWA**: `vite.config.ts` caches `/api/patients` in a service worker — confirm this is acceptable for the deployment (PHI on device) or switch to NetworkOnly + NetworkFirst with strict policy.
6. **Rate limits / lockout**: `express-rate-limit` + login lockout tuned; `helmet` on; CORS restricted to `FRONTEND_URL`.
7. **Backups**: `server/src/jobs/backup.job.ts` schedule + retention configured.
8. **Observability**: logging (morgan → file/console), health endpoint, error reports.
9. **Data**: schema.sql applied; migrations/seed documented; DB credentials delivered out-of-band.
10. **Docs**: DEPLOYMENT.md reflects the actual target platform (review `docs/DEPLOYMENT.md`, `src/docs/deployment-guide*`).

## Coordinate
When unsure about exposure, run the `security-review` skill and route secret/infra decisions to the human operator. Do NOT modify secrets, credentials, or production infra without explicit approval.