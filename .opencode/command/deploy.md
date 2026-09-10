---
description: Production deployment checklist for SHMS. Reviews env, TLS, PWA cache policy, CORS, rate limits, backups, and docs. Runs read-only checks and lists human approvals needed.
agent: security
---

Run the production-readiness + security-review passes for SHMS and output a deployment checklist:

1. Read `AGENTS.md` rules and the `production-readiness` + `security-review` skills.
2. Verify builds (`npm run build`, `cd server && npm run build`).
3. Check `.env.example` completeness against `process.env`/`import.meta.env` usage.
4. Audit `vite.config.ts` PWA + `allowedHosts`, `server/src/config/database.ts` hardcoded fallback, helmet/CORS/rate-limit in `server/src/index.ts`, cookie settings, morgan logging.
5. `npm audit` both packages; summarize high/critical.
6. Confirm `docs/DEPLOYMENT.md` matches `src/docs/deployment-guide*` reality.
7. Produce: BLOCKERS (must fix), APPROVALS REQUIRED (secret rotation, DB credentials, TLS certs, Stripe/Twilio/Google keys — human operator), READY items.

You are read-only: report, never modify secrets or infrastructure.