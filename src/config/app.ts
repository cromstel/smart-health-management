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

/**
 * The shared resolution rule: a configured name, trimmed, or nothing.
 *
 * There is no product name written into the source. The name is a fact about
 * the deployment — it is what the browser tab says, what the installable
 * application is called, and what the emails, the calendar invitations and
 * the reports call the platform — so it comes from the environment and
 * nothing else.
 */
export const resolveAppName = (value: string | null | undefined): string =>
  (value ?? '').trim();

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

/**
 * The configured application name.
 *
 * It is required. A production build refuses to run without it, so a bundle
 * can never carry a name that was baked into the source, and a missing one
 * fails with a message that says which variable to set rather than rendering
 * an unnamed product.
 */
export const APP_NAME: string = (() => {
  const configured = resolveAppName(readConfiguredName());
  if (configured) return configured;
  throw new Error(
    'The application name is not configured. Set VITE_APP_NAME in the environment.'
  );
})();

/** The application name with whitespace removed, for use in a file name or an identifier. */
export const APP_NAME_SLUG: string = APP_NAME.replace(/\s+/g, '');

/**
 * Where the application is published.
 *
 * Read from the environment, so the addresses written into a calendar
 * invitation and shown in the interface follow the deployment rather than a
 * host name written into the source. Falls back to the address the browser is
 * actually on, which is the same origin in every deployment behind one host.
 */
const readConfiguredBaseUrl = (): string | undefined => {
  const viteUrl = import.meta.env?.VITE_BASE_URL;
  if (viteUrl) return viteUrl;

  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_BASE_URL;
  }

  return undefined;
};

/** The published address of the application, without a trailing slash. */
export const APP_BASE_URL: string = (
  readConfiguredBaseUrl()?.trim()
  || (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/+$/, '');

/** The host the application is published on, used where a bare host is needed. */
export const APP_HOST: string = (() => {
  const configured = APP_BASE_URL;
  if (configured) {
    try {
      return new URL(configured).host || configured;
    } catch {
      return configured;
    }
  }
  return typeof window !== 'undefined' ? window.location.host : '';
})();

/**
 * The host to attribute a generated identifier to.
 *
 * A calendar entry names the host it came from, so that two entries with the
 * same identifier cannot be confused with one another. The host is the
 * application's own: the address it is published at, or the address the
 * browser is on.
 *
 * A value that names a development machine is never correct, and a bundle
 * that carries one puts a development name into a document that leaves the
 * organisation. So the last resort is the application's own name, which is at
 * least true.
 */
export const APP_HOST_LABEL: string = APP_HOST || APP_NAME_SLUG;

/**
 * The ICE servers used for real-time connections.
 *
 * Two browsers cannot find each other on the internet without a server that
 * says what address each of them has, and where that server is depends on the
 * deployment. The list is therefore configuration rather than a value written
 * into the source: a bundle that carried a hard-coded address would point a
 * deployment's connections at somebody else's server, or at the machine it
 * was built on.
 *
 * An empty list is a valid answer. A connection whose two ends are on the
 * same machine is made from that machine's own addresses and needs no server
 * to say so.
 */
export const readIceServers = (
  value: string | null | undefined
): Array<{ urls: string[] }> => {
  const urls = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return urls.length > 0 ? [{ urls }] : [];
};

/** The configured ICE servers. */
export const ICE_SERVERS: Array<{ urls: string[] }> = readIceServers(
  import.meta.env?.VITE_ICE_SERVERS ??
    (typeof process !== 'undefined' ? process.env.VITE_ICE_SERVERS : undefined)
);
