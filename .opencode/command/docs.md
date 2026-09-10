---
description: Update documentation and AI memory to match the current code state. Optionally pass a focus area, e.g. /docs API.
agent: docs
---

Review recent changes (`git status`, `git diff --stat`, `git log --oneline -5`) and update all affected documentation:

1. `docs/CHANGELOG.md` — dated entry describing the change.
2. Endpoint docs in `docs/API.md` if routes changed; verify against `server/src/routes/`.
3. `README.md` / `DOCUMENTATION.md` — status tables, commands, links.
4. `ai/memory.md`, `ai/context.md`, `ai/agents.md`, `ai/skills.md`, `ai/scratchpad.md` — reflect new agents/skills/workflow conventions and any rule changes.
5. `todo/checklist.md` — mark completed phases; add next steps.

Focus area `$ARGUMENTS` (api|architecture|database|deployment|security|testing|readme|memory) restricts the update to that doc set. Verify claims against code. Report files changed + diff summaries.