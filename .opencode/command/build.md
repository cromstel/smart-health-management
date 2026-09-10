---
description: Production build for frontend (Vite) or backend (tsc), e.g. /build, /build server.
agent: build
---

Build the requested target:

- `frontend` (default): `npm run build` (runs `tsc -b && vite build`).
- `server` / `backend`: `cd server && npm run build`.

If TypeScript errors appear, fix only those caused by recent changes; otherwise report them as pre-existing with evidence. Confirm the output folder (`dist/` or `server/dist/`) and report any warnings.