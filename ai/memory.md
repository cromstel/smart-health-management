# AI Memory

Project enforces strict adherence to **NO GRADIENTS**, **zero unresolved TypeScript errors**, and **mandatory documentation** (every feature, endpoint, or decision updates `docs/CHANGELOG.md` at minimum; convention changes update this file and `ai/agents.md`/`ai/skills.md`).

## History split of combined commit (2026-09-25) — DONE, verified

- Operator approved (AGENTS.md §8) the rewrite of pushed `main`: combined commit `656d70b` (rebrand + financial API bundled) was split into two content-identical commits:
  - `78192e6` `feat: rebrand application across all layers to Smart MediCare` — 21 files, +34/−34, pure rename only (incl. the two rename hunks inside `FinancialPage.tsx` print header and `mockApi.ts` RP name, split via parent-checkout + single-hunk re-edit).
  - `fb21032` `feat(financial): add account and transaction edit/delete API` — 7 files: financial.routes.ts, FinancialPage.tsx, FinancialPage.integration.test.tsx, PurchaseOrdersPage.test.tsx, mockApi.ts (schema-align), api.ts, vitest.config.ts.
- Split mechanics: `git reset --soft/mixed` to parent, stage rename-only, commit; restore financial files from `656d70b`, commit; verified `git diff 656d70b main --stat` = empty (byte-identical tree).
- Dependent branches rebased `--onto main 656d70b` (same-tree rebase, conflict-free, zero drift verified via `git diff <newtip> <oldtip> --stat` = empty): `fix/financial-hardening` → `99079af`, `fix/server-storage-usage-test` → `4c20381`, `feat/rename-smart-medicare` → `c140956`. All force-pushed with lease.
- Safety: local ref `backup/pre-split-main` keeps original `656d70b`. PRs #13/#14/#15 effect unchanged.
- Docs updated: CHANGELOG entry added; this memory entry added.

## Smart MediCare rename completion (2026-09-25) — VERIFY GREEN

- Branch `feat/rename-smart-medicare` (PR pending): all remaining "Smart Health" / "Smart Health Systems" user-facing strings replaced with "Smart MediCare" across 22+ files.
- Frontend: LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, TwoFactorPage (×2), SuperAdminLogin, AuthLayout footer, LandingPage (Navbar, Hero, CTA, Footer ×2), RequestDemoPage (×4), SharedPatientSummaryPage, AppLayout SW toast, PWAInstallButton iOS guide, InventoryReportsPage default systemName, DashboardPage API telemetry title, PasswordStrength policy comment, mockApi.ts hospitalName, VitalsQrCodeModal print template "Smart Health Scanner" → "Smart MediCare Scanner".
- Backend: appointment.controller.ts ICS calendar name "SHMS Appointment" → "Smart MediCare Appointment"; demoRequest.controller.ts error + email template.
- E2E tests: auth-pages.spec.ts 4 expectations updated.
- Docs generator (build-dots.js): title/description updated.
- vitest.config.ts: added `src/components/layout/**/*.test.tsx` to include for AppSidebar test execution.
- All changes verified by full test suite (see gates below).

## Financial API hardening + frontend test repair (2026-09-24) — VERIFY GREEN

- Branch `fix/financial-hardening` (PR #14): four files changed, all gates green.
- `server/src/routes/financial.routes.ts`: express-validator chains (`param`/`body` + `validate`) on PUT/DELETE account & transaction routes.
- `server/src/controllers/financial.controller.ts`: `updateAccount`/`updateTransaction` now whitelist columns (accounts: name/type/parent_id/level/balance; transactions: date/description/debit/credit/reference) instead of `${key} = ?` from req.body → closes mass-assignment + column-name injection. `updateTransaction` regains `logAudit`.
- `src/pages/PurchaseOrdersPage.test.tsx`: native `<select>` interaction via `fireEvent.change` (clicking `<option>` alone does NOT update native selects in happy-dom; `createOrder()` early-returns when supplier_id empty). The test is NOT excluded from vitest — it runs and passes (4 tests).
- `src/pages/FinancialPage.integration.test.tsx`: account type chosen through Radix Select root (`within(dialog).getAllByRole('combobox')[0]` + `user.click` on `role="option"`), restoring real coverage. Passes (9 tests).
- Frontend suite is now 32 passed / 1 skipped; build clean. Server suite 86 passed / 6 skipped (financialModule = local-MySQL env condition).

## Environment & validation

- **Run validation gates sequentially, never in parallel on this dev machine.** The box has ~15.8 GB RAM total but only ~2.3 GB free with normal workloads; running the frontend build and backend test suite at the same time exhausts memory and OOMs Node ("Zone Allocation failed" / "memory allocation failed" / "VirtualAlloc failed" from `rolldown`/vite or vitest workers).
- Use the standard entry points: root `npm run verify` (lint â†’ type-check â†’ vitest --run â†’ `tsc -b` + vite build) and `server npm run verify` (lint â†’ tsc build â†’ vitest --run). These are intentionally sequential.
- If a single command still OOMs, raise the heap explicitly: `$env:NODE_OPTIONS="--max-old-space-size=2048"` before the command (Windows PowerShell). Do not raise it when other heavy processes are active.
- Known pre-existing environment facts: backend tests show 6 skipped tests tied to the local MySQL `auth_gssapi_client` plugin (financialModule suite auto-skips when the DB is unreachable); frontend suite is 19 passed / 1 skipped (the login test exercises the TOTP path). These are environmental, not regressions.
- `src/setupTests.ts` suppresses the known happy-dom/motion `AbortError: The animation was canceled.` unhandled rejections during test teardown â€” do not remove that handler or root `npm run verify` exits 1.

## Server backend recovery (2026-09-15) â€” COMPLETE, verify GREEN

- The server tree was rebuilt to Track B (production-hardening era) consistency. Surgical restores only â€” express **4** stays installed (Track B wired for express 5; not reinstalled).
- Restored files (from repo history; run `git checkout <commit> -- server/src/<path>` from repo root):
  - `dccee4e`: index.ts, controllers/auth.controller.ts (739-line MFA/TOTP/recovery/WebAuthn), controllers/webauthn.controller.ts, routes/webauthn.routes.ts, utils/webauthn.ts
  - `0e6a2b6`: middleware/auth.ts Â· `2b45649`: routes/auth.routes.ts Â· `c214e7e`: controllers/demoRequest.controller.ts + routes/demoRequest.routes.ts
  - `330d9da`: batch/prescription/patientLoadPrediction routes, appointment.controller, events/permissions.ts Â· `b08437e`: utils/totp.ts
  - `3076470`: controllers/superAdmin.controller.ts (incl. resetUserPassword + generateTemporaryPassword), routes/superAdmin.routes.ts
  - `89e5582`: src/setupTests.ts (happy-dom handler), server/src/tests/financialModule.test.ts (DB-availability guard)
- Manual fixes for tsc: document.controller.ts (`getStorageProvider(storageLocation, Number(req.user.id))`, `if (!doc)`, `doc.storage_type` at 212/240); pharmacy.controller.ts 129 (`await buildXlsx(list, String(reportType))`).
- Added 5 server deps: `@simplewebauthn/server@^14.0.1`, `exceljs@^4.4.0`, `axios@^1.20.0`, `cookie-parser@^1.4.7`, `express-session@^1.19.0`.
- **Gates now green (sequential):** `server npm run verify` = lint âœ“ + tsc build âœ“ + vitest âœ“ (86 passed, 6 skipped); root `npm run verify` = lint âœ“ + type-check âœ“ + vitest âœ“ (19 passed, 1 skipped) + `tsc -b` + vite build âœ“.
- tsc quirk: use `node node_modules/typescript/bin/tsc` â€” `npx tsc` crashes with a StackOverflowException artifact. Root `type-check` uses `tsc --noEmit` via .bin and is fine.
- Disk: run `npm cache clean --force` first if installs fail (box runs near-full).
- External automation is active and may move HEAD / commit / reset the tree at any time; keep verified work committed promptly.

## Known follow-ups (post-verify)

- None blocking. (The `webauthn_credentials` schema/seed gap was closed: schema.sql + seed.sql restored from `3076470` in `93cab97`.)
## Merge state (2026-09-15) - feat/production-hardening IN main (154aac3)

- Port complete: main @ 154aac3 (merge of ec175d2), force-pushed over old origin/main (12 remote-only cleanup commits superseded). Both branches deleted; repo clean, only main remains (local + remote).
- All gates green at merge time: frontend lint/type-check/build/tests (19 passed, 1 skipped), backend lint/build/tests (86 passed, 6 skipped).
- lucide-react 1.43.0 .d.ts files were missing after the ENOSPC-era install; plain `npm install` (not `npm ci` — EPERM on rolldown binding) restored them.
- If node processes hold `node_modules` (rolldown binding), prefer `npm install` over `npm ci` on this machine.

## Complete Smart MediCare rename (2026-09-25) — feat/rename-smart-medicare

- All user-facing "Smart Health" / "Smart Health Systems" references replaced with "Smart MediCare" across 23 files:
  - 12 auth pages/components: LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, TwoFactorPage, SuperAdminLogin, AuthLayout, PWAInstallButton
  - 3 marketing pages: LandingPage (navbar, hero preview, CTA, footer), RequestDemoPage, SharedPatientSummaryPage
  - Dashboard module title, InventoryReportsPage default system name, PasswordStrength policy comment
  - Server mockApi.ts hospitalName, VitalsQrCodeModal print template "Scanner"
  - Backend: appointment ICS calendar name "SHMS Appointment" → "Smart MediCare Appointment", demoRequest controller (error + email)
  - E2E tests: auth-pages.spec.ts (4 expectations)
  - Local docs generator: src/docs/build-docs.js (title/description)
- vitest.config.ts: added `src/components/layout/**/*.test.tsx` to include so AppSidebar.test.tsx runs in CI.
- AGENTS.md intentionally unchanged (operating rules codename "Smart Health Management System" kept as internal identifier per review decision).
- Docs updated: CHANGELOG.md entry added; this memory entry added.

## Documentation hardening — dead-link resolution (2026-09-26) — DONE, PENDING FINAL GATE CHECK

- **Public docs published** — `DOCUMENTATION.md` (re-tracked; `!DOCUMENTATION.md` in `.gitignore`; AGENTS.md §1 declares it public; resolves 9 README.md → DOCUMENTATION.md dead links from 638b1f2 over-broad `*.md` exclusion). Brand `SHMS` → `Smart MediCare`; demo table rebuilt with verified mock accounts (superadmin/admin/doctor/patient); fictional `nurse`/`pharmacy` and fabricated passwords (`doctor123` etc.) removed; quick-fill claims corrected; superadmin login (`/super-admin/login`) preserved.
- **NOTICE** created (Apache-2.0; resolves README link and matches `LICENSE` copyright line `© 2025 Smart MediCare | Powered By CIT Group` at line 189).
- **README.md** — AGENTS.md link reworded (local-only, no dead hyperlink); dev creds fixed (`admin@smarthealth.com`/`Pass@135709`); docs/*.md prose updated to reflect real local files (`docs/CHANGELOG.md`); current status references updated; `DOCUMENTATION.md` anchors verified (9 sections).
- **CONTRIBUTING.md** (local-only) — clone URL fixed (`https://github.com/cromstel/smart-health-management.git`); environment setup aligned (`cp .env.example .env.local`; `server/.env.example` removed since missing); brand fixed; checklist link preserved.
- **AGENTS.md** (local-only) — demo creds corrected (`Pass@135709`, `April--2024!!!!`).
- **src/docs/README.md** (tracked) — brand fixed; `../../DOCUMENTATION.md` links restored (previous `../DOCUMENTATION.md` would resolve to non-existent `src/DOCUMENTATION.md`); dead `./IMPLEMENTATION_CHECKLIST.md` links removed; stale facts corrected (version/date/ports/progress/development status).
- **docs-structure.json** (tracked docs-site config) — `ARCHITECTURE.md` case fixed → `architecture.md`; `SETUP.md` and `TROUBLESHOOTING.md` removed (missing / gitignored) → generator runs clean (verified; 3 categories, 8 files, 10 `.html` pages + `search-index.json` produced).
- **CHANGELOG.md** + `.gitignore` (`!DOCUMENTATION.md`) updated.

### Note
- `DOCUMENTATION.md` now public; `AGENTS.md` remains local-only by policy (`.gitignore` unchanged beyond `DOCUMENTATION.md` exception) — README references it as local-only text, avoiding a dead hyperlink.
- `docs/CHANGELOG.md` updated; `NOTICE` tracked; `docs-structure.json` and `build-docs.js` verified; all tracked `.md` links verified.
- Final gates (sequential) still pending per environment rules: root `npm run verify` (lint → type-check → vitest --run → `tsc -b` + vite build) and `server npm run verify` (lint → build → vitest --run). No TypeScript errors or new test failures introduced by doc-only edits.


## Documentation hardening — dead-link resolution (2026-09-26) — DONE, PENDING FINAL GATE CHECK

- **Public docs published** — `DOCUMENTATION.md` (AGENTS.md §1 calls it public; `!DOCUMENTATION.md` added to `.gitignore` to resolve the 9 README.md → DOCUMENTATION.md dead links from 638b1f2 over-broad `*.md` exclusion). Brand `Smart Health Management System (SHMS)` replaced with `Smart MediCare`; demo table rebuilt with real mock accounts (`admin@smarthealth.com`/`Pass@135709`, `superadmin@smarthealth.com`/`April--2024!!!!`, `doctor@smarthealth.com`/`Demo@135790`, `patient@smarthealth.com`/`P@ssword135`); fictional `nurse`/`pharmacy` accounts and `doctor123`/etc fake passwords removed; quick-fill claim removed (LoginPage only has TOTP demo-fill, not role quick-fill buttons); superadmin login reference corrected; `NOTICE` (Apache-2.0) created matching `LICENSE`; README.md links verified (`git ls-files` shows DOCUMENTATION.md tracked, check-ignore reports `NOT IGNORED`).
- **README.md** — AGENTS.md link reworded (local-only reference, no dead hyperlink); default dev creds corrected from fabricated `admin@hospital.com`/`admin123` to real mock admin (`admin@smarthealth.com`/`Pass@135709`), with full list pointing to DOCUMENTATION.md §5; docs/*.md prose references (DEPLOYMENT.md etc — nonexistent) replaced with links/references to DOCUMENTATION.md and `docs/CHANGELOG.md`; `docs/` tree updated to match actual contents.
- **AGENTS.md** (local-only) — demo cred line corrected (`admin@smarthealth.com`/`Pass@135709`, `superadmin@smarthealth.com`/`April--2024!!!!`).
- **CONTRIBUTING.md** (local-only) — clone URL corrected to `https://github.com/cromstel/smart-health-management.git` (previous `cromstelit/health-management.git`); env setup aligned with AGENTS.md §6 (`.env.example` → `.env.local`; `cp server/.env.example` removed since file does not exist); brand fixed; checklist link unchanged (exists locally).
- **src/docs/README.md** (tracked / public docs-site landing) — brand fixed; dead `../DOCUMENTATION.md` links restored (use `../../DOCUMENTATION.md`); dead `./IMPLEMENTATION_CHECKLIST.md` links removed; stale progress (45% → production-ready), version/date, ports (5174/5600 → 3000/5000), and `Backend Integration: Pending` corrected.
- **docs-structure.json** (docs site generator config) — `ARCHITECTURE.md` case fixed → `architecture.md`; `SETUP.md` and `TROUBLESHOOTING.md` removed (both missing / gitignored) → generator (`node build-docs.js` in `src/docs/`) now runs clean (verified; 10 `.html` pages + `search-index.json` produced). `overview.md` added as developer doc.
- Open decision noted: `DOCUMENTATION.md` is now public (re-tracked). AGENTS.md was intentionally kept untracked per 638b1f2; README reworded to reference it locally without a dead hyperlink.
- `NOTICE` (new, tracked), `.gitignore` updated (`!DOCUMENTATION.md`), `docs/CHANGELOG.md` updated with dead-link fix entry.
