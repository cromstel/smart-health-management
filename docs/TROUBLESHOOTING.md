# Troubleshooting & Operational FAQ - Smart Health Manager

## 1. Frequently Encountered Issues & Recipes

### 1.1 Benign WebSocket HMR Warnings
- **Symptom**: Console logs error `[vite] failed to connect to websocket`.
- **Cause**: Platform sets `DISABLE_HMR=true` to prevent preview flickering during AI edits.
- **Solution**: No action required. This error is benign and does not impact application functionality or preview rendering.

---

### 1.2 "Port 3000 Already in Use" or Server Connection Failure
- **Symptom**: App fails to respond on container ingress.
- **Cause**: Server script attempt to bind to a non-standard port (e.g. 5173, 3001) or `127.0.0.1` instead of `0.0.0.0`.
- **Solution**: Ensure `server.ts` uses:
  ```typescript
  app.listen(3000, "0.0.0.0", () => {
    console.log("Server listening on port 3000");
  });
  ```
  Then invoke `restart_dev_server`.

---

### 1.3 TypeScript Module Resolution Error (`Cannot find module '@/types/vitals'`)
- **Symptom**: Compiler throws TS2307 on `@/` imports.
- **Cause**: `tsconfig.json` path alias configuration out of sync with Vite alias config.
- **Solution**: Verify `tsconfig.json` includes:
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"]
      }
    }
  }
  ```

---

### 1.4 SDK Crashing App on Startup Due to Missing API Keys
- **Symptom**: Dev server displays "Please wait while your application starts..." indefinitely.
- **Cause**: Top-level eager SDK initialization failing when environment variables are missing.
- **Solution**: Use **Lazy Initialization**:
  ```typescript
  let client: GenAI | null = null;
  export function getGenAIClient() {
    if (!client) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY is not configured.");
      client = new GoogleGenAI({ apiKey: key });
    }
    return client;
  }
  ```

---

### 1.5 PDF Generation Blank Output or Cut-off Images
- **Symptom**: `Export PDF` downloads a blank or improperly scaled document.
- **Cause**: Attempting to capture unrendered DOM elements or dynamic canvas before layout completes.
- **Solution**: Use `html2canvas` with `scale: 2` and wrap target refs inside `useRef` hooks with an explicit timeout or ready callback.

---

### 1.6 Recharts Layout Distortion on Resize
- **Symptom**: Charts overflow outside card boundaries on window resize.
- **Cause**: Using fixed pixel widths instead of dynamic containers.
- **Solution**: Always wrap charts inside `<ResponsiveContainer width="100%" height={300}>`.
