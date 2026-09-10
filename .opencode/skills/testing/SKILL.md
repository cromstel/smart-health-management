---
name: testing
description: Use when writing or running SHMS tests — frontend vitest, backend vitest, or Playwright e2e. Covers conventions, fixture/mock patterns, and the exact commands to validate each layer.
---

# Testing (SHMS)

## Layers & commands
- Frontend unit/integration: vitest, `npm test` (watch) / `npm test -- --run` (CI). Config: `vitest.config.ts`, `vitest.workspace.ts`, `src/setupTests.ts` (jest-dom).
- Backend: vitest in `server/`, `cd server && npm test -- --run`. Tests in `server/src/tests/`.
- E2E: Playwright (`playwright.config.ts`, `e2e/`). Run with `npx playwright test`.
- Coverage variants exist (`@vitest/coverage-v8`, jest+ts-jest) — note both were historically present; vitest is the active runner.

## Frontend conventions
- Co-locate or mirror tests: `src/pages/*.test.tsx`, `src/components/ui/*.test.tsx`.
- Use `@testing-library/react` + `user-event`; assert appearance/behavior, not implementation.
- Mock API calls via the service layer or `src/server/mockApi.ts` handlers.
- Keep tests deterministic: no real timers/network unless wrapped in fake timers.

## Backend conventions
- Unit tests mock the `mysql2/promise` pool (the exported default from `config/database.ts`).
- Integration tests in `server/src/tests/*.integration.test.ts` may bootstrap the Express app; mark them so they can be skipped without a DB.

## Gate
Tests must pass before any merge. If a test fails after a refactor, update the test to reflect intended behavior — never delete coverage to make CI green.