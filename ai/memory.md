# AI Memory

Standing constraints that every agent must honor while working in this repo. Updated 2026-09-10.

## Hard rules
1. **NO GRADIENTS** in any UI code or styles. Flat colors from tokens in `src/index.css` only (navy `#001F3F`, sea blue `#0284C7`).
2. **ZERO unresolved TypeScript errors** — root `npm run type-check` and `cd server && npm run build` (tsc) must pass cleanly. No `@ts-ignore`.
3. **Mandatory documentation** — every change updates `docs/CHANGELOG.md`; convention changes update this file and `ai/agents.md`/`ai/skills.md`.
4. **No secrets in git** — `.env*` is untracked by policy (`.env.local` was removed from the index 2026-09-10 after being committed with real production secrets: Twilio, SMTP, Gemini, Google Drive, JWT/SESSION/ENCRYPTION keys — **those secrets must be rotated by the operator**).
5. **Tests stay green** — vitest (root + server), Playwright e2e optional. Never delete tests to pass.

## Architecture memory
- Frontend: React 19, Vite 8, Tailwind v4, shadcn/ui primitives in `src/components/ui/`, routes lazy-loaded in `src/App.tsx`, dev API via `src/server/mockApi.ts`.
- Backend: Express 5 layered `routes → controllers → services → database` (ESM + TS 7, `moduleResolution: bundler`), mysql2 parameterized queries, JWT + RBAC middleware, express-validator. All route files exist; full endpoint map in `docs/API.md` §6.
- Root + `server/` are separate packages with own node_modules and lockfiles (npm is authoritative; `bun.lock` is legacy/ignored).

## Active context
- Branch: `feat/production-hardening` — production hardening pass (deps, backend completion, frontend UI/UX refactor, docs, AI tooling) completed 2026-09-10; all validation gates green.
- Dependencies pinned at latest stable: react 19.3, vite 8, recharts 3, express 5, multer 2, TS 7 (server) / TS 6.0.3 (root, typescript-eslint peer constraint).
- `src/docs/` canonical troubleshooting file is `TROUBLESHOOTING.md` (uppercase); case-collision stub removed.

## Watch list / residual risks
- `server/src/config/database.ts` still has a hardcoded dev-only DB password fallback — replace with env-only for production. (Human decision.)
- `vite.config.ts` PWA runtime-caches `/api/patients` (PHI) — operator decision required before production. (Human decision.)
- `vite.config.ts` sets `allowedHosts: true` and `host: 0.0.0.0` — review for production. (Human decision.)
- `npm audit` residuals: csurf→cookie (low, archived package — plan CSRF replacement), sequelize→uuid (low), xlsx (high, **no npm fix exists** — plan migration to exceljs). Tracked in `docs/CHANGELOG.md`.
- `financialModule.test.ts` requires a live MySQL DB (its `beforeAll` counts accounts); compiles without DB, runs only with schema+seed applied.