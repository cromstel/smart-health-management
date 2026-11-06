import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where a configured path is anchored.
 *
 * The API is started from different working directories: the development
 * script runs it from `server/`, and a deployment runs it from the repository
 * root or from wherever the platform put it. A relative path in the
 * environment therefore resolved against a different place each time, so the
 * same setting named two different directories.
 *
 * The anchor is the repository root, worked out from this module's own
 * location, so the answer does not depend on the working directory. The
 * module sits at `server/src/config/paths.ts` in the source tree and at
 * `server/dist/config/paths.js` in a build, and the root is three levels up
 * from either.
 */
export const repositoryRoot = (): string => path.resolve(here, '..', '..', '..');

/**
 * Resolves a configured path.
 *
 * An absolute path is used as it is. A relative path is taken to be relative
 * to the repository root, which is what the documented values
 * (`server/uploads`, `server/backups`) are written against.
 */
export const resolveConfiguredPath = (configured: string | undefined | null, fallback: string): string => {
  const value = (configured ?? '').trim();
  if (value === '') return fallback;
  if (path.isAbsolute(value)) return path.normalize(value);
  return path.resolve(repositoryRoot(), value);
};
