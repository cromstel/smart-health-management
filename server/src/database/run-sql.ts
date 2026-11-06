import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
// Must be first: it loads .env/.env.local the same way the app does, so the
// setup script connects with the same credentials and precedence rules as the
// running server. Plain dotenv here missed .env.local and failed the
// handshake with an opaque auth plugin error.
import '../config/env.js';
import { databaseConnectionOptions, databaseName } from '../config/database.js';
import { applySeedAppName } from '../config/app.js';
import {
  applySeedPasswordHashes,
  DEMO_ACCOUNTS,
  resolveDemoPassword,
  resolveDemoPasswordSource,
} from '../config/demoCredentials.js';

/**
 * The bcrypt cost the seeded passwords are hashed with.
 *
 * Configurable with `SEED_BCRYPT_ROUNDS`; the default matches the cost the
 * seed has always used, which keeps a local seed fast.
 */
const SEED_BCRYPT_ROUNDS = parseInt(process.env.SEED_BCRYPT_ROUNDS || '10', 10);

/**
 * Hashes the demo accounts' passwords, as they are configured in the
 * environment.
 *
 * The seed file carries a placeholder where each password hash goes; the
 * hashes are generated here, at seed time, so no password and no hash is
 * stored in the repository.
 */
const buildSeedPasswordHashes = async (): Promise<Record<string, string>> => {
  const hashes: Record<string, string> = {};

  for (const account of DEMO_ACCOUNTS) {
    const password = resolveDemoPassword(account);
    hashes[account.hashPlaceholder] = await bcrypt.hash(password, SEED_BCRYPT_ROUNDS);
    // The variable name is safe to log; the password is not.
    console.log(
      `Seeded demo account "${account.id}" with a hash from ${resolveDemoPasswordSource(account)}.`
    );
  }

  return hashes;
};

const runSqlScript = async () => {
  let connection;
  try {
    const dbName = databaseName();
    connection = await mysql.createConnection({
      ...databaseConnectionOptions(),
      multipleStatements: true
    });

    console.log('Connected to the database.');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // The schema file owns the database, so it is created if missing and then
    // selected, rather than assumed to exist.
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${dbName}\``);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('Database schema applied successfully.');

    const seedPath = path.join(__dirname, 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    const seededSql = applySeedPasswordHashes(applySeedAppName(seedSql), await buildSeedPasswordHashes());
    await connection.query(seededSql);
    console.log('Database seeded successfully.');

  } catch (error) {
    console.error('Error during database setup:', error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
};

runSqlScript();
