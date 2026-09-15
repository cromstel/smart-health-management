# AI Memory

Project enforces strict adherence to **NO GRADIENTS**, **zero unresolved TypeScript errors**, and **mandatory documentation** (every feature, endpoint, or decision updates `docs/CHANGELOG.md` at minimum; convention changes update this file and `ai/agents.md`/`ai/skills.md`).

## Environment & validation

- **Run validation gates sequentially, never in parallel on this dev machine.** The box has ~15.8 GB RAM total but only ~2.3 GB free with normal workloads; running the frontend build and backend test suite at the same time exhausts memory and OOMs Node ("Zone Allocation failed" / "memory allocation failed" / "VirtualAlloc failed" from `rolldown`/vite or vitest workers).
- Use the standard entry points: root `npm run verify` (lint → type-check → vitest --run → `tsc -b` + vite build) and `server npm run verify` (lint → tsc build → vitest --run). These are intentionally sequential.
- If a single command still OOMs, raise the heap explicitly: `$env:NODE_OPTIONS="--max-old-space-size=2048"` before the command (Windows PowerShell). Do not raise it when other heavy processes are active.
- Known pre-existing environment facts: backend tests show 6 skipped tests tied to the local MySQL `auth_gssapi_client` plugin (financialModule suite auto-skips when the DB is unreachable); frontend suite is 19 passed / 1 skipped (the login test exercises the TOTP path). These are environmental, not regressions.
- `src/setupTests.ts` suppresses the known happy-dom/motion `AbortError: The animation was canceled.` unhandled rejections during test teardown — do not remove that handler or root `npm run verify` exits 1.

## Server backend recovery (2026-09-15) — COMPLETE, verify GREEN

- The server tree was rebuilt to Track B (production-hardening era) consistency. Surgical restores only — express **4** stays installed (Track B wired for express 5; not reinstalled).
- Restored files (from repo history; run `git checkout <commit> -- server/src/<path>` from repo root):
  - `dccee4e`: index.ts, controllers/auth.controller.ts (739-line MFA/TOTP/recovery/WebAuthn), controllers/webauthn.controller.ts, routes/webauthn.routes.ts, utils/webauthn.ts
  - `0e6a2b6`: middleware/auth.ts · `2b45649`: routes/auth.routes.ts · `c214e7e`: controllers/demoRequest.controller.ts + routes/demoRequest.routes.ts
  - `330d9da`: batch/prescription/patientLoadPrediction routes, appointment.controller, events/permissions.ts · `b08437e`: utils/totp.ts
  - `3076470`: controllers/superAdmin.controller.ts (incl. resetUserPassword + generateTemporaryPassword), routes/superAdmin.routes.ts
  - `89e5582`: src/setupTests.ts (happy-dom handler), server/src/tests/financialModule.test.ts (DB-availability guard)
- Manual fixes for tsc: document.controller.ts (`getStorageProvider(storageLocation, Number(req.user.id))`, `if (!doc)`, `doc.storage_type` at 212/240); pharmacy.controller.ts 129 (`await buildXlsx(list, String(reportType))`).
- Added 5 server deps: `@simplewebauthn/server@^14.0.1`, `exceljs@^4.4.0`, `axios@^1.20.0`, `cookie-parser@^1.4.7`, `express-session@^1.19.0`.
- **Gates now green (sequential):** `server npm run verify` = lint ✓ + tsc build ✓ + vitest ✓ (86 passed, 6 skipped); root `npm run verify` = lint ✓ + type-check ✓ + vitest ✓ (19 passed, 1 skipped) + `tsc -b` + vite build ✓.
- tsc quirk: use `node node_modules/typescript/bin/tsc` — `npx tsc` crashes with a StackOverflowException artifact. Root `type-check` uses `tsc --noEmit` via .bin and is fine.
- Disk: run `npm cache clean --force` first if installs fail (box runs near-full).
- External automation is active and may move HEAD / commit / reset the tree at any time; keep verified work committed promptly.

## Known follow-ups (post-verify)

- `server/src/database/schema.sql` (last commit 3076470) lacks the `webauthn_credentials` table that dccee4e added (+15 lines) — runtime seed gap for the passkey feature, not a build/test blocker.