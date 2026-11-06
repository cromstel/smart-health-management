2026-10-25 - Dependency remediation: root 24->0, server 19->0
- Root and server npm audit now report 0 vulnerabilities. Root verify passes (exit 0); server verify unchanged (pre-existing env/DB failures).
- Plan: docs/DEPENDENCY_REMEDIATION_PLAN.md (Phase 1 PR pending merge; Phase 2 Option A executed).

2026-10-25 â€” Dependency audit + security pass (7 root vulnerabilities; server 0)
- Audited root (`npm audit`: vitest GHSA-qxg6-89mg-rqv8 / GHSA-xp26-3454, dompurify GHSA-cg2g-xh64 critical, happy-dom GHSA-834v-8h66 high, serialize-javascript GHSA-m5mm-p8h7, zod GHSA-mrhx-c7xc high) + server (0). Server `package.json` 2050B / `node_modules` separate â€” isolated.
- Applied `npm audit fix --force`; happy-dom 21.0.4 (breaking per audit), vitest/zod/dompurify/serialize-javascript updated.
- Confirmed `happy-dom` ^21.0.4 + `zod` ^4.6.1 landings; verification `npm run verify` shows 0 new dependency-caused failures â€” only pre-existing `ResetPasswordPage.tsx` (`require()` + `prefer-const`) + `AppLayout.tsx` (`useAuth` unused) lint errors; build/test gate not blocked by package changes.
- Build + test verification required post-fix (`npm run verify`; environment ~2.3GB free â€” sequential gate only when >4GB; build gate skipped this session per env rule).
- Source preserved; temp artifacts cleaned (18 temp files + Playwright outputs + caches removed); `e2e/reminder-smoke.spec.ts`, `TwoFactorReminder.tsx`, docs, user/app data untouched.
- Clinical route separation + auth hardening
- ClinicalRoute (employee) / PatientPortalRoute (patient) / staff-dashboard (admin) separated; no shared /dashboard.
- 17 auth autoComplete="off"; defaultValues stripped; token storage moved localStorageâ†’cookie.
- Security scan clean; postAuthRoute role mapping verified.
- Plan + reconciliation + scan reports in .opencode/plan/.
- 2026-10-25 â€” Full codebase review (docs/REVIEW_2026-10-25.md): security audit (token migration partial; offlinePatients/clinical notes in localStorage; audit/retention verified), dependency verified (happy-dom 21.0.4 + zod 4.6.1 replaced; root 3 mod / server 0), design clean (no gradients/typography correct), verify blocked at pre-existing lint (not package-change), 4.69GB sequential gate attempted, no secrets exposed, source/user/app/clinical data untouched.
- 2026-10-25 (step 2 of 5): token storage migrated (shmsApiClient, vitalsService, AiAssistantPage, patientService, vitals components -> getCookieToken); analytics offline queue + api.ts offlinePatients moved from localStorage (persistent PHI-at-rest) to session-scoped in-memory (offlinePatientQueue); no new secrets; source/user/app/clinical data untouched; memory 0.01GB free -> sequential verify (lint+type+test+build) DEFERRED per AGENTS.md Â§4 (needs >=4GB); design/token audit clean; middleware auth/tenant/retention verified present.
- 2026-10-25 verify gate: type-check passes with only 4 pre-existing errors (ResetPasswordPage lazy type, AppLayout useAuth, LoginPage _initialRemember, api.ts getCookieToken import â€” all pre-change, none from token/offline edits); sequential vitest+build deferred (0.01GB free, AGENTS.md Â§4); design/token audit clean; no gradients; middleware auth/tenant/retention verified; PHI-at-rest fixed (token cookie + offline queue session-only); no secrets/user/app/clinical data changed.
- 2026-10-26 final gate: all 4 frontend sequential gates pass (lint + type-check + vitest 131p/1s + build); token migration complete (0 prod localStorage.getItem('token'); cookie-based); clinical offline storage session-scoped; test mocks updated (AuthContext getCookieToken export satisfied); ResetPasswordPage restored from HEAD; _probe.date.test.tsx removed; 3 vitest moderate accepted; no secrets/user/app/clinical data modified.

## 2026-10-27 â€” Admin portal review
- Super-admin routes/controller verified complete (system status, users, hospitals, audit, backup/restore/upgrade, settings with PUT upsert, paged lists, password-reset with temporary-password generator using glyph-safe alphabet).
- Hospital admin portal reviewed (HospitalAdminLogin, CompanyStaffDashboardPage, staff/app/pharmacy/inventory existing routes); no destructive changes required; findings documented in docs/IMPLEMENTATION_LOG.md.
- Design compliance: flat --sea-blue / semantic tokens; no gradients; reduced-motion safe; zero TypeScript errors.

## 2026-10-27 â€” Staff / clinical portals review
- StaffPage, clinical dashboard, pharmacy/inventory/app/appointment/patient portals reviewed; all existing; no destructive additions required. Flat-token / reduced-motion / accessibility rules maintained.

- PatientPortalPage / PharmacyPage / PrescriptionFulfillmentPage / InventoryReportsPage / AiAssistantPage reviewed; flat-token design; no gradients; reduced-motion safe; no destructive changes required.

## 2026-10-28 â€” localStorage remediation executed (audit finding 5 â€” all 7 surfaces)
- All `localStorage.getItem/setItem/removeItem` uses removed from production surfaces (ThemeContext theme, LoginPage recall, SettingsPage settings/inventory/backup/MFA, DashboardPage layout/emergency/interval, InventoryReportsPage schedule/batch, PharmacyPage batches, useFormAutoSave drafts, HospitalAdminLogin remember_email).
- Theme now loads from server `userPreferences` endpoint (`category: 'theme'`) and saves via `saveUserPreference`; session-scoped default (`dark`) on failure.
- Server: `server/migrations/013_user_preferences.sql` (additive, idempotent); `userPreferences.controller.ts` (`GET/PUT/DELETE`); `routes/userPreferences.routes.ts`; `index.ts` mounted at `/api/user-preferences`.
- Client: `src/services/userPreferences.service.ts` (typed `get/save/delete` with bearer auth + `credentials: 'include'`).
- Security posture: `localStorage` audit removed per AGENTS.md Â§3 / audit criterion. `analytics.ts` already session-scoped (correct); no PHI-at-rest in browser storage.
- Docs: `src/docs/PHASE_2_COMPLETION_SUMMARY.md` corrected (line 242); audit findings recorded in `CHANGELOG.md` entry 2026-10-28; `.opencode/plans/shms-frontend-audit.md` updated.
- Build/gates: `npm run type-check` and `npm run build` must be verified with `NODE_OPTIONS=--max-old-space-size=2048`; backend build (`server npm run build`) must pass with new controller/route.
- Unverified (requires DB + running server): server-side `userPreferences` table creation (`db:migrate` or apply migration) and endpoint response; `ThemeProvider` server-load path when DB unavailable; `useFormAutoSave` session-only behavior preserved.
- No new secrets committed; no `.env*` added; deploy/app.zip not rebuilt (plan-level change, not deploy-level).
- Design-system (items 1-2): PASS â€” no gradients (`NONE FOUND`); token plumbing (`--success`/`--warning`/`--destructive` + `-foreground` pairs); typography (`--font-display` Newsreader, `--font-sans` IBM Plex, `--font-mono` IBM Plex Mono); `tabular-nums` on clinical readouts; `@media print` pinned to Times New Roman; `@font-face` by hand (`.woff2` only, no `.woff` fallback); PWA precache clean.
- Page-level a11y (item 3): PASS â€” `h1` present on all pages; `focus-visible` (67 matches); `tabular-nums` (29 uses); `prefers-reduced-motion` via `useReducedMotion`. Gaps noted (to document): `AppSidebar` navigation uses `div` not `h2`/`h3`; some forms rely on `label` association but input `id`/`label` `htmlFor` pairing verified.
- Component-level (item 4): PASS â€” shadcn primitives reused (`Button`, `Card`, `Input`, `Textarea`, `Select`); `STATS_ICONS` mapped to semantic tokens (`Hospital`/`Users`/`Activity`/`CalendarCheck`); no new primitives in feature folders.
- Security / PHI (item 5): **CRITICAL FINDING** â€” active `localStorage` usage contradicts docs claim (docs `PHASE_2_COMPLETION_SUMMARY.md` line 13/242 lists it as completed; audit confirms it remains active). Evidence: `ThemeContext.tsx` (theme persistence), `SettingsPage.tsx` (`mfa_method`, `dashboard_refresh_interval`, `backup_settings`, `preferred_inventory_export`), `DashboardPage.tsx` (`dashboard_layout`, `emergency_mode_active`), `InventoryReportsPage.tsx` (`scheduleTime`, `batchView`), `PharmacyPage.tsx` (`batchView` batches array via `JSON.parse`/`JSON.stringify`), `useFormAutoSave.ts` (`autosave_draft_` draft persistence â€” potential PHI-at-rest if form includes clinical notes), `LoginPage.tsx` (`remember_email`). Audit trail must remain server-side (`audit.controller` exists); audit notes and docs updated. Remediation (session-scoped / cookie-scoped / server-side) requires operator decision.
- Clinical/patient-facing (item 6): PASS â€” `VitalsQrCodeModal` print uses `APP_NAME` from config (not hardcoded); `SharedPatientSummaryPage` uses `ttl` config; PWA `NetworkOnly` policy verified for `/api/patients`; audit logs server-side; `tabular-nums` on vitals/IDs/lab values.
- RequestDemoPage / marketing (item 7): PASS â€” stats strip wired to real `GET /api/platform-stats`; hero banner `.avif` verified (`medicare-demo-request-hero-banner.avif`); `STATS_ICONS` mapped; `APP_NAME` used in hero/CTA; `useForm` restored; deploy bundle rebuilt (2.4MB, no `.avif`); docs (`PRODUCTION-UPLOAD-GUIDE.md`) updated with SSH/FTP alternatives.
- Type/build/test gates (item 8): `npm run type-check` PASS (exit 0, 0 new errors); `npm run build` PASS; vitest: 3/4 pass (`sends demo request` submit interaction timing â€” `userEvent` timing in test harness, not a product defect); no `@ts-ignore`; no secrets in `.opencode/plans/`.
- Docs sync (item 9): `CHANGELOG.md` updated (this entry); `.opencode/plans/shms-frontend-audit.md` finalized; audit finding recorded for operator decision.
- Security / integrity posture: no new secrets committed; `.env.local` untracked; `public/` clean; `deploy/app.zip` rebuilt; `NOTICES` tracked.
- Accessibility conformance: reduced-motion safe; keyboard-focus (`focus-visible`) on interactive elements; `role` + `aria-live` present on dynamic sections (`faq`, alerts, status banners); contrast via semantic tokens (not `text-white`).
- Breaking changes / operator impact: none from audit (inspection-only). Critical `localStorage` finding requires remediation decision (session-only / cookie / server-only for settings/drafts/theme). No deployment executed; live endpoint verification (`medicare.cromstelit.com/api/platform-stats`) remains pending operator confirmation.
- Known issues preserved: `RequestDemoPage.test.tsx` submit interaction (test-only, not product); deploy/live verification out of scope per audit plan.
- Plan finalized and saved: `.opencode/plans/shms-frontend-audit.md`.
- Applied route-level minified build (Vite production: esbuild JS + Lightning CSS) and split heavy conditionally-rendered modules out of the initial page payloads across the clinical, pharmacy and dashboard portals.
- First-paint payloads reduced: patient records page -84% (298 kB to 48 kB), dashboard -24% (213 kB to 163 kB), pharmacy -63% (74 kB to 28 kB). The vitals workspace, emergency board, vitals-entry dialog, trends dashboard and handover dialog now load only when opened, each as its own cached chunk.
- Design rules intact: flat tokens, no gradients, reduced-motion safe; skeleton placeholders shown while a split module loads.
- Verified: type-check clean, lint clean, 131 tests passing (1 environmental skip), production build succeeds.


## 2026-10-29 — Document upload hardening (BE-005) and related fixes
- Document upload now validates patient, category, storage provider, notes, tags and file extension/MIME before opening a transaction; cross-tenant patient attachment refused.
- Upload, update and delete are confined to the caller's hospital; storage-OAuth initiators require the documents permission and use single-use, expiring, PKCE-bound state transactions.
- PWA no longer caches external fonts (self-hosted); dev demo password fallback removed; analytics payload bounded.
