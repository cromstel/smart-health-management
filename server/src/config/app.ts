import { getSecret } from './env.js';

/**
 * Application name — the single source of truth for the product name on the
 * server.
 *
 * Mirrors `src/config/app.ts` in the frontend, but reads a server-side
 * environment variable (`APP_NAME`) rather than a `VITE_`-prefixed one,
 * because the value never reaches the browser from here: the API renders it
 * into emails, calendar invitations and generated documents, all of which are
 * produced server-side.
 *
 * `getSecret` is the repository's existing helper (see `config/env.ts`): in
 * production a missing value is a hard startup error, so a deployment can
 * never serve mail or reports that call the product the wrong thing; in
 * development a clearly-labelled fallback keeps the stack runnable without a
 * full `.env` file.
 */
export const APP_NAME: string = getSecret('APP_NAME', 'Smart MediCare');

/** The placeholder token the seed file carries for the application name. */
const APP_NAME_PLACEHOLDER = /\$\{APP_NAME\}/g;

/** Escapes a value for use inside a single-quoted MySQL string literal. */
const escapeSqlLiteral = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "''");

/**
 * Replaces the application-name placeholder in the seed file with the
 * configured name.
 *
 * Follows the same pattern the seed already uses for password hashes (see
 * `config/demoCredentials.ts`): the SQL file carries a token, and the runner
 * renders the real value at seed time. The seeded `system_name` setting is
 * what the reports and settings screens display, so it has to follow the same
 * configuration as everything else.
 */
export const applySeedAppName = (sql: string): string =>
  sql.replace(APP_NAME_PLACEHOLDER, () => escapeSqlLiteral(APP_NAME));
