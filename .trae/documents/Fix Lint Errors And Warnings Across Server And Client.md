## Scope

* Resolve all issues reported in diagnostics for server and client.

* Maintain existing behavior, tests, and project conventions.

* Prefer existing utilities and patterns already in the repo.

## Diagnostics Summary

* Errors (dependency/type):

  1. `server/src/controllers/financial.controller.ts`: Cannot find module `pdfkit` (Line 6) — dependency/import.
  2. `server/src/controllers/financial.controller.ts`: Cannot find module `xlsx` (Line 7) — dependency/import.
  3. `server/src/controllers/financial.controller.ts`: Type error for event callback in `new Promise(resolve => stream.on('finish', resolve))` — signature mismatch.

* Warnings (style/unused):
  4\) `src/contexts/AuthContext.test.tsx`: Unused `React` import.
  5\) `src/pages/PurchaseOrdersPage.tsx`: Unused `Select` import.

## Implementation Plan

### Server: financial.controller.ts

1. Replace direct `pdfkit`/`xlsx` imports with existing formatters:

   * Remove `import PDFDocument from 'pdfkit'` and `import * as XLSX from 'xlsx'`.

   * Add `import { buildPDF } from '../services/reportFormatters/pdf.js'` and `import { buildXlsx } from '../services/reportFormatters/xlsx.js'`.

   * This matches the pattern used in `pharmacy.controller.ts` and avoids module resolution issues at the controller layer.
2. Keep the existing URL-based export contract to preserve tests and behavior:

   * `exportPdf`: build a `PDFDocument` via `buildPDF(...)`, pipe to `fs.createWriteStream(filePath)`, `doc.end()`, `await` stream finish with `() => resolve()` and return `{ url: '/uploads/<file>' }`.

   * `exportExcel`: build an XLSX `Buffer` via `buildXlsx(...)`, write to file with `fs.promises.writeFile(filePath, buf)`, then return `{ url: '/uploads/<file>' }`.

   * Choose exported rows from `generateReport` result (`income`, `expenses`, `assets`, `liabilities`, `daily`) based on `reportType`.
3. Fix the Promise callback type error:

   * Change `await new Promise(resolve => stream.on('finish', resolve))` to `await new Promise<void>(resolve => stream.on('finish', () => resolve()))`.
4. Remove stray top-level statement at end of file (line \~451) that references `logAudit` using undefined identifiers; it is unreachable and unsafe.
5. Ensure `uploads` dir creation is retained (`fs.promises.mkdir(..., { recursive: true })`).

### Server: dependencies

1. Confirm required server deps are installed (already declared):

   * `pdfkit` (deps) and `@types/pdfkit` (devDeps) exist.

   * `xlsx` exists.

   * Run install in `server/` to ensure `node_modules` present.

### Client: AuthContext.test.tsx

1. Remove unused `import React from 'react'` (TS config uses `jsx: 'react-jsx'`).

### Client: PurchaseOrdersPage.tsx

1. Remove unused `import { Select } from '@/components/ui/select'`.

## Verification

* Server:

  * `cd server && npm ci` (or `npm install`) to ensure deps.

  * `npm run build` to type-check with strict TS settings.

  * Run server tests: `npm run test`.

* Client:

  * Root tests: `npm run test -- --run` to catch unused imports via TS flags.

* Confirm no errors and no remaining warnings.

## Change Log To Produce

* `server/src/controllers/financial.controller.ts`:

  * Replaced `pdfkit`/`xlsx` imports with `buildPDF`/`buildXlsx` services.

  * Fixed stream finish Promise signature.

  * Wrote PDF via `buildPDF` → file stream; wrote XLSX via buffer.

  * Selected correct dataset from `generateReport` result for export; preserved URL response shape.

  * Removed stray unreachable `await logAudit(...)` statement.

* `src/contexts/AuthContext.test.tsx`:

  * Removed unused `React` import.

* `src/pages/PurchaseOrdersPage.tsx`:

  * Removed unused `Select` import.

## Notes

* No warnings are intentionally kept; all are removed.

* Behavior of financial exports remains URL-based to satisfy existing tests.

* All changes follow strict TS, project path aliases, and server’s ESM config.

