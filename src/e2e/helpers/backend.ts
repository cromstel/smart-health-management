import { DEFAULT_LOCAL_HOST } from '../../../server/src/config/runtime';
import { loadLocalEnv } from './env';

/**
 * Backend availability probe for the e2e suite.
 *
 * There is no mock API. Every mode talks to the real API at VITE_API_URL, so the
 * suite splits on whether a spec needs a session:
 *
 *  1. **Tag-free specs.** These only drive the Vite dev server: the auth pages,
 *     the responsive layout guard, landing, password recovery, and the public
 *     half of the scroll-to-top boundary. This is what CI gates on.
 *
 *  2. **Database-backed specs** (tagged `@db`). These sign in and assert on data
 *     that only the real API plus a seeded MySQL provide: the seeded clinician
 *     rows, the authenticated route smoke checks, the super-admin
 *     user-management flow, and the authenticated half of the scroll-to-top
 *     boundary. Without the backend they do not fail meaningfully -- they fail
 *     with a wall of failed logins, which looks like a product regression and is
 *     not one. So they self-skip when the API is unreachable, and CI excludes
 *     them with `--grep-invert @db`.
 *
 * Run them locally with:
 *   1. `npm run db:setup` in server/ (applies the schema and the seed)
 *   2. `cd server && npm run dev`
 *   3. `npx playwright test`
 */

// The environment files have to be visible before anything reads them: the
// API origin and the seeded credentials both come from there.
loadLocalEnv();

/**
 * The origin the API is reached on.
 *
 * `E2E_API_ORIGIN` wins. Otherwise the origin of `VITE_API_URL` -- the same
 * variable the app itself is configured with -- is used, so the suite and the
 * app always talk to the same API. The API's own port is the last resort.
 */
const resolveApiOrigin = (): string => {
  const explicit = process.env.E2E_API_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const configured = process.env.VITE_API_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // A relative VITE_API_URL means the API is same-origin, which the
      // dev server does not serve: fall through to the API's own port.
    }
  }

  const apiPort = Number(process.env.PORT);
  if (!Number.isInteger(apiPort) || apiPort < 1) {
    // Nothing says where the API is. That is not a reason to fail the run:
    // the probe below reports the API as unreachable, and the suites that
    // need it skip themselves with a reason.
    return '';
  }
  return `http://${DEFAULT_LOCAL_HOST}:${apiPort}`;
};

const API_ORIGIN = resolveApiOrigin();

/** Default timeout for the probe itself, so a hung port cannot stall the run. */
const PROBE_TIMEOUT_MS = 3000;

let cached: boolean | null = null;

/**
 * True when the real API answers. Any HTTP status counts (an unauthenticated
 * 401 is a *healthy* answer); only a transport-level failure (connection
 * refused, DNS failure, timeout) means the backend is not running.
 *
 * Result is cached for the process so a suite of 40 tests does not open 40
 * sockets during startup.
 */
export async function backendReachable(): Promise<boolean> {
  if (cached !== null) return cached;
  if (!API_ORIGIN) {
    // Nowhere to look.
    cached = false;
    return cached;
  }
  try {
    const response = await fetch(`${API_ORIGIN}/api/auth/me`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    cached = true;
    // Touch the response so the socket is released promptly.
    void response.body?.cancel();
  } catch {
    cached = false;
  }
  return cached;
}

/** Message shown when a `@db` spec is skipped for want of infrastructure. */
export const DB_SKIP_MESSAGE =
  `requires the real API + a seeded MySQL at ${API_ORIGIN} ` +
  '(see e2e/helpers/backend.ts for the setup steps)';