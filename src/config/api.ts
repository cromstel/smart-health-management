/**
 * Where the browser talks to the API.
 *
 * Six modules used to resolve the API base URL independently, each with its
 * own copy of the same rule, and the rule itself was "if the configured URL
 * contains a particular development port, use the same-origin path instead".
 * That baked a port number into the source: the port had to be changed in six
 * places to be changed at all, and a stale copy silently sent requests to a
 * port nothing was listening on.
 *
 * The rule is configuration now, and it lives here:
 *
 *   - `VITE_API_URL` -- the absolute base URL of the API. Unset means
 *     same-origin: the app calls `/api` on its own host.
 *   - `VITE_DEV_API_PROXY_ONLY` -- set to `true` to force the same-origin
 *     `/api` path in development, e.g. when the dev server proxies `/api` to
 *     the API server. Unset (the default) means "use `VITE_API_URL`".
 *
 * Production behaviour is unchanged: a configured absolute URL is used as
 * configured, and the dev-only switch is ignored outside development.
 */

/** The same-origin path the app uses when no absolute API URL is configured. */
export const SAME_ORIGIN_API_PATH = '/api';

/**
 * The subset of the build-time environment this module reads.
 *
 * Declared locally rather than in `vite-env.d.ts` so the contract is visible
 * next to the code that depends on it, and so the module stays importable
 * from tests that stub the environment.
 */
export interface ApiEnvironment {
  /** True in a development build. */
  DEV?: boolean;
  /** The configured absolute API base URL. */
  VITE_API_URL?: string;
  /** Force the same-origin `/api` path in development. */
  VITE_DEV_API_PROXY_ONLY?: string;
}

const readEnvironment = (): ApiEnvironment => import.meta.env as unknown as ApiEnvironment;

/**
 * Reads a boolean-ish environment flag.
 *
 * Accepts the spellings an operator is likely to write in an env file, and
 * treats anything else (including an empty value) as "not set".
 */
const isEnabled = (value: string | undefined | null): boolean => {
  if (typeof value !== 'string') return false;
  const normalised = value.trim().toLowerCase();
  return normalised === 'true' || normalised === '1' || normalised === 'yes' || normalised === 'on';
};

/**
 * Resolves the API base URL from the environment.
 *
 * Exported so the rule can be exercised directly, with an environment passed
 * in, instead of only through the module-level constant.
 */
export const resolveApiBaseUrl = (environment: ApiEnvironment = readEnvironment()): string => {
  if (environment.DEV && isEnabled(environment.VITE_DEV_API_PROXY_ONLY)) {
    return SAME_ORIGIN_API_PATH;
  }

  const configured =
    typeof environment.VITE_API_URL === 'string' ? environment.VITE_API_URL.trim() : '';

  return configured || SAME_ORIGIN_API_PATH;
};

/** The API base URL every client in the app uses. */
export const API_BASE_URL = resolveApiBaseUrl();

/**
 * The origin the API is served from, or an empty string when the API is
 * same-origin (in which case no absolute URL is needed).
 */
export const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api$/, '')
  : '';
