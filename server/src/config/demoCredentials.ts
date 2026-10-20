/**
 * The credentials the local seed gives the demo accounts.
 *
 * The seeded accounts are how a fresh checkout is exercised, so they have to
 * keep working -- but their passwords were bcrypt hashes written into
 * `server/src/database/seed.sql`, and the plaintext behind them was written
 * into the documentation, the end-to-end specs and a login page. A credential
 * that is in the repository is a credential that is in every clone of it.
 *
 * The passwords are configuration now:
 *
 *   SEED_SUPER_ADMIN_PASSWORD   the seeded super administrator
 *   SEED_ADMIN_PASSWORD         the seeded hospital administrator
 *   SEED_DOCTOR_PASSWORD        the seeded clinician
 *   SEED_PATIENT_PASSWORD       the seeded patient
 *
 * The seed runner hashes whatever these resolve to and substitutes the hashes
 * into the seed file, so no hash and no password is stored in the repository.
 * The end-to-end suite reads the same values through this module, which is
 * why it is dependency-free: the front-end package has neither `dotenv` nor
 * `bcryptjs`, and the module has to be importable from there.
 *
 * `SUPER_ADMIN_PASSWORD` and `ADMIN_PASSWORD` are accepted as aliases for the
 * two privileged accounts, because that is what an existing deployment
 * already sets.
 */

/** The demo accounts the local seed creates. */
export type DemoAccountId = 'superAdmin' | 'admin' | 'doctor' | 'patient';

export interface DemoAccount {
  /** Identifier used to look the account up in the resolved credential map. */
  id: DemoAccountId;
  /** The environment variable that supplies the password. */
  envVar: string;
  /** Variables that also supply the password, for compatibility with older setups. */
  aliasEnvVars: readonly string[];
  /** The token the seed file carries where the password hash goes. */
  hashPlaceholder: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: 'superAdmin',
    envVar: 'SEED_SUPER_ADMIN_PASSWORD',
    aliasEnvVars: ['SUPER_ADMIN_PASSWORD', 'super_ADMIN_PASSWORD'],
    hashPlaceholder: 'SEED_SUPER_ADMIN_PASSWORD_HASH',
  },
  {
    id: 'admin',
    envVar: 'SEED_ADMIN_PASSWORD',
    aliasEnvVars: ['ADMIN_PASSWORD'],
    hashPlaceholder: 'SEED_ADMIN_PASSWORD_HASH',
  },
  {
    id: 'doctor',
    envVar: 'SEED_DOCTOR_PASSWORD',
    aliasEnvVars: ['DOCTOR_PASSWORD'],
    hashPlaceholder: 'SEED_DOCTOR_PASSWORD_HASH',
  },
  {
    id: 'patient',
    envVar: 'SEED_PATIENT_PASSWORD',
    aliasEnvVars: ['PATIENT_PASSWORD'],
    hashPlaceholder: 'SEED_PATIENT_PASSWORD_HASH',
  },
];

/**
 * The development-only password used when none of the seed variables is set.
 *
 * It exists so that a fresh checkout has a working demo account without
 * anyone having to invent a password first, and it is deliberately
 * conspicuous: it says what it is. It is not a secret and it must never be
 * used anywhere but a local seed -- set the `SEED_*_PASSWORD` variables
 * instead, and the seed uses those.
 */
export const DEV_DEMO_PASSWORD = 'DevOnly#2026';

/**
 * The password for a demo account, taken from the environment.
 *
 * Falls back to the shared development password when the account's variable
 * (and its aliases) are unset.
 */
export const resolveDemoPassword = (account: DemoAccount): string => {
  for (const name of [account.envVar, ...account.aliasEnvVars]) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return DEV_DEMO_PASSWORD;
};

/** Every demo account's password, keyed by account id. */
export const resolveDemoCredentials = (): Record<DemoAccountId, string> => {
  const credentials = {} as Record<DemoAccountId, string>;
  for (const account of DEMO_ACCOUNTS) {
    credentials[account.id] = resolveDemoPassword(account);
  }
  return credentials;
};

/**
 * Where a demo account's password came from, named for a log line.
 *
 * The variable name is safe to print; the value is not.
 */
export const resolveDemoPasswordSource = (account: DemoAccount): string => {
  for (const name of [account.envVar, ...account.aliasEnvVars]) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim() !== '') {
      return name;
    }
  }
  return 'the shared development password';
};

/** The placeholder token the seed file carries for a password hash. */
const HASH_PLACEHOLDER = /\$\{(SEED_[A-Z_]+_PASSWORD_HASH)\}/g;

/**
 * Replaces the password placeholders in the seed file with real hashes.
 *
 * Throws when a placeholder has no hash, so a seed can never quietly write
 * the literal token into the `users` table.
 */
export const applySeedPasswordHashes = (
  sql: string,
  hashes: Readonly<Record<string, string>>
): string => {
  const missing: string[] = [];
  const rendered = sql.replace(HASH_PLACEHOLDER, (_match, placeholder: string) => {
    const hash = hashes[placeholder];
    if (!hash) {
      missing.push(placeholder);
      return _match;
    }
    return hash;
  });

  if (missing.length > 0) {
    throw new Error(
      `The seed file expects a password hash for: ${missing.join(', ')}. ` +
        'Every seeded account must be given a hash.'
    );
  }

  return rendered;
};
