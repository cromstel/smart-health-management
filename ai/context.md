# AI Context

Smart Health Management System (SHMS) — enterprise healthcare platform by Cromstel IT Group.

- **Frontend**: React 19 + TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui, React Router v7, Recharts, motion, PWA (vite-plugin-pwa). Dark navy design system (`#001F3F` primary, `#0284C7` accent).
- **Backend**: Node.js + Express (ESM, TS via tsx), MySQL 2 pool, JWT auth + RBAC, helmet, rate limiting, express-validator, bcryptjs, nodemailer, cron backups/inventory.
- **Modules**: patients, appointments, staff, hospitals, pharmacy & inventory, purchase orders, prescription fulfillment, financials, documents (local/Drive/OneDrive), clinical AI (Gemini), super-admin, RBAC roles, audit logs.
- **Docs**: `AGENTS.md` (rules), `ai/` (AI memory), `docs/` (API/ARCHITECTURE/DATABASE/DEPLOYMENT/SECURITY/TESTING/CHANGELOG), `DOCUMENTATION.md` (master guide).
- **Tooling**: opencode agents/skills/workflows in `.opencode/`; vitest (FE + BE); Playwright e2e in `e2e/`.