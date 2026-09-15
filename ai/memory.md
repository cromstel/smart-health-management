# AI Memory

Project enforces strict adherence to **NO GRADIENTS**, **zero unresolved TypeScript errors**, and **mandatory documentation** (every feature, endpoint, or decision updates `docs/CHANGELOG.md` at minimum; convention changes update this file and `ai/agents.md`/`ai/skills.md`).

## Environment & validation

- **Run validation gates sequentially, never in parallel on this dev machine.** The box has ~15.8 GB RAM total but only ~2.3 GB free with normal workloads; running the frontend build and backend test suite at the same time exhausts memory and OOMs Node ("Zone Allocation failed" / "memory allocation failed" / "VirtualAlloc failed" from `rolldown`/vite or vitest workers).
- Use the standard entry points: root `npm run verify` (lint → type-check → vitest --run → `tsc -b` + vite build) and `server npm run verify` (lint → tsc build → vitest --run). These are intentionally sequential.
- If a single command still OOMs, raise the heap explicitly: `$env:NODE_OPTIONS="--max-old-space-size=2048"` before the command (Windows PowerShell). Do not raise it when other heavy processes are active.
- Known pre-existing environment facts: backend tests show 6 skipped tests tied to the local MySQL `auth_gssapi_client` plugin; frontend suite is 19 passed / 1 skipped (after removing the orphan RequestDemoPage test). These are environmental, not regressions.

## Server backend recovery (2026-09-15)

- HEAD's server tree currently **does not build**: tracked code imports many modules that are absent from the working tree AND from the commit history at HEAD. An external reset/git-clean mid-session deleted untracked source files, and the prior branch leaves were committed without them.
- Recovery sources (verified): the last commits containing each module are `330d9da` (routes/batch.routes.ts, routes/prescription.routes.ts, routes/patientLoadPrediction.routes.ts, controllers/appointment.controller.ts, events/permissions.ts), `b08437e` (utils/totp.ts), `dccee4e` (controllers/webauthn.controller.ts, routes/webauthn.routes.ts, utils/webauthn.ts). Restore with `git checkout <commit> -- server/src/<path>` (run from repo root).
- Also absent and referenced elsewhere: middleware/errorHandler, middleware/notFoundHandler, routes/{hospital,document,pharmacy,settings}.routes, controllers/batch.controller, services/stripe.service, services/reportFormatters/xlsx, config/env.js; package `@simplewebauthn/server` is not in server deps; `Express.Multer` namespace fails under `"types": ["node"]` (multter types not auto-loaded); `src/index.ts(86)` has an unused `req` under noUnusedParameters; `controllers/document.controller.ts` needs the file/docDetails fixes.
- 9 modules were restored locally (still uncommitted, `??` in git status) but NOT committed — they are early revisions that do not yet compile against current HEAD. Do not commit them until the full dependency closure is restored and `server npm run verify` is green.
- External automation is active and may move HEAD / commit / reset the tree at any time; keep verified work committed promptly.