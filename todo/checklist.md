# Task Checklist
[x] Phase 1: Foundation
[x] Phase 2: Core Modules
[x] Phase 3: Advanced Features
[x] Phase 4: Polish & Integration
[x] Phase 5: Production hardening (2026-09-10) — deps to latest stable, backend module completion (14 modules), frontend UI/UX refactor, AI agent/skill/workflow tooling, secrets policy (`.env.local` untracked), docs refresh, validation gates green
[x] Migrate mock services to real backend — backend API complete (all routes implemented; connect `VITE_API_URL` to enable)
[ ] Add e2e testing with Playwright/Cypress — Playwright config + `e2e/` scaffold exists; full e2e suite pending (requires seeded DB + running servers)
[ ] Operator actions: rotate exposed secrets, provide production DB credentials, approve PWA PHI cache policy, choose deployment target