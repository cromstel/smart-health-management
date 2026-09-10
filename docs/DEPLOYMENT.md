# Deployment & Operations Guide — Smart Health Management System (SHMS)

Canonical production deployment reference. Read `AGENTS.md` §6 (environment setup) and `docs/API.md` for endpoint details.

## 1. Architecture at a glance
- **Frontend**: Vite + React SPA. `npm run build` emits static assets to `dist/` (PWA-enabled via `vite-plugin-pwa`).
- **Backend**: Express 5 API in `server/`. `cd server && npm run build` (tsc) emits `server/dist/` (ESM). Dev uses `tsx watch`.
- **Database**: MySQL 8.x. Schema + seed are declarative: `server/src/database/schema.sql` + `seed.sql`. Managed locally via `npm run db:setup` (server).
- No Dockerfile or PaaS manifests are committed; any target hosting these two Node processes + MySQL works.

## 2. Recommended topology — single Linux VPS (or container)
```
Internet → Nginx (:443, TLS/Let's Encrypt)
           ├── /            → Vite SPA (dist/ static files, SPA fallback to index.html)
           ├── /assets/*    → static (immutable, long cache)
           ├── /api/*       → proxy_pass http://127.0.0.1:5000
           └── /healthz     → proxy_pass (uptime checks)
Node (PM2)  → server/dist/index.js, PORT=5000 (restrict :5000 to loopback via firewall; Nginx proxies)
MySQL 8     → 127.0.0.1:3306 (bind local; TLS via DB_SSL=true when remote)
Cron        → built-in backup job (server/src/jobs/backup.job.ts) writes backups/ (gitignored; copy offsite)
```

### 2.1 PM2 ecosystem example
```json
{
  "apps": [{
    "name": "shms-api",
    "cwd": "/opt/shms/server",
    "script": "dist/index.js",
    "instances": 1,
    "env": { "NODE_ENV": "production", "PORT": "5000", "FRONTEND_URL": "https://health.example.com" }
  }]
}
```
Run: `pm2 start ecosystem.config.json && pm2 save && pm2 startup`.

### 2.2 Nginx snippet
```nginx
server {
  listen 443 ssl http2;
  server_name health.example.com;
  ssl_certificate     /etc/letsencrypt/live/health.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/health.example.com/privkey.pem;

  root /opt/shms/dist;
  location /assets/ { try_files $uri =404; expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri /index.html; }

  location /api/ { proxy_pass http://127.0.0.1:5000; proxy_http_version 1.1; proxy_set_header X-Forwarded-Proto $scheme; }
  location /healthz { proxy_pass http://127.0.0.1:5000/api/health; }
}
```
TLS: `certbot --nginx -d health.example.com`.

## 3. Environment variables (production REQUIRED)
The server **fails fast at startup** in `production` when any of these are missing (see `server/src/config/env.ts`):
- `NODE_ENV=production`, `PORT`, `FRONTEND_URL`
- `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` (32-byte hex), `ENCRYPTION_IV` (16-byte hex)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` (**no hardcoded fallback exists**), `DB_NAME`, `DB_SSL=true` for TLS
- Third-party keys only if the features are used: `STRIPE_SECRET_KEY`, `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`PHONE_NUMBER`, `SMTP_*`, `GEMINI_API_KEY`, `GOOGLE_DRIVE_*`, `ONEDRIVE_*`
- Optional: `ADMIN_EMAIL`/`ADMIN_PHONE` (batch-recall alerts; skipped when unset), `BACKUP_CRON`, `BACKUP_RETENTION_DAYS`

> Never prefix server-only secrets with `VITE_`. Only `VITE_*` values reach the browser bundle.

## 4. Deployment steps (fresh VPS)
1. `git clone` + `npm ci` (root) + `cd server && npm ci`.
2. Build: root `npm run build`; `cd server && npm run build`.
3. Provision DB: `mysql < server/src/database/schema.sql`, then `seed.sql` (or `npm run db:setup` with dev MySQL creds in env).
4. Configure `server/.env` (or PM2 env) per §3. Generate secrets with `openssl rand -hex 32` / `-hex 16`.
5. Serve `dist/` + proxy `/api` per §2.2; start API via PM2.
6. Health check: `curl https://health.example.com/api/health` → `{"status":"ok",...}`.
7. Enable backups: default cron `0 3 * * *` (env `BACKUP_CRON`); back up `backups/` offsite.

## 5. Data safety & compliance notes
- PHI policy: the PWA service worker uses `NetworkOnly` for `/api/patients` — patient data is never written to browser caches (decision 2026-09-10).
- DB dumps (including the legacy tracked `backups/` dump) are gitignored; never commit them.
- Restore is available to super-admins via the UI (server → `superAdmin.controller.ts`); filenames are validated against path traversal.
- All DB passwords flow via `MYSQL_PWD` in backup/restore tooling — never in process lists.

## 6. Alternatives
- **Render / Railway / Cloud Run**: deploy API (Node, `npm start`, port 5000) + static site (output `dist/`) + managed MySQL; keep the same env contract.
- **cPanel/VPS without Nginx auth**: acceptable when TLS + reverse proxy are provided by the host; keep `DB_SSL=true` for remote MySQL.