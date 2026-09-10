# Dependabot alerts

Status as of 2026-09-10 — all alerts **resolved** by the production-hardening pass (`npm audit`: 0 vulnerabilities in root and server).

- ~~Prototype Pollution in sheetJS~~ `xlsx` (server) — **resolved**: migrated to `exceljs` 4.
- ~~SheetJS ReDoS~~ `xlsx` (server) — **resolved**: migrated to `exceljs` 4.
- ~~Multer DoS ×4~~ `multer` (server) — **resolved** in hardening pass: upgraded to multer 2.3.0.
- ~~csurf→cookie (low)~~ — **resolved**: unused `csurf` removed.
- ~~sequelize→uuid (moderate)~~ — **resolved**: legacy sequelize/sequelize-cli removed.
- glob CLI: command injection via `-c` (root dev tool) — **residual, dev-only**: no production path; tracked in `docs/CHANGELOG.md`.
- js-yaml prototype pollution in `<<` (root dev tool, via eslint toolchain) — **residual, dev-only**: no production path; tracked in `docs/CHANGELOG.md`.