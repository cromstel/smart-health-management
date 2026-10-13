/**
 * Backend availability probe for the e2e suite.
 *
 * The suite has two distinct halves and they need different infrastructure:
 *
 *  1. **Mock-backed specs** (tag-free). These run against the Vite dev server
 *     alone. `src/server/mockApi.ts` is mounted as Vite middleware and serves
 *     auth, patients, appointments and the rest in-process. Everything public
 *     works: the auth pages, the responsive layout guard, landing, request-demo,
 *     password recovery. These are what CI gates on.
 *
 *  2. **Database-backed specs** (tagged `@db`). These exercise data that only
 *     exists in the real API plus a seeded MySQL: the seeded clinician rows
 *     ("Dr. Smith"), the super-admin user-management flow, and the authenticated
 *     route smoke checks. Without the backend these do not fail meaningfully --
 *     they fail with a wall of 403s from the mock, which looks like a product
 *     regression and is not one. So they self-skip when the API is unreachable,
 *     and CI excludes them with `--grep-invert @db`.
 *
 * Run them locally with:
 *   1. `mysql -u root -p < server/src/database/schema.sql` then `seed.sql`
 *   2. `cd server && npm run dev`
 *   3. `npx playwright test`
 */

const API_ORIGIN = process.env.E2E_API_ORIGIN || 'http://localhost:5000';

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