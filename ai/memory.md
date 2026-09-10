# AI Memory

Standing constraints that every agent must honor while working in this repo. Updated 2026-09-10.

## Hard rules
1. **NO GRADIENTS** in any UI code or styles. Flat colors from tokens in `src/index.css` only (navy `#001F3F`, sea blue `#0284C7`).
2. **ZERO unresolved TypeScript errors** — root `npm run type-check` and `cd server && npm run build` (tsc) must pass cleanly. No `@ts-ignore`.
3. **Mandatory documentation** — every change updates `docs/CHANGELOG.md`; convention changes update this file and `ai/agents.md`/`ai/skills.md`.
4. **No secrets in git** — `.env*` is untracked by policy (`.env.local` was removed from the index 2026-09-10 after being committed with real production secrets: Twilio, SMTP, Gemini, Google Drive, JWT/SESSION/ENCRYPTION keys — **those secrets must be rotated by the operator**).
5. **Tests stay green** — vitest (root + server), Playwright e2e optional (e2e kept local-only; not tracked). Never delete tests to pass.

## Architecture memory
- Frontend: React 19, Vite 8, Tailwind v4, shadcn/ui primitives in `src/components/ui/`, routes lazy-loaded in `src/App.tsx`, dev API via `src/server/mockApi.ts`.
- Backend: Express 5 layered `routes → controllers → services → database` (ESM + TS 7, `moduleResolution: bundler`), mysql2 parameterized queries, JWT + RBAC middleware, express-validator. All route files exist; full endpoint map in `docs/API.md` §6.
- EOL policy: **LF in the repo for all text** (`.gitattributes`; CRLF only for `.bat`/`.ps1`). Repo-local `core.autocrlf=false` — system git config has `autocrlf=true`, do not touch it. Use `.gitattributes`, never per-file EOL hacks.
- PWA: production build emits the real SW (`generateSW`, `/api/patients` `NetworkOnly`); **dev-mode SW generation is disabled** (`devOptions.enabled=false`) because dev-dist has no precacheable assets — `virtual:pwa-register` still resolves in dev and `registerSW()` no-ops. Validate PWA via `npm run build` + `npm run preview`.
- Root + `server/` are separate packages with own node_modules and lockfiles (npm is authoritative; `bun.lock` is legacy/ignored).

## Active context
- Branch: `feat/production-hardening` — production hardening pass (deps, backend completion, frontend UI/UX refactor, docs, AI tooling) completed 2026-09-10; all validation gates green.
- Security & ops follow-ups (operator options 2–5) completed 2026-09-10: xlsx→exceljs, csurf removed, sequelize removed, DB password env-only, PHI PWA policy set to NetworkOnly, DEPLOYMENT.md rewritten. `npm audit`: **0 vulnerabilities** in root and server. **Option 1 (secret rotation) is the operator's remaining action.**
- Dependencies pinned at latest stable: react 19.3, vite 8, recharts 3, express 5, multer 2, exceljs 4, TS 7 (server) / TS 6.0.3 (root, typescript-eslint peer constraint).
- `src/docs/` canonical troubleshooting file is `TROUBLESHOOTING.md` (uppercase); case-collision stub removed.

## Watch list / residual risks
- **Operator rotation (option 1, 2026-09-10)**: **COMPLETE** — the operator rotated every secret that was historically committed in `.env.local` (Twilio, SMTP, Gemini, Google Drive OAuth, ENCRYPTION_KEY/IV, SESSION_SECRET, JWT_SECRET, DB_PASSWORD). `server/backups/backup_2025-11-22T23-00-00-026Z.sql` (real DB dump with PHI) was tracked until 2026-09-10 — now gitignored; history scrub remains optional/operator decision.
- `vite.config.ts` sets `allowedHosts: true` and `host: 0.0.0.0` — review for production. (Human decision.)
- `financialModule.test.ts` requires a live MySQL DB (its `beforeAll` counts accounts); compiles without DB, runs only with schema+seed applied.
- `npm audit` residuals (dev-only, no production path): root js-yaml (prototype pollution in `<<`, via eslint toolchain) and glob CLI (command injection via `-c`, dev tool). Tracked in `docs/CHANGELOG.md`.
- Server runtime deps now declared locally (express-session, cookie-parser, axios, exceljs); no reliance on root `node_modules` hoisting.