import { loadLocalEnv } from './env';
import { resolveDemoCredentials } from '../../../server/src/config/demoCredentials';

/**
 * The passwords the seeded demo accounts are created with.
 *
 * The seed hashes whatever the environment supplies (SEED_ADMIN_PASSWORD and
 * friends); the specs read the same values here, so a spec can never sign in
 * with a password the database does not have. Nothing about a credential is
 * written in the repository.
 */
loadLocalEnv();

export const DEMO_PASSWORDS = resolveDemoCredentials();
