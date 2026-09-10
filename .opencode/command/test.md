---
description: Run the test suite — optional scope argument: "frontend", "backend", "e2e", or a specific file path.
agent: build
---

Run tests for the requested scope:

- `frontend`: `npm test -- --run` (root vitest). Optionally `npm test -- --run <file>` when a specific file is named.
- `backend`: `cd server && npm test -- --run`.
- `e2e`: `npx playwright test` (install browsers first with `npx playwright install` if missing).
- default (no argument): run frontend then backend vitest suites.

Fix failures you introduced; for pre-existing failures, report with evidence (`git stash` test or run on main) and leave them to the maintainers. Report: pass/fail counts and any fixed issues.