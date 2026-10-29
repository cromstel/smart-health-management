import fs from 'node:fs';
import path from 'node:path';
import { repositoryRoot, resolveConfiguredPath } from './paths.js';

/**
 * Where the built front-end lives.
 *
 * The API and the front-end are served by one process in a deployment: the
 * platform sends every request for the site to the application, so the
 * application has to answer the page requests as well as the API requests.
 * That means it has to know where the front-end build was put.
 *
 * The location is not written down. It is either stated in the environment
 * (`FRONTEND_DIST_DIR`) or found where a build leaves it: beside the
 * application as `public/`, or at the application root as `dist/`. The second
 * is the shape a repository build produces and the first is the shape a
 * deployment bundle produces, so the same server works in both.
 *
 * A stated location is the whole answer. The search is only made when
 * nothing was stated, because a deployment that says where its build is and
 * does not have it there has a problem to be told about, not one to be
 * papered over with a different directory.
 *
 * When no build is present the answer is null, and the application serves the
 * API alone. That is the development arrangement, and it is why the check is
 * for the entry document rather than for the directory alone.
 */
export const frontendDistDir = (): string | null => {
  const root = repositoryRoot();
  const configured = (process.env.FRONTEND_DIST_DIR ?? '').trim();

  const candidates: string[] = configured
    ? [resolveConfiguredPath(configured, configured)]
    : [path.join(root, 'public'), path.join(root, 'dist')];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'index.html'))) {
        return candidate;
      }
    } catch {
      // A directory that cannot be read is not a build. The next candidate is
      // tried, and the application falls back to serving the API alone.
    }
  }

  if (configured) {
    console.warn(
      `⚠️  FRONTEND_DIST_DIR points at ${configured}, which holds no entry document. The application will serve the API alone.`
    );
  }

  return null;
};

/**
 * The documents that must never be cached for a long time.
 *
 * The build's assets carry a content hash in their name, so they can be
 * cached indefinitely. The entry document and the service worker do not: a
 * cached service worker keeps serving the previous release, and a cached
 * entry document keeps pointing at assets that have been replaced.
 */
const uncacheableDocuments = [
  'index.html',
  'sw.js',
  'registerSW.js',
  'manifest.webmanifest',
  'manifest.json',
];

export const isUncacheableDocument = (filePath: string): boolean => {
  const name = path.basename(filePath);
  if (uncacheableDocuments.includes(name)) return true;
  // The service worker's own generated helpers change whenever the worker's
  // precache list changes.
  return /^workbox-.*\.js$/.test(name);
};
