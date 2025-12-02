import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Password#123',
      database: process.env.DB_NAME || 'smart_health_manager',
      ssl: { rejectUnauthorized: false },
      multipleStatements: true
    });

    console.log('🚀 Running database migrations...\n');

    // Check if performance indexes migration has been applied
    const [existingIndexes] = await connection.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('users', 'patients', 'appointments')
      AND INDEX_NAME LIKE 'idx_%'
    `);

    const indexCount = (existingIndexes as any[])[0].count;

    if (indexCount >= 10) { // We expect around 40+ indexes from our migration
      console.log('✅ Performance indexes migration already applied!');
      return;
    }

    console.log('📊 Applying performance indexes migration...');

    // Read and execute the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-performance-indexes.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Split the migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let appliedIndexes = 0;

    for (const statement of statements) {
      try {
        // Skip comments and empty statements
        if (statement.startsWith('--') || statement.trim() === '') {
          continue;
        }

        // Check if this is a CREATE INDEX statement
        if (statement.toUpperCase().includes('CREATE INDEX')) {
          // Extract index name from the statement
          const indexMatch = statement.match(/CREATE INDEX (\w+)/i);
          if (indexMatch) {
            const indexName = indexMatch[1];

            // Check if index already exists
            const [existing] = await connection.query(`
              SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
              AND INDEX_NAME = ?
            `, [indexName]);

            if ((existing as any[])[0].count > 0) {
              console.log(`⏭️  Index ${indexName} already exists, skipping...`);
              continue;
            }
          }
        }

        await connection.query(statement);
        appliedIndexes++;

        // Extract index name for logging
        const indexMatch = statement.match(/CREATE INDEX (\w+)/i);
        if (indexMatch) {
          console.log(`✅ Created index: ${indexMatch[1]}`);
        }

      } catch (error: any) {
        // Log the error but continue with other statements
        console.log(`⚠️  Error executing statement: ${error.message}`);
        console.log(`   Statement: ${statement.substring(0, 100)}...`);
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`   - Indexes applied: ${appliedIndexes}`);
    console.log(`   - Total performance indexes: ${indexCount + appliedIndexes}`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📪 Database connection closed.');
    }
  }
}

// Run the migrations
runMigrations();
