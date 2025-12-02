## Pending Tasks (Phase 7)
- Backend API integration
- Actual transaction processing
- Billing module
- Invoice generation
- Payment processing
- Expense tracking
- Salary management
- Tax calculations
- Financial forecasting
- Cash flow reports
- Profit & Loss reports
- PDF export implementation
- Excel export implementation
- Audit trail implementation

## Backend Data Model
- Create finance tables: `chart_of_accounts` (hierarchy, types, balances), `transactions` (ledger with debit/credit, reference), `expenses`, `invoices`, `invoice_items`, `payments`, `payroll`, `tax_rules`, `forecasts`, and reuse `audit_logs`.
- Resolve naming mismatch: align controllers and schema (`chart_of_accounts` vs `accounts`, `transaction_date` vs `date`).
- Add indexes on common filters: dates, account_id, invoice_id, user_id.

## API Surface
- Accounts: `GET/POST/PUT/DELETE /api/financial/accounts` with validation, hierarchy rules, balance recompute triggers.
- Transactions: `GET/POST/PUT/DELETE /api/financial/transactions` with atomic writes and account balance updates.
- Reports: `GET /api/financial/reports?type=balance_sheet|income_statement|cash_flow&range=...` returning computed aggregates.
- Billing: `POST/GET /api/financial/invoices`, `POST /api/financial/invoices/:id/items`, `POST /api/financial/invoices/:id/finalize`.
- Payments: `POST/GET /api/financial/payments`, link to invoices and ledger entries.
- Expenses: `POST/GET /api/financial/expenses`, categorize and post to ledger.
- Salary: `POST/GET /api/financial/payroll`, generate payslips and ledger entries.
- Tax: `GET/POST /api/financial/tax-rules`, `POST /api/financial/tax/calculate`.
- Forecasting: `GET /api/financial/forecast?model=simple|moving_avg`.
- Exports: `GET /api/financial/export/pdf`, `GET /api/financial/export/excel` for reports and invoices.
- Audit: write to `audit_logs` on create/update/delete across finance endpoints.

## Transaction Engine
- Implement double-entry postings where applicable; validate debit+credit consistency and account type constraints.
- Use database transactions to ensure atomicity; rollback on failure.
- Compute running balances; store normalized values and derive aggregates on read.

## Permissions & Security
- Unify permission module key (`financial`): update seed if needed; enforce `requirePermission` per route.
- Input validation: schema-based validation (e.g., zod/joi) on all endpoints.
- Prevent overposting; whitelist fields; sanitize strings.

## Reports Computation
- Balance Sheet: group assets/liabilities; totals and period snapshots.
- Income Statement: revenue vs expenses; net profit computation.
- Cash Flow: operating, investing, financing flows mapped from ledger.
- API returns structured JSON and supports date ranges.

## Export Implementations
- PDF: server-side templating for Balance Sheet, Income Statement, Cash Flow, and Invoice documents; match frontend export UI hooks.
- Excel: generate `.xlsx` with worksheets per report; include summary sheet.

## Billing & Invoices
- Invoice model: header (customer/patient, dates, status), items (service/drug, qty, price, tax), totals.
- Finalization posts to ledger and locks edits; payments reduce receivables.

## Expenses & Payroll
- Expense categories and vendor linkage; ledger postings to expense accounts.
- Payroll cycles: fetch staff, compute gross/net with deductions; post salary expenses and liabilities.

## Tax & Forecasting
- Tax rules CRUD; calculation endpoint returning liability per period.
- Forecasting: simple moving averages over income/expense to predict next N periods.

## Testing Strategy
- Unit tests: controllers/services for accounts, transactions, reports, billing, payments, expenses, payroll, tax, export.
- Integration tests: route-level with seeded data; verify balances, report aggregates, export file generation.
- Security tests: permission gating, validation failures, audit log entries.

## Frontend Wiring
- Point `FinancialPage` data loaders to `/api/financial/*` endpoints; remove mocks.
- Hook export buttons to new export endpoints; display server-generated PDFs/Excels.

## Documentation & Checklist Updates
- After each task completion, update Phase 7 checklist lines 244–258: mark `[x]`, include date/time and responsible party.
- Preserve formatting and section structure; verify readability.

## Milestones
- Phase A: Schema alignment and core accounts/transactions APIs
- Phase B: Reports computation and exports
- Phase C: Billing + payments + expenses
- Phase D: Payroll + tax + forecasting
- Phase E: Audit trail integration and full test coverage

## Verification
- Run backend test suite; ensure coverage for finance modules.
- Manual API checks with date-range scenarios; validate permission enforcement.
- Open frontend and verify FinancialPage workflows against live backend.

Please confirm to proceed with implementing the above, executing each pending task, adding tests, and updating the checklist accordingly.