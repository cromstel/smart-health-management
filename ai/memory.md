# AI Memory

Project enforces strict adherence to **NO GRADIENTS**, **zero unresolved TypeScript errors**, and **mandatory documentation** (every feature, endpoint, or decision updates `docs/CHANGELOG.md` at minimum; convention changes update this file and `ai/agents.md`/`ai/skills.md`).

## Environment & validation

- **Run validation gates sequentially, never in parallel on this dev machine.** The box has ~15.8 GB RAM total but only ~2.3 GB free with normal workloads; running the frontend build and backend test suite at the same time exhausts memory and OOMs Node ("Zone Allocation failed" / "memory allocation failed" / "VirtualAlloc failed" from `rolldown`/vite or vitest workers).
- Use the standard entry points: root `npm run verify` (lint → type-check → vitest --run → `tsc -b` + vite build) and `server npm run verify` (lint → tsc build → vitest --run). These are intentionally sequential.
- If a single command still OOMs, raise the heap explicitly: `$env:NODE_OPTIONS="--max-old-space-size=2048"` before the command (Windows PowerShell). Do not raise it when other heavy processes are active.
- Known pre-existing environment facts: backend tests show 6 skipped tests tied to the local MySQL `auth_gssapi_client` plugin; frontend suite is 21 passed / 1 skipped. These are environmental, not regressions.