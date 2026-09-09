# Testing & Quality Assurance - Smart Health Manager

## 1. Quality Assurance Strategy
Smart Health Manager enforces a multi-layered testing workflow to guarantee application stability, biometric accuracy, security, and zero syntax or build regressions.

```
+-------------------------------------------------------------------+
|                        QUALITY ASSURANCE LOOP                     |
|                                                                   |
|   1. TypeScript Compilation  -->  tsc --noEmit                     |
|   2. Static Code Linting     -->  npm run lint                     |
|   3. Unit & Logic Tests      -->  npm run test (Vitest)          |
|   4. Bundle Compilation      -->  npm run build                    |
|   5. Production Verification -->  compile_applet                  |
+-------------------------------------------------------------------+
```

---

## 2. Test Suites & Frameworks

### 2.1 Static Analysis & Type Checking
- **TypeScript**: Enforces strict typing with zero `any` declarations in clinical paths.
  ```bash
  # Run type verification
  npx tsc --noEmit
  ```
- **ESLint**: Custom rule set checking unused variables, missing React hooks dependencies, and accessibility violations.
  ```bash
  # Run linter
  npm run lint
  ```

---

### 2.2 Unit & Module Tests (Vitest)
Located in `/src/tests/` and `/server/src/tests/`:

#### Key Unit Coverage Targets
1. **Biometric Status Logic (`vitalsService.test.ts`)**:
   - Verifies `computeVitalStatus(145, 92)` returns `'high'`.
   - Verifies `extractRecordAlerts()` correctly detects critical hypoxemia ($\text{SpO2} < 90\%$).
2. **ESI Triage Scoring (`triage.test.ts`)**:
   - Validates that patients with Systolic $\ge 180$ trigger ESI Level 1/2 Emergency category.
3. **Diagnostic Outlier Helper (`DiagnosticHelperBanner.test.tsx`)**:
   - Asserts that abnormal readings render bold red text flags and dispatch stat alert buttons.

```bash
# Execute Vitest test suite
npm run test
```

---

## 3. Pre-Deployment Verification Checklist

```
[x] All TypeScript files compile cleanly with tsc --noEmit
[x] ESLint completes with 0 errors and 0 warnings
[x] Unit tests pass for vitals calculation and triage logic
[x] Recharts components render without layout overflow on mobile viewports
[x] Dark and Light themes render with WCAG AA compliant contrast ratios
[x] PDF exports (Staff Capacity and Patient Vitals) generate without console errors
[x] Production build passes cleanly (vite build && esbuild server.ts)
```
