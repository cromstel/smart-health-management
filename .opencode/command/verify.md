---
description: Full validation workflow — lint, type-check, tests, and builds for both frontend and backend. Run before every merge or PR.
agent: build
---

Run the complete SHMS validation gate and fix nothing unless a failure is introduced by an uncommitted change; report blockers:

1. `git status` — confirm a clean-enough working tree (only intended changes).
2. Frontend: `npm run lint`, `npm run type-check`, `npm test -- --run`, `npm run build`.
3. Backend: `cd server && npm run lint`, `npm run build`, `npm test -- --run`.
4. If e2e requested: `npx playwright test`.
5. Summarize: ✓/✗ per step with the exact failing file when red. If something fails that exists on `main` too (pre-existing), report it as pre-existing and do not fix it unless $ARGUMENTS says "fix".