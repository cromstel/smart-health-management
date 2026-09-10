# AI Agents

Project agents (opencode, `.opencode/agent/`):

| Agent | Mode | Role |
|---|---|---|
| `build` | primary (default) | Plans, coordinates subagents, integrates and validates all work |
| `frontend` | subagent | React/TS UI/UX refactors; enforces design system, NO GRADIENTS, zero type errors |
| `backend` | subagent | Express/MySQL modules: routes → controllers → services, tests |
| `review` | subagent | Read-only code review against project rules (no edits) |
| `docs` | subagent | Documentation + ai/* memory maintenance |
| `dependencies` | subagent | Dependency upgrades to latest stable + validation |
| `security` | subagent | Read-only security audits; escalates secrets/infra decisions to humans |

The primary `build` agent owns planning and final integration. Subagents never edit files concurrently with each other without build-agent coordination. Security-sensitive operations always escalate to the human operator (see AGENTS.md §8).