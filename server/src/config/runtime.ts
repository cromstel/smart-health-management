/**
 * Runtime configuration shared by the API, the front-end build and the
 * end-to-end suite.
 *
 * The ports and host names the platform runs on are deployment facts, so they
 * are not written down here or anywhere else in the source. They come from the
 * environment, and a value that is missing is reported by name rather than
 * guessed: a guessed port silently moves the service somewhere nobody is
 * listening.
 *
 * This module lives in the server package on purpose. The API's tsconfig pins
 * `rootDir` to `server/src`, so the API cannot import anything from outside
 * its own package; the front-end build, the Playwright config and the e2e
 * helpers, on the other hand, can reach into the server package freely. One
 * module in the server package is therefore the only place both sides can
 * read, which is what keeps the configuration from drifting apart.
 *
 * It has no imports on purpose: the front-end package has neither `dotenv`
 * nor `bcryptjs`, so this module has to be plain data plus functions that
 * touch nothing but `process.env`.
 */

/** Reads a required port from the environment. */
const requiredPort = (name: string): number => {
  const raw = (process.env[name] ?? '').trim();
  const port = Number(raw);
  if (!raw || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Missing or invalid environment variable: ${name}. Set the port the service listens on.`
    );
  }
  return port;
};

/** Reads a required value from the environment, trimmed. */
const requiredValue = (name: string): string => {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
  return value;
};

/** Port the API listens on. */
export const apiPort = (): number => requiredPort('PORT');

/**
 * Port the API's HTTPS listener binds to, when one is wanted.
 *
 * A deployment that terminates TLS at the platform's proxy has no HTTPS
 * listener of its own, and requiring the port from such a deployment would
 * stop the application from starting for a setting it never uses. The port is
 * therefore only required when a listener is actually going to be opened.
 */
export const optionalHttpsPort = (): number | null => {
  const raw = (process.env.HTTPS_PORT ?? '').trim();
  if (raw === '') return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      'Invalid environment variable: HTTPS_PORT. Set the TCP port the HTTPS listener binds to, or leave it unset.'
    );
  }
  return port;
};

/** Port the Vite dev/preview server listens on. */
export const devPort = (): number => requiredPort('VITE_PORT');

/** Port the MySQL server listens on. */
export const dbPort = (): number => requiredPort('DB_PORT');

/** Interface the dev/preview server binds to. */
export const DEFAULT_DEV_HOST = '0.0.0.0';

/**
 * How many proxy hops to trust.
 *
 * The application is published through a platform proxy that terminates TLS
 * and forwards the request. The server has to be told to trust that hop, and
 * the reason is not cosmetic: a request that looks like plain HTTP cannot
 * set a secure cookie, so the session cookie is never sent, no session is
 * established, and no one can sign in. The same missing trust makes every
 * client look like the proxy, which puts them all in one rate-limit bucket
 * and puts the proxy's address in the audit trail.
 *
 * The default is one hop, because that is the shape of a published
 * deployment: the proxy in front, the application behind it, and nothing
 * else. A development machine has no proxy in front of it and trusts none.
 */
export const trustProxyHops = (): number => {
  const raw = (process.env.TRUST_PROXY_HOPS ?? '').trim();
  if (raw !== '') {
    const hops = Number(raw);
    if (!Number.isInteger(hops) || hops < 0) {
      throw new Error(
        'Invalid environment variable: TRUST_PROXY_HOPS. Set the number of proxy hops to trust.'
      );
    }
    return hops;
  }
  return process.env.NODE_ENV === 'production' ? 1 : 0;
};

/** Host name used to reach a server running on this machine. */
export const DEFAULT_LOCAL_HOST = 'localhost';

/**
 * The host the application is published on.
 *
 * Derived from the published address rather than written down, so the name
 * and the address the platform is served at cannot disagree. The values can
 * be supplied directly, which is what the front-end build does: it reads the
 * environment files itself and does not publish them to `process.env`.
 */
export const productionHost = (configured?: {
  allowedHosts?: string;
  frontendUrl?: string;
}): string => {
  const allowed = (configured?.allowedHosts ?? process.env.VITE_ALLOWED_HOSTS ?? '')
    .split(',')[0]
    ?.trim();
  if (allowed) return allowed;

  const frontend = (
    configured?.frontendUrl ?? process.env.FRONTEND_URL ?? ''
  ).split(',')[0]?.trim();
  if (frontend) {
    try {
      return new URL(frontend).host;
    } catch {
      return frontend;
    }
  }

  throw new Error(
    'Missing required environment variable: VITE_ALLOWED_HOSTS or FRONTEND_URL. Set the host the application is served on.'
  );
};

/**
 * Relying-party id for WebAuthn ceremonies when none is configured.
 *
 * The relying-party id is a domain without a scheme, so the local host name
 * is the development default; a deployment sets it to its own domain.
 */
export const DEFAULT_WEBAUTHN_RP_ID = DEFAULT_LOCAL_HOST;

/** Scheme used for a locally running server. */
export const DEFAULT_LOCAL_SCHEME = 'http';

/** Host the MySQL server runs on when `DB_HOST` is unset. */
export const DEFAULT_DB_HOST = 'localhost';

/** User the application connects as when `DB_USER` is unset. */
export const DEFAULT_DB_USER = 'root';

/** Schema the application works in when `DB_NAME` is unset. */
export const DEFAULT_DB_NAME = 'smart_medicare';

/** The origin the dev server is served from, used as the API's CORS fallback. */
export const defaultFrontendOrigin = (): string =>
  `${DEFAULT_LOCAL_SCHEME}://${DEFAULT_LOCAL_HOST}:${devPort()}`;

/**
 * The canonical address the application is published at.
 *
 * `FRONTEND_URL` may list several addresses, comma separated; the first is
 * the canonical one. Empty when the variable is not set, so a caller can
 * decide whether to fall back or to require it.
 */
export const primaryFrontendOrigin = (): string =>
  (process.env.FRONTEND_URL ?? '').split(',')[0]?.trim() ?? '';

/**
 * The addresses the API accepts browser requests from.
 *
 * Derived from `FRONTEND_URL`. A deployment that serves the API on its own
 * domain states it there; there is no second list to keep in step.
 */
export const allowedFrontendOrigins = (): string[] => {
  const configured = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configured.length > 0) return configured;
  return [defaultFrontendOrigin()];
};

export { requiredValue, requiredPort };
