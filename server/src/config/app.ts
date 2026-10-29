import { requireEnv } from './env.js';

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
 * There is no fallback. The name is a fact about the deployment, so it is
 * required: a guessed one would put the wrong name on every message the
 * platform sends. `requireEnv` names the variable that is missing.
 */
export const APP_NAME: string = requireEnv('APP_NAME');

/** The token the seed file carries where the product name goes. */
export const APP_NAME_PLACEHOLDER = '${APP_NAME}';

/**
 * Puts the configured name into the seed file.
 *
 * The seed is a template: it carries the token rather than a name, so the
 * product name is never written into the repository. The value is escaped
 * before it goes in, because it reaches a SQL statement.
 *
 * Every occurrence is replaced, not just the first. A single replacement
 * stopped at whichever token came first in the file, which in this seed was
 * the one in a comment explaining the substitution — so the name in the
 * statement that actually stores it was left as the literal token, and the
 * seeded application name was the text "${APP_NAME}".
 */
export const applySeedAppName = (sql: string): string =>
  sql.split(APP_NAME_PLACEHOLDER).join(escapeSqlLiteral(APP_NAME));

/** Escapes a value for a single-quoted SQL literal. */
const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''");
