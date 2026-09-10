---
name: backend-api
description: Use when implementing or modifying SHMS backend modules — routes, controllers, services, middleware, schema, or API tests under server/src. Enforces the layered Express architecture and validation/test requirements.
---

# Backend API Work (SHMS)

## Trigger
User asks to add/fix an API endpoint, backend service, middleware, schema change, or server test.

## Architecture rules
- `routes/` = URL mapping only. `controllers/` = input validation + orchestration. `services/` = business logic. `database/` = schema.sql / seed.sql.
- ES modules + TypeScript. Config from env via `config/database.ts` style patterns (dotenv).
- Auth: `middleware/auth.ts` (`requireAuth`, `requirePermission`). Apply to every protected route.
- Validation: `express-validator` in controllers; never trust raw `req.body`.
- Queries: parameterized `mysql2/promise` only — never string-concatenated SQL.
- Errors: consistent JSON `{ error: string }` responses with proper status codes; no stack traces in production.

## Test requirement
- Every new/modified endpoint needs a test in `server/src/tests/` (vitest).
- Mock `pool`/DB or use the existing test conventions in `server/src/tests/`.

## Validation gate
- `cd server && npm run lint`
- `cd server && npm run build` (tsc, zero errors)
- `cd server && npm test -- --run`

## Report
Endpoint list changed, test coverage added, DB/migration notes, validation results.