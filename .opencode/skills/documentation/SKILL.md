---
name: documentation
description: Use when creating or updating SHMS documentation, AI memory (ai/*.md), AGENTS.md, README, docs/ guides, or todo/checklist. Keeps docs truthful and in sync with the code.
---

# Documentation & AI Memory (SHMS)

## Trigger
User asks to write/update docs, README, changelog, ai memory, project rules, or status checklists.

## Map
- `AGENTS.md` — canonical rules for AI agents (architecture, conventions, validation gates). Change only when rules change.
- `ai/context.md` — one-paragraph project summary + tech stack.
- `ai/agents.md` — list of available project agents and their roles.
- `ai/skills.md` — list of project skills and triggers.
- `ai/memory.md` — the standing constraints: NO GRADIENTS, zero unresolved TypeScript errors, mandatory docs, design tokens, auth/DB caution.
- `ai/scratchpad.md` — transient work notes; keep current session's state, clear stale entries.
- `docs/` — API, ARCHITECTURE, CHANGELOG, DATABASE, DECISIONS, DEPLOYMENT, IMPLEMENTATION, PRD, SECURITY, TESTING, TROUBLESHOOTING.
- `DOCUMENTATION.md`, `README.md` — public entry points (links, quick-start, status).

## Rules
- Verify against code: check `server/src/routes/` before documenting endpoints; check package.json scripts before documenting commands; check `.env.example` before documenting env vars.
- Update `docs/CHANGELOG.md` with dated entries for significant changes.
- Never fabricate features or credentials. Status tables must reflect reality (e.g., mark DB-dependent items as Pending until verified).
- Run `git status`/`git log --oneline -5` first to know what actually changed.