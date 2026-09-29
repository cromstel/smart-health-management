// Must be the first import: it loads .env/.env.local, and everything below
// reads process.env at module-evaluation time. Kept first deliberately.
import './env.js';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  // No hardcoded password fallback. Set DB_PASSWORD in .env / environment.
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_medicare',
  // TLS only when explicitly enabled via DB_SSL=true (production).
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export default pool;