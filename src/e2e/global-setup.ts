import type { FullConfig } from '@playwright/test';
import { DEFAULT_LOCAL_HOST } from '../../server/src/config/runtime';

/**
 * Global setup: refuse to run against whatever happens to be answering the port.
 *
 * `playwright.config.ts` has always pointed at this file, but the file was never
 * committed, so every `npx playwright test` invocation died with
 * `Cannot find module './e2e/global-setup.ts'` and the suite could not run at
 * all. That is the first half of why the e2e layer silently rotted.
 *
 * The failure this guards against is real and already documented in the config:
 * port 3000 was once held by an unrelated WSL relay, Vite silently fell back to
 * the next free port, and the suite kept talking to 3000 -- so every assertion
 * ran against a different application. The failures looked plausible, so nothing
 * flagged them.
 *
 * Identity check, cheapest first:
 *   1. The server answers at all.
 *   2. It serves an HTML document (not a directory listing or an API 404).
 *   3. The document is *this* app: it carries our root mount node and the Vite
 *      client entry, and does not look like some other SPA.
 */

// The port comes from the environment. There is no written-down default: a
// port in the source has to be changed in the source to be changed at all.
const PORT = Number(process.env.VITE_PORT);
if (!Number.isInteger(PORT) || PORT < 1) {
  throw new Error('Missing or invalid environment variable: VITE_PORT.');
}
const BASE_URL = `http://${DEFAULT_LOCAL_HOST}:${PORT}`;

export default async function globalSetup(config: FullConfig) {
  // `config` is required by the Playwright hook signature. Mark it used so the
  // no-unused-vars rule does not fire on the required-but-ignored parameter.
  void config;

  let response: Response;
  try {
    response = await fetch(BASE_URL, { redirect: 'follow' });
  } catch (error) {
    const err = new Error(
      `Nothing is answering ${BASE_URL}.\n` +
        'Start the app first: `npm run dev` (VITE_PORT to change the port), ' +
        'or let the Playwright webServer start it. Refusing to run: asserting ' +
        'against an unknown server is how this suite ends up testing the wrong software.',
    );
    (err as any).cause = error;
    throw err;
  }

  if (!response.ok) {
    throw new Error(`${BASE_URL} answered ${response.status}. Expected the dev server (200).`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(
      `${BASE_URL} answered with "${contentType}", not an HTML document. ` +
        'Something other than the dev server is on this port.',
    );
  }

  const html = await response.text();
  const problems: string[] = [];

  if (!html.includes('id="root"')) {
    problems.push('no `id="root"` mount node');
  }
  if (!/<script[^>]+type="module"/i.test(html)) {
    problems.push('no module script tag (not a Vite-served SPA document)');
  }
  // A dev-server document is served by Vite; anything else on this port (a WSL
  // relay, a stray static server, another framework) will not carry these.
  if (!/vite/i.test(html)) {
    problems.push('no Vite client reference in the document');
  }

  if (problems.length > 0) {
    throw new Error(
      `${BASE_URL} is answering, but it does not look like this app: ${problems.join('; ')}.\n` +
        'Refusing to run — a suite that quietly measures a different application ' +
        'produces failures that look like product regressions.',
    );
  }

  console.log(`[e2e] verified dev server identity at ${BASE_URL}`);
}