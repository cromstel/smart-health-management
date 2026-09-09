# Architectural Decision Records (ADRs) - Smart Health Manager

This document records the key architectural decisions, rationale, context, and trade-offs made during the engineering of the Smart Health Manager platform.

---

## ADR-001: Decoupled SPA with Express API Proxy Architecture

### Context
Healthcare applications require strict isolation of API secrets (e.g. database credentials, third-party keys) while delivering an ultra-fast, responsive UI for clinical workflows.

### Decision
Adopt a hybrid full-stack structure featuring a React 19 Single Page Application (SPA) compiled via Vite, paired with a lightweight Node.js Express server (`server.ts`). The Express backend serves as an API proxy for all state-changing endpoints (`/api/*`).

### Consequences
- **Positive**: Zero API key exposure to browser dev tools; centralized middleware for CSRF validation, session cookies, and rate limiting.
- **Negative**: Requires esbuild bundling step (`esbuild server.ts -> dist/server.cjs`) for production container execution.

---

## ADR-002: Client-Side Biometric Analytics & Report Generation Engine

### Context
Clinicians need immediate PDF downloads and interactive charts without waiting for server-side rendering pipelines or headless browser instances (such as Puppeteer).

### Decision
Integrate **Recharts** for interactive responsive charts and **jsPDF + html2canvas** for client-side PDF document generation.

### Consequences
- **Positive**: Zero backend CPU overhead for PDF rendering; instant, offline-capable PDF generation directly in browser memory.
- **Negative**: Bundle size increases slightly (~300KB for PDF libraries); requires careful handling of DOM ref readiness before capture.

---

## ADR-003: ESI (Emergency Severity Index) Triage Calculation Model

### Context
Emergency ward intake requires objective, standardized categorization of incoming patients based on biometric readings.

### Decision
Implement an automated ESI-aligned triage algorithm (`src/utils/triage.ts`) that categorizes vitals into Levels 1–5 based on blood pressure crisis, tachycardia/bradycardia, pyrexia, and hypoxemia parameters.

### Consequences
- **Positive**: Objective, repeatable clinical decision support; clear ward allocation recommendations.
- **Negative**: Algorithmic recommendations must clearly state they supplement, rather than replace, licensed physician judgment.

---

## ADR-004: Encrypted QR Code Intake Payload Strategy

### Context
Rapid emergency room intake requires instant transfer of biometric data and patient identification without requiring physical wires or network shared drives.

### Decision
Implement client-side QR generation (`qrcode` library) encoding structured JSON payloads containing Patient ID, Name, Triage Score, and latest biometric snapshot.

### Consequences
- **Positive**: Fully portable, scannable by any mobile device or tablet camera; works seamlessly during network degradation.
- **Negative**: Payload size limited to under 2KB for optimal QR matrix density and scannability.
