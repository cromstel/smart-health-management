/**
 * Application name — the single source of truth for the product name.
 *
 * Why this module exists
 * ----------------------
 * The product name used to be spelled out as a literal in dozens of places
 * across the frontend, the backend, the PWA manifest and the HTML shell. That
 * made re-branding a code change, and it let the name drift between the page
 * title, the installable manifest, the emailed invoices and the screens.
 * Everything now resolves the name from configuration through the constant
 * exported here.
 *
 * Resolution order
 * ----------------
 *   1. `VITE_APP_NAME` — the operator's switch, supplied by the environment
 *      (`.env`, `.env.local`, or the shell). Vite exposes every `VITE_`-prefixed
 *      variable on `import.meta.env`, which is where the browser bundle reads
 *      it. Node-side consumers (the Playwright suite, tooling) read the same
 *      variable from `process.env`.
 *   2. `DEFAULT_APP_NAME` — the shipped name, used only when the variable is
 *      unset, so a fresh clone still boots and renders.
 *
 * The optional chains are deliberate rather than defensive noise: this module
 * is also evaluated outside a browser bundle (the Vite config bundle, Node
 * tooling, the Playwright suite), where `import.meta.env` does not exist, and
 * `process` does not exist in the browser.
 */

/** The shipped product name — the one place in the frontend where it is written down. */
export const DEFAULT_APP_NAME = 'Smart MediCare';

/** The shared resolution rule: a configured name, trimmed, or the shipped one. */
export const resolveAppName = (value: string | null | undefined): string =>
  (value ?? '').trim() || DEFAULT_APP_NAME;

/** Reads the configured name from whichever environment the caller runs in. */
const readConfiguredName = (): string | undefined => {
  // Browser bundle (and Vitest): Vite resolves `import.meta.env` for us.
  const viteName = import.meta.env?.VITE_APP_NAME;
  if (viteName) return viteName;

  // Node: the Vite config bundle, the Playwright suite, scripts. `process` is
  // not defined in a browser at all, so the guard is load-bearing.
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_APP_NAME;
  }

  return undefined;
};

/** The configured application name, e.g. `Smart MediCare`. */
export const APP_NAME: string = resolveAppName(readConfiguredName());

/** The application name with whitespace removed, e.g. `SmartMediCare`. */
export const APP_NAME_SLUG: string = APP_NAME.replace(/\s+/g, '');
