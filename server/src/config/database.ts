import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Connection pool configuration with optimized settings
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Password#123',
  database: process.env.DB_NAME || 'smart_health_manager',
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  // Increased from 10 to 50 for better concurrency handling
  // Can be adjusted based on server resources and load
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '50'),
  queueLimit: 0, // Unlimited queue, connections will wait
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Connection timeout settings
  connectTimeout: 60000, // 60 seconds to establish connection
  // Connection pool optimization
  maxIdle: 10, // Maximum idle connections
  idleTimeout: 600000, // 10 minutes idle timeout
});

// Connection pool monitoring and event handlers
if (process.env.NODE_ENV !== 'test') {
  // Log pool statistics periodically (every 5 minutes)
  setInterval(() => {
    const poolStatus = {
      totalConnections: (pool.pool as any)._allConnections?.length || 0,
      freeConnections: (pool.pool as any)._freeConnections?.length || 0,
      queuedRequests: (pool.pool as any)._connectionQueue?.length || 0,
      utilization: 0,
    };

    const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '50');
    if (poolStatus.totalConnections > 0) {
      poolStatus.utilization = 
        ((poolStatus.totalConnections - poolStatus.freeConnections) / connectionLimit) * 100;
    }

    // Log if utilization is high (>80%)
    if (poolStatus.utilization > 80) {
      console.warn('⚠️  Database connection pool utilization high:', {
        ...poolStatus,
        utilization: `${poolStatus.utilization.toFixed(1)}%`,
      });
    } else if (process.env.DB_POOL_DEBUG === 'true') {
      console.log('📊 Database connection pool status:', {
        ...poolStatus,
        utilization: `${poolStatus.utilization.toFixed(1)}%`,
      });
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Handle connection events
  pool.pool.on('connection', (_connection: any) => {
    if (process.env.DB_POOL_DEBUG === 'true') {
      console.log('✅ New database connection established');
    }
  });

  pool.pool.on('error', (err: Error) => {
    console.error('❌ Database connection pool error:', err);
  });
}

export default pool;