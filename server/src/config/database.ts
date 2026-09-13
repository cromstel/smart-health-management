import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load default .env first (if present), then override with .env.local for local development.
// .env.local is ignored by git but contains real credentials for the developer's environment.
// By loading it after the default .env we ensure the local values take precedence.

dotenv.config();
// Load a local .env file if it exists – this will override any previously loaded vars.
dotenv.config({ path: '.env.local' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  // No hardcoded password fallback. Set DB_PASSWORD in .env / environment.
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_health_manager',
  // TLS only when explicitly enabled via DB_SSL=true (production).
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export default pool;