---
name: frontend-refactor
description: Use when refactoring any React page or component in src/pages or src/components for UI/UX, accessibility, or design-system compliance. Enforces the SHMS design system, NO GRADIENTS rule, shadcn/ui primitives, and zero TypeScript errors.
---

# Frontend Refactor (SHMS)

## Trigger
User asks to improve/refactor a page, restyle UI, fix UX issues, or polish components.

## Design system (must follow)
- Tokens: CSS variables in `src/index.css`. Flat colors ONLY — **NO GRADIENTS, no blur-heavy glassmorphism, no radial/linear-gradient backgrounds**.
- Palette: navy `#001F3F` (primary), sea blue `#0284C7` (accent), neutrals `#F8FAFC`/`#0F172A`, dark mode via `.dark` variant tokens.
- Use existing shadcn/ui components in `src/components/ui/`. Never create new primitives.
- Icons: `lucide-react`. Charts: `recharts`. Motion: `motion` (subtle, respectful of reduced motion).

## Refactor checklist per page
1. Read `src/pages/<Page>.tsx` + any related components/contexts/hooks.
2. Layout & hierarchy: clear headings (h1 once, logical h2/h3), consistent spacing (tailwind scale), aligned grids.
3. States: loading skeletons (use `Skeleton`), empty states with icon + call-to-action, error states with retry.
4. Forms: `react-hook-form` + `zod` via the `Form` component; validation messages; disable submit while pending; both mailto/phone fallbacks where applicable.
5. Tables: sticky headers, responsive overflow, row actions via `DropdownMenu`, pagination when data is large.
6. Accessibility: labels on all inputs, `aria-*` on icon buttons, focus-visible rings, keyboard navigable, WCAG AA contrast.
7. Performance: memoize heavy components; preserve `React.lazy` route splitting in `src/App.tsx`.
8. Dark/light: use tokens only; verify both themes render correctly.

## Validation gate (always run)
- `npm run type-check` → zero errors.
- `npm run lint` → no new warnings/errors from your changes.
- Page/component vitest tests green (`npm test -- --run <file>` or full suite).
- If the app is running in dev, visually confirm the page.

## Report
Per page: changes made, UX decisions, validation results, anything requiring product-owner input.