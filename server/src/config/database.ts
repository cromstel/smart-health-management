// Must be the first import: it loads .env/.env.local, and everything below
// reads process.env at module-evaluation time. Kept first deliberately.
import './env.js';
import mysql from 'mysql2/promise';
import {
  DEFAULT_DB_HOST,
  DEFAULT_DB_NAME,
  DEFAULT_DB_PORT,
  DEFAULT_DB_USER,
} from './runtime.js';

/**
 * The database configuration lives here and nowhere else.
 *
 * The credentials are read from the environment (DB_HOST, DB_PORT, DB_USER,
 * DB_PASSWORD, DB_NAME, DB_SSL). The values below are the fallbacks used when
 * a development environment has not set them; they are documented in
 * `.env.example`.
 *
 * The fallbacks themselves live in `config/runtime.ts`, the one module that
 * holds every default the platform uses, and are imported from there rather
 * than repeated here.
 */

export interface DatabaseConnectionOptions {
  host: string;
  port: number;
  user: string;
  /** No hardcoded password fallback. Set DB_PASSWORD in .env / environment. */
  password?: string;
  /** TLS only when explicitly enabled via DB_SSL=true (production). */
  ssl?: { rejectUnauthorized: boolean };
}

/**
 * The connection coordinates, resolved from the environment.
 *
 * Every script that talks to MySQL -- the API's pool, the schema/seed runner,
 * the migration runner, the backup tooling -- uses this, so there is one way
 * to configure the database rather than one per script.
 */
export const databaseConnectionOptions = (): DatabaseConnectionOptions => ({
  host: process.env.DB_HOST || DEFAULT_DB_HOST,
  port: parseInt(process.env.DB_PORT || String(DEFAULT_DB_PORT), 10),
  user: process.env.DB_USER || DEFAULT_DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

/** The schema the application works in. */
export const databaseName = (): string => process.env.DB_NAME || DEFAULT_DB_NAME;

const pool = mysql.createPool({
  ...databaseConnectionOptions(),
  database: databaseName(),
  // A DECIMAL column is returned as a string by default, which is the wrong
  // type for money and for every measurement the application does arithmetic
  // on. It had a concrete cost: the pharmacy page crashed on
  // `med.price.toFixed(2)` because the price arrived as "12.50", and the
  // financial exports wrote money into the spreadsheet as text, so a SUM over
  // the column returned zero and the rows sorted lexicographically.
  //
  // Coercing at the driver removes the whole class of defect instead of
  // relying on every endpoint to remember. The columns involved hold at most
  // fifteen significant digits, which a double represents exactly.
  decimalNumbers: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export default pool;
