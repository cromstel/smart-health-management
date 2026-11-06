// Migration runner.
//
// Applies every .sql file in server/migrations/ exactly once, in filename
// order, and records what has run in a `schema_migrations` table. Each file is
// applied inside a transaction so a failed migration leaves no partial state.
//
// Usage:
//   npm run db:migrate            # apply pending migrations
//   npm run db:migrate -- --status
//
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Must be first: it loads .env/.env.local the same way the app does, so the
// migration connects with the same credentials and precedence rules as the
// running server. Plain dotenv here would miss .env.local and fail the
// handshake with an opaque auth plugin error.
import '../config/env.js';
import { databaseConnectionOptions, databaseName } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

const TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
`;

const listMigrationFiles = (): string[] =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

const run = async (): Promise<void> => {
  const statusOnly = process.argv.includes('--status');

  const dbName = databaseName();

  const connection = await mysql.createConnection({
    ...databaseConnectionOptions(),
    multipleStatements: true,
  });

  try {
    // The schema file owns the database, so the runner creates it if missing
    // and then selects it, rather than assuming it already exists.
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${dbName}\``);

    await connection.query(TRACKING_TABLE);

    const [appliedRows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT filename FROM schema_migrations',
    );
    const applied = new Set(appliedRows.map((row) => row.filename as string));
    const files = listMigrationFiles();

    if (statusOnly) {
      console.log('Migration status:');
      for (const file of files) {
        console.log(`  ${applied.has(file) ? '[applied] ' : '[pending] '}${file}`);
      }
      return;
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        await connection.commit();
        console.log(`apply ${file}`);
      } catch (error) {
        await connection.rollback();
        console.error(`fail  ${file}: ${(error as Error).message}`);
        process.exitCode = 1;
        return;
      }
    }

    console.log('Migrations up to date.');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('Migration runner failed:', error);
  process.exit(1);
});
