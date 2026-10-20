import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Must be first: it loads .env/.env.local the same way the app does, so the
// setup script connects with the same credentials and precedence rules as the
// running server. Plain dotenv here missed .env.local and failed the
// handshake with an opaque auth plugin error.
import '../config/env.js';

const runSqlScript = async () => {
  let connection;
  try {
    const dbName = process.env.DB_NAME || 'smart_medicare';
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
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
    await connection.query(seedSql);
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