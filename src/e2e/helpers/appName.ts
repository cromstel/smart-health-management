import { loadLocalEnv } from './env';
import { resolveAppName } from '@/config/app';

/**
 * Publishes the configured application name to the Playwright process.
 *
 * The browser resolves the name from `import.meta.env`, which Vite fills from
 * the environment files. The Playwright process does not load those files, so
 * it would otherwise fall back to the shipped name while the application
 * under test renders the configured one — and the branding assertions would
 * fail for the wrong reason.
 *
 * Called from the Playwright configs before any worker starts, so every spec
 * process inherits the value through the environment.
 */
export const publishAppName = (): string => {
  loadLocalEnv();
  return resolveAppName(process.env.VITE_APP_NAME);
};
