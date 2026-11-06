import mysql from 'mysql2/promise';
// Must be first: it loads .env/.env.local the same way the app does, so the
// setup script connects with the same credentials and precedence rules as the
// running server. Plain dotenv here loaded only ../.env, missed .env.local
// and failed the handshake with an opaque auth plugin error.
import '../config/env.js';
import { databaseConnectionOptions, databaseName } from '../config/database.js';

(async () => {
  try {
    // The coordinates come from the same place the application's pool gets
    // them, so there is one way to configure the database rather than one
    // per script.
    const connection = await mysql.createConnection(databaseConnectionOptions());

    const dbName = databaseName();
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database '${dbName}' created or already exists.`);
    await connection.end();
  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  }
})();
