/**
 * Runtime defaults shared by the API, the front-end build and the end-to-end
 * suite.
 *
 * Every port number and host name used as a fallback lives here, and nowhere
 * else. They used to be repeated in the API entry point, the CORS allow-list,
 * the WebAuthn configuration, the database scripts, the Vite config, the
 * Playwright config and the e2e helpers -- eight copies of the same handful of
 * numbers, each of which had to be changed in every copy to be changed at all.
 *
 * This module lives in the server package on purpose. The API's tsconfig pins
 * `rootDir` to `server/src`, so the API cannot import anything from outside
 * its own package; the front-end build, the Playwright config and the e2e
 * helpers, on the other hand, can reach into the server package freely. One
 * module in the server package is therefore the only place both sides can
 * read, which is what keeps the numbers from drifting apart.
 *
 * It has no imports on purpose: the front-end package has neither `dotenv`
 * nor `bcryptjs`, so this module has to be plain data plus functions that
 * touch nothing but `process.env`.
 *
 * Every value here is a *fallback*. The environment wins: `PORT`,
 * `HTTPS_PORT`, `VITE_PORT`, `VITE_HOST` and `VITE_ALLOWED_HOSTS` all
 * override what is written below, and the API refuses to start in production
 * when a port it needs is not configured at all.
 */

/** Port the API listens on when `PORT` is unset (development fallback). */
export const DEFAULT_API_PORT = 5000;

/** Port the API's HTTPS listener binds to when `HTTPS_PORT` is unset. */
export const DEFAULT_HTTPS_PORT = 8443;

/** Port the Vite dev/preview server listens on when `VITE_PORT` is unset. */
export const DEFAULT_DEV_PORT = 5175;

/** Interface the dev/preview server binds to when `VITE_HOST` is unset. */
export const DEFAULT_DEV_HOST = '0.0.0.0';

/** Host the production server binds to when `VITE_HOST` is unset. */
export const DEFAULT_PROD_HOST = 'medicare.cromstelit.com';

/** Host name used to reach a server running on this machine. */
export const DEFAULT_LOCAL_HOST = 'localhost';

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

/** Port the MySQL server listens on when `DB_PORT` is unset. */
export const DEFAULT_DB_PORT = 3306;

/** User the application connects as when `DB_USER` is unset. */
export const DEFAULT_DB_USER = 'root';

/** Schema the application works in when `DB_NAME` is unset. */
export const DEFAULT_DB_NAME = 'smart_medicare';

/** The origin the dev server is served from, used as the API's CORS fallback. */
export const DEFAULT_FRONTEND_ORIGIN = `${DEFAULT_LOCAL_SCHEME}://${DEFAULT_LOCAL_HOST}:${DEFAULT_DEV_PORT}`;

/**
 * The first entry of `FRONTEND_URL`.
 *
 * That variable accepts a comma-separated list of allowed CORS origins, and
 * WebAuthn needs exactly one origin, so the primary entry is used.
 */
export const primaryFrontendOrigin = (): string | undefined =>
  process.env.FRONTEND_URL?.split(',')[0]?.trim() || undefined;

/**
 * Every origin the API accepts browser requests from.
 *
 * Configured with `FRONTEND_URL`; falls back to the local dev origin so a
 * checkout without an env file still serves the app.
 */
export const allowedFrontendOrigins = (): string[] =>
  (process.env.FRONTEND_URL || DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
