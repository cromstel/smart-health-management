## Objective
- Resolve server-side variable warnings and align ESLint configs
- Implement hospital-based permission scoping (backend + frontend)
- Add unit tests for new permission logic
- Update documentation and checklist

## 1) Variable Correction (Server)
- Audit controllers/middleware/services for unused or undefined variables
  - Files to inspect first: `server/src/middleware/auth.ts`, `server/src/controllers/auth.controller.ts`, `server/src/controllers/*.ts`
- Standardize catch blocks and unused vars
  - Rename unused variables to `_error` or remove identifiers entirely if not needed
  - Ensure all dependencies are properly imported (`pool`, `jwt`, `uuid`, etc.) and remove stale imports
- Eliminate circular dependencies
  - Verify `AuthRequest` type only declared in `middleware/auth.ts` and imported where used
  - Confirm controllers do not import each other; extract shared helpers to `server/src/utils/*` when needed

## 2) ESLint Configuration Alignment
- Use root `eslint.config.js` to lint server TS files consistently
  - Confirm it applies to `server/src/**/*.ts` and only ignores `server/**/*.js` and `server/dist/**`
- Add/verify parser options for server (TypeScript parser already present)
- Ensure `@typescript-eslint/no-unused-vars` uses `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }`
- Optional: add server-specific `tsconfig.json` references if needed for path resolution
- Run `npm run lint` and verify warnings resolved after variable cleanup

## 3) Hospital-Based Permissions (Backend)
- Extend `requirePermission(module, action)` to optionally enforce hospital scoping
  - Add signature: `requirePermission(module, action, opts?: { requireHospitalMatch?: boolean, hospitalSource?: 'params.hospitalId' | 'query.hospital' | 'body.hospitalId' })`
  - Resolve hospital id from the request using `hospitalSource` and fallback to `req.user.hospital_id`
  - Enforce rules:
    - Super Admin bypass: if role/module has `all:{action}` → allow
    - If `requireHospitalMatch`:
      - If `req.user.hospital_id` missing → 403 with structured error
      - If resolved hospital id mismatches user's hospital → 403
- Apply middleware to relevant routes (Patients, Staff, Appointments, Purchase Orders) where hospital context exists

## 4) Hospital-Based Permissions (Frontend)
- Enhance `AuthContext` with hospital-aware checks
  - Add `canActOnHospital(hospitalId: string): boolean` returning true if:
    - `user.permissions` includes `all:view`/`all:edit` OR
    - `user.hospital_id` equals provided `hospitalId`
- Use in UI components to disable edit/delete when hospital mismatch
  - Pages: Patients, Staff, Appointments, Purchase Orders
  - Keep existing `hasPermission('module:action')` and combine with `canActOnHospital()` where applicable
- Tooltip messaging for hospital-scoped denials and consistent audit logging via `AuditContext`

## 5) Testing
- Server unit tests (Vitest)
  - `server/src/tests/middleware/requirePermission.test.ts`
    - Cases: `all:{action}` permit; hospital match pass; mismatch fail; missing `hospital_id` fail
  - Mock `req.user` and `pool.query` with stubs
- Client unit tests (Vitest + RTL)
  - `src/__tests__/authContext.test.tsx` ensure `canActOnHospital()` logic
  - Page component tests verify disabled states when permission/hospital mismatch
- CI step: run `npm run lint`, `npm run type-check`, `npm --prefix server run build`

## 6) Documentation
- Update API docs to describe hospital-scoped permission rules and error responses
- Update `src/docs/IMPLEMENTATION_CHECKLIST.md`
  - Mark “Hospital-based permissions” as completed or in progress depending on scope applied
  - Note new client helper `canActOnHospital()`
- No new files; update existing docs only

## Execution Order
1. Server variable cleanup (controllers + middleware)
2. ESLint alignment and verification
3. Implement hospital scope in `requirePermission`
4. Update server routes to use hospital-scoped middleware
5. Frontend: add `canActOnHospital()` and apply gating
6. Add unit tests (server + client)
7. Run lint/type-check/build and fix any findings
8. Update docs and checklist

## Acceptance
- `npm run lint` shows 0 errors and no server unused-var warnings
- Hospital-based scoping enforced in backend and reflected in frontend gating
- Tests cover core permission paths and pass
- Documentation reflects the updated architecture