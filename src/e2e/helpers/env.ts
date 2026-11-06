import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Loads the repository's environment files into the test process.
 *
 * The API, the seed runner and the Playwright process all have to agree on
 * the configuration -- the seeded demo passwords above all, or a spec signs
 * in with a password the database does not have. The API reads `.env` and
 * `.env.local` through `server/src/config/env.ts`; this is the same thing for
 * the test process, which does not otherwise see either file.
 *
 * The front-end package has no `dotenv`, so the files are parsed with the
 * runtime's own parser. The precedence matches the API's:
 *
 *   1. the real environment (shell, CI)
 *   2. .env.local
 *   3. .env
 */

let loaded = false;

/**
 * Loads `.env` and `.env.local` from the repository root.
 *
 * Idempotent: calling it more than once is a no-op, so a helper and a spec
 * can both call it without fighting over the environment.
 */
export const loadLocalEnv = (repoRoot: string = path.resolve(import.meta.dirname, '../../..')): void => {
  if (loaded) return;
  loaded = true;

  // What the process was started with. These values win over both files.
  const inherited = new Set(Object.keys(process.env));

  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) continue;

    const parsed = parseEnv(fs.readFileSync(fullPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (inherited.has(key)) continue;
      process.env[key] = value;
    }
  }
};
