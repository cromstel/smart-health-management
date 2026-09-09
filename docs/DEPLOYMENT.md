# Deployment & Operations Guide - Smart Health Manager

## 1. Runtime Environment & Container Architecture
Smart Health Manager is deployed as a full-stack Cloud Run web application.

- **Ingress Port**: Hardcoded to **Port 3000** behind an Nginx reverse proxy.
- **Node.js Environment**: Node.js 20+ runtime with native TypeScript stripping.
- **Host Binding**: Server binds exclusively to `0.0.0.0:3000`.

---

## 2. Build Pipeline & Production Scripts

### 2.1 Build Command (`package.json`)
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs"
  }
}
```

### 2.2 Compilation Steps
1. **`vite build`**: Compiles the React 19 SPA into static production assets inside `dist/`.
2. **`esbuild server.ts`**: Bundles the Express TypeScript backend into a single CommonJS file (`dist/server.cjs`), eliminating Node ESM runtime module resolution errors and speeding up container boot times.

---

## 3. Environment Variables Configuration

All environment variables must be declared in `.env.example`:

```env
# Server Runtime
NODE_ENV=production
PORT=3000

# Security & Sessions
JWT_SECRET=your_super_secret_jwt_key_here
SESSION_COOKIE_NAME=smart_health_session

# Optional Third-Party Services
GEMINI_API_KEY=your_gemini_api_key_server_side
```

> **CAUTION**: Never prefix server-only secrets with `VITE_`. Server secrets must remain strictly hidden from client bundles.

---

## 4. Health Checks & Monitoring
- **Health Check Endpoint**: `GET /api/health`
  - **Response**: `{"status": "ok", "uptime": 86400, "timestamp": "2026-09-08T12:39:46Z"}`
- **Logging**: Structured JSON logging piped to stdout/stderr for Cloud Logging indexing.
