/**
 * JWT Token Cleanup Utility
 * Provides token blacklist cleanup and maintenance operations
 * Author: Security Team
 * Created: 2024-11-24
 */

import { jwtManager } from '../../config/jwt.js';

/**
 * Main Cleanup Function
 */
export async function cleanupExpiredTokens(): Promise<void> {
  console.log('🧹 Starting JWT Token Cleanup...');

  try {
    // In a production database implementation, this would:
    // 1. Remove expired tokens from blacklist table
    // 2. Clean up old audit logs
    // 3. Update token statistics

    await jwtManager.cleanupExpiredTokens();

    console.log('✅ Token cleanup completed successfully');
  } catch (error) {
    console.error('❌ Token cleanup failed:', error);
    throw error;
  }
}

/**
 * Schedule Periodic Cleanup
 */
export function scheduleCleanup(intervalMinutes: number = 60): void {
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(async () => {
    try {
      await cleanupExpiredTokens();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  }, intervalMs);

  console.log(`🔄 Scheduled token cleanup every ${intervalMinutes} minutes`);
}

/**
 * Main CLI Handler
 */
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'cleanup':
      await cleanupExpiredTokens();
      break;

    case 'schedule': {
      const interval = parseInt(process.argv[3]) || 60;
      scheduleCleanup(interval);
      // Keep the process running for scheduled cleanup
      console.log('Press Ctrl+C to stop scheduled cleanup');
      process.on('SIGINT', () => {
        console.log('\n🛑 Scheduled cleanup stopped');
        process.exit(0);
      });
      break;
    }

    default:
      console.log('JWT Token Cleanup Commands:');
      console.log('  npm run jwt:cleanup     # Run cleanup once');
      console.log('  npm run jwt:cleanup schedule <minutes>  # Schedule periodic cleanup');
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
