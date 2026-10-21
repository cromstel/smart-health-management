/**
 * Env helper for required secrets.
 *
 * In production a missing secret is a hard startup error (fail-fast).
 * In development a safe, clearly-labeled fallback value is used so the
 * stack runs without a full .env file. No real secrets are hardcoded here.
 */
import dotenv from 'dotenv';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Environment loading
//
// This lives at the top of the module, and this module is imported first by the
// app entrypoint and by config/database.ts, because of ESM evaluation order.
//
// In index.ts the dotenv.config() calls used to sit in the module *body*. Every
// `import` statement is hoisted and evaluated before any body statement, so
// config/database.ts -- and every controller importing it -- had already
// constructed its MySQL pool from an empty process.env and silently fell back
// to defaults. The visible symptom was an opaque handshake failure,
// "Server requests authentication using unknown plugin auth_gssapi_client",
// because no real credentials ever reached the server.
//
// Precedence, matching what config/database.ts documented:
//   .env        shared defaults
//   .env.local  local overrides, which win
// Resolved from the repository root regardless of CWD, since the API runs from
// server/ while these files live one level up. The real process environment
// still wins over both; see the note at the bottom of this block.
// ---------------------------------------------------------------------------

const here = nodePath.dirname(fileURLToPath(import.meta.url));
// config/ -> src/ -> server/ -> repository root
const repoRoot = nodePath.resolve(here, '..', '..', '..');

// Precedence, highest first:
//   1. the real process environment (shell, CI, `set VAR=...`)
//   2. .env.local
//   3. .env
//
// dotenv does not override an already-set variable, which is right for .env
// but not enough on its own: loading .env.local with override:true would also
// clobber a variable the operator set explicitly in the shell. That is not
// hypothetical -- it silently reverted a rate-limit override back to the value
// in .env.local and made the Playwright suite fail with 429.
//
// So the real environment is captured first and restored last, which gives
// .env.local precedence over .env without either of them touching the shell.
const realEnv = new Map(
  Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)
);

dotenv.config({ path: nodePath.join(repoRoot, '.env') });
dotenv.config({ path: nodePath.join(repoRoot, '.env.local'), override: true });
// Also honour a CWD-relative server/.env.local, for anyone who keeps one.
dotenv.config({ path: nodePath.resolve(process.cwd(), '.env.local'), override: true });

for (const [key, value] of realEnv) {
  process.env[key] = value;
}

export const getSecret = (name: string, devFallback: string): string => {
  const value = process.env[name];
  if (value && value.trim() !== '') {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
};

/**
 * Whether an optional integration is really configured.
 *
 * The environment files carry a placeholder for every integration that is not
 * switched on, so that nothing is missing when a deployment is set up. A
 * placeholder is still a non-empty string, so a plain "is it set?" check
 * treated it as configured and the integration failed at the moment it was
 * first used, with the placeholder in the error. A placeholder now reads as
 * "not configured", which is what it means.
 */
export const isConfigured = (value: string | undefined | null): boolean => {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return false;
  return !/^replace[_-]?with/i.test(trimmed) && !/^changeme$/i.test(trimmed);
};

/**
 * Reads a TCP port from the environment.
 *
 * Uses the same rule as `getSecret`: a missing port is a hard startup error
 * in production, because a server that guesses its own port can end up bound
 * to the wrong one and nothing says so until a client cannot reach it. In
 * development the documented fallback is used.
 *
 * A value that is present but not a port is rejected in every environment:
 * `app.listen('abc')` would bind a socket path, not a port.
 */
export const getPort = (name: string, devFallback: number): number => {
  const raw = getSecret(name, String(devFallback));
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid ${name}: "${raw}" is not a valid TCP port`);
  }
  return port;
};
