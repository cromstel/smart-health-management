## Dependencies
- Add `xlsx` and `pdfkit` to server dependencies; add `@types/pdfkit` to dev dependencies.
- Implement lazy imports with try/catch to surface clear errors if libraries fail to load.
- Validate types with TypeScript — create minimal type wrappers if needed for workbook/worksheet and PDF document.

## Report Generation (Controller Enhancements)
- Extend `server/src/controllers/pharmacy.controller.ts` `generatePharmacyReport` to support binary outputs:
  - XLSX: build workbook/sheet using `xlsx`; write headers, auto-width columns, number/date formatting, freeze header row.
  - PDF: build styled table using `pdfkit`; include title, page footer with page numbers, table headers, and row wrapping; add metadata (title, author, subject).
- Content negotiation:
  - Prefer `Accept` header (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `application/pdf`).
  - Fallback to `?format=xlsx|pdf|csv|json` when `Accept` is generic.
- Response headers:
  - XLSX → `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="pharmacy_<reportType>.xlsx"`.
  - PDF → `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="pharmacy_<reportType>.pdf"`.
- Streaming:
  - XLSX: generate workbook to buffer via `xlsx.write` or stream; handle large datasets.
  - PDF: stream `pdfkit` output to response; backpressure-aware piping.
- Error handling:
  - Guard empty datasets; still produce valid empty XLSX/PDF with headers.
  - Wrap generation in try/catch and return `500` with structured error payload when failures occur.

## Prescription Validation (Drug Interactions)
- Data model:
  - Create `contraindications` table with columns: `id`, `category_a`, `category_b`, `severity` (enum: `high`, `medium`, `low`), `description`.
  - Seed common interactions (e.g., `anticoagulants` × `NSAIDs` → `high`).
- Validation service:
  - Build `server/src/services/drugInteractions.service.ts` exposing:
    - `getInteractionsForCategory(category)` → list of rules.
    - `validatePrescription({ patient_id, medicine_category })` → checks:
      - Current active prescriptions for patient against new medicine category.
      - Severity aggregation; returns warnings or blocking errors for `high` severity.
- Controller integration:
  - In `server/src/controllers/prescription.controller.ts` `createPrescription` and `updatePrescription`:
    - Lookup medicine category from `medicines_inventory`.
    - Call validation; on `high` severity conflicts → 400 with detail; on `medium/low` → 200 with `warnings` embedded or require override flag.
- Audit logging:
  - Log detected interactions with severity in `audit_logs`.

## Tests
- Unit tests (validation):
  - Detect basic single interaction.
  - Multiple simultaneous interactions — confirm severities prioritized and aggregated.
  - Severity classification correctness (high blocks, medium warns, low informs).
  - Clear error messaging structure (code, message, conflicting_categories).
- Integration tests (reports):
  - XLSX generation: correct `Content-Type`, non-empty buffer, header row formatting, numeric/date cells typed.
  - PDF generation: correct `Content-Type`, metadata present, page break behavior on large data.
- Performance:
  - Generate reports with 10k rows; assert completion under threshold (e.g., < 3s in test env), and memory not exceeding guardrails.
- Error handling:
  - Malformed inputs (invalid `reportType`, unknown categories); verify 400/422 and helpful messages.

## Implementation Outline (Files)
- `server/src/controllers/pharmacy.controller.ts`: add Accept negotiation and binary output branches; refactor shared query → formatter inputs.
- `server/src/services/reportFormatters/xlsx.ts`: sheet builder for headers, cell types, widths, freeze panes.
- `server/src/services/reportFormatters/pdf.ts`: pdf builder for table formatting, pagination, metadata.
- `server/src/services/drugInteractions.service.ts`: interaction lookup and validator.
- `server/src/database/schema.sql`: add `contraindications` table and seed script.
- `server/src/tests/`:
  - `pharmacyReportsExport.integration.test.ts` (XLSX/PDF).
  - `drugInteractions.unit.test.ts` (rules & severities).
  - `drugInteractions.integration.test.ts` (controller create/update flows).
  - Performance-focused test (skipped by default, enabled in CI perf stage).

## Quality Assurance & CI
- Add test suites to server `npm run test`; tag performance tests to run under perf profile.
- Ensure coverage thresholds updated to include new files.
- Lint rules: no console logs in production paths; proper error codes (400/422/500) and JSON error bodies.

## Documentation
- API docs:
  - Update `/api/pharmacy/reports` to detail Accept header and `format` parameter, content types, filenames, and sample requests.
- Validation docs:
  - Document categories and contraindications; severity semantics and override policy.
  - Provide examples for creation/update endpoints showing warning and blocking responses.
- Developer notes:
  - Usage patterns for `xlsx`/`pdfkit`, streaming considerations, and large dataset guidance.

## Rollout Plan
- Ship behind a feature flag for PDF initially (`ENABLE_PHARMACY_PDF=true`).
- Backward compatible: keep CSV/JSON behavior unchanged.
- Monitoring: log generation duration and size; alert on errors.

## Acceptance Criteria
- Pharmacy reports endpoint returns valid XLSX/PDF with correct headers and formatting.
- Prescription creation/update blocks `high` severity interactions; warns on `medium`; informs on `low`.
- Tests cover happy paths, edge cases, error conditions, performance bounds, and security validations.