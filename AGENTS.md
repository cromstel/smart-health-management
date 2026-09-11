# AGENTS.md — Smart Health Management System (SHMS)

Canonical operating rules for AI agents (and humans) working in this repository.
Read this file first. It overrides generic conventions wherever they conflict.

## 1. Project overview
Enterprise healthcare management platform: patient records, appointments, clinical AI workspace, pharmacy/inventory, hospital operations, staff, financial accounting, RBAC, and super-admin control.
- **Frontend** — `src/`: React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router v7, Recharts, motion, PWA (vite-plugin-pwa).
- **Backend** — `server/`: Node.js + Express (ES modules, TypeScript via `tsx`), MySQL 2 (`mysql2/promise`), JWT auth, helmet, express-rate-limit, express-validator, bcryptjs, nodemailer, cron jobs.
- **Tests** — vitest for frontend and backend; Playwright e2e in `e2e/`.
- **Docs** — `README.md`, `DOCUMENTATION.md` (public); `docs/`, `src/docs/` (docs site), `ai/*.md` (AI memory), `.opencode/` (agents/skills/commands), and `scripts/` are **local-only** — kept out of the public repository by policy (2026-09-11).

## 2. Non-negotiable rules
1. **NO GRADIENTS** — never introduce gradient UI (Tailwind `bg-gradient-*`, CSS `linear-gradient`/`radial-gradient`). Flat colors from design tokens in `src/index.css` only.
2. **ZERO unresolved TypeScript errors** — `npm run type-check` (root) and `cd server && npm run build` must pass. No `@ts-ignore` to dodge errors.
3. **Mandatory documentation** — every feature/endpoint/decision gets a local doc update (`docs/CHANGELOG.md` at minimum, plus `ai/memory.md` for conventions). Note: `docs/`, `ai/`, `.opencode/`, and `scripts/` are local-only (gitignored) — documentation required by this rule is written to local files, never to public `README.md` unless it describes public-facing behavior.
4. **No secrets in code or git** — credentials only via env. `.env.local` is NOT tracked (removed from index 2026-09-10). Never commit `.env*` files.
5. **Tests must stay green** — refactors may update tests to reflect intended behavior, never delete coverage to pass CI.

## 3. Architecture conventions
### Frontend
- Pages in `src/pages/`, components in `src/components/` (feature folders: patients, pharmacy, staff, dashboard, vitals, voice, emergency, handover, security, super-admin, search, common, layout, ui).
- shadcn/ui primitives in `src/components/ui/` — reuse them; do not create new primitives.
- Routes lazy-loaded in `src/App.tsx`. Auth via `contexts/AuthContext`; theme via `contexts/ThemeContext`.
- Data access through `src/services/` and `src/api/`; dev mode uses `src/server/mockApi.ts` middleware mounted in `vite.config.ts`.
- Design tokens: navy `#001F3F`, sea blue `#0284C7` (see `--sea-blue`), dark default theme.

### Backend
- Layered: `routes/` → `controllers/` (validation + orchestration) → `services/` (business logic) → `database/` (schema.sql, seed.sql).
- All routes mount `requireAuth` from `server/src/middleware/auth.ts`; RBAC via `requirePermission`.
- Parameterized SQL only (mysql2). `express-validator` for all inputs.
- Backend topics live under local-only `docs/DATABASE.md`, `docs/API.md`.

## 4. Quality gates (run before finishing any task)
| Layer | Command | Must pass |
|---|---|---|
| Frontend lint | `npm run lint` | no new errors |
| Frontend types | `npm run type-check` | clean |
| Frontend tests | `npm test -- --run` | all green |
| Frontend build | `npm run build` | clean |
| Backend lint | `cd server && npm run lint` | no new errors |
| Backend build | `cd server && npm run build` | clean |
| Backend tests | `cd server && npm test -- --run` | all green |
| E2E (optional) | `npx playwright test` | all green |

## 5. Agents, skills, workflows
The items below are **local-only** (`.opencode/`, `ai/`) — gitignored, not part of the public repository.
- **Agents** (`.opencode/agent/`): `frontend`, `backend`, `review`, `docs`, `dependencies`, `security`.
- **Skills** (`.opencode/skills/`): `frontend-refactor`, `backend-api`, `security-review`, `testing`, `documentation`, `production-readiness`.
- **Commands / workflows** (`.opencode/command/`): `/verify`, `/test`, `/build`, `/docs`, `/deploy`.
- **AI memory**: `ai/context.md` (overview), `ai/agents.md` (agent roster), `ai/skills.md` (skill triggers), `ai/memory.md` (standing constraints), `ai/scratchpad.md` (transient notes).

## 6. Environment & setup
- Copy `.env.example` → `.env.local` (local only; untracked). Key vars: `PORT`, `VITE_BASE_URL`, `VITE_API_URL`, `FRONTEND_URL`, `DB_*`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`/`ENCRYPTION_IV`, `GEMINI_API_KEY`, SMTP/Twilio/Stripe/Google keys.
- Database: `mysql -u root -p < server/src/database/schema.sql` then `server/src/database/seed.sql`.
- Dev: root `npm run dev` (Vite on :3000), `cd server && npm run dev` (API). `npm run dev:all` runs both.
- Demo accounts: `demo-accounts/`; default dev creds `admin@hospital.com` / `admin123` (dev only).

## 7. Git workflow
- Branch per feature: `feat/<name>` or `fix/<name>`. Current hardening branch: `feat/production-hardening`.
- Commit messages: concise, conventional (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Push + open PR; merge only when validation gates pass and review approves.

## 8. Security-sensitive operations (HUMAN REQUIRED)
The following require explicit human approval — do not self-act:
- Rotating/regenerating any real secret (Twilio, SMTP, Gemini, Stripe, Google Drive/OAuth, JWT/SESSION/ENCRYPTION keys).
- Production database credentials, schema changes on live data, or migrations outside `server/migrations/`.
- TLS cert provisioning, DNS, or cloud infrastructure changes.
- Changing PWA caching of PHI endpoints (`/api/patients`) — policy set 2026-09-10 to `NetworkOnly` (no PHI in the service worker); changing it requires another operator decision.
- Deep-rewriting git history (e.g., scrubbing the 2025-11-22 DB backup dump that was tracked before 2026-09-10).