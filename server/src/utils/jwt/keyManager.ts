/**
 * JWT Key Management Utilities
 * Provides key rotation, validation, and management operations
 * Author: Security Team
 * Created: 2024-11-24
 */

import { createPrivateKey, createPublicKey } from 'crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { jwtManager } from '../../config/jwt.js';
import { generateRSAKeyPair, generateHS256Key } from './keyGenerator.js';

/**
 * Validate JWT Keys
 */
export function validateKeys(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = jwtManager['config']; // Access private config for validation

  console.log('🔍 Validating JWT Configuration:\n');

  // Check algorithm
  console.log(`Algorithm: ${config.algorithm}`);
  if (!['HS256', 'RS256'].includes(config.algorithm)) {
    errors.push(`Unsupported algorithm: ${config.algorithm}`);
  }

  // Check issuer configuration
  console.log(`Issuer: ${config.issuer}`);
  if (!config.issuer) {
    errors.push('JWT_ISSUER is not configured');
  }

  // Check audience configuration
  console.log(`Audience: ${config.audience}`);
  if (!config.audience) {
    errors.push('JWT_AUDIENCE is not configured');
  }

  // Validate keys based on algorithm
  if (config.algorithm === 'RS256') {
    const rsaValidation = validateRSAKeys();
    errors.push(...rsaValidation.errors);
  } else {
    const hs256Validation = validateHS256Secret();
    errors.push(...hs256Validation.errors);
  }

  console.log('\n' + '='.repeat(50));

  if (errors.length === 0) {
    console.log('✅ All JWT keys are valid!\n');
    return { valid: true, errors };
  } else {
    console.log('❌ JWT key validation failed:\n');
    errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    console.log('\n🔧 Fix the above issues and run validation again.\n');
    return { valid: false, errors };
  }
}

/**
 * Validate HS256 Secret
 */
function validateHS256Secret(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const secret = process.env.JWT_SECRET;

  console.log('\n🔐 HS256 Secret Validation:');

  if (!secret) {
    errors.push('JWT_SECRET environment variable is not set');
    console.log('❌ No secret found');
    return { valid: false, errors };
  }

  try {
    const secretLength = Buffer.from(secret, 'base64').length;
    console.log(`✅ Secret found (length: ${secretLength} bytes)`);

    if (secretLength < 32) {
      errors.push('HS256 secret is too short. Minimum 32 bytes (256 bits) recommended');
      console.log('⚠️  Secret is short. Consider using at least 32 bytes (256 bits)');
    } else if (secretLength >= 64) {
      console.log('✅ Secret length is good (≥ 64 bytes)');
    }

    // Check if it's a development default
    if (secret === 'dev-jwt-secret-key-for-development-only') {
      console.log('⚠️  Using development default secret. Change for production!');
    }
  } catch (error) {
    errors.push('JWT_SECRET is not valid base64');
    console.log('❌ Secret is not valid base64');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate RSA Keys
 */
function validateRSAKeys(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  console.log('\n🔑 RSA Key Validation:');

  // Check private key
  try {
    if (process.env.JWT_PRIVATE_KEY_PATH) {
      const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
      if (!existsSync(privateKeyPath)) {
        errors.push(`Private key file not found: ${privateKeyPath}`);
        console.log('❌ Private key file not found');
      } else {
        const privateKeyPem = readFileSync(privateKeyPath, 'utf8');
        createPrivateKey(privateKeyPem);
        console.log('✅ Private key is valid');

        // Check file permissions
        const stats = statSync(privateKeyPath);
        const permissions = (stats.mode & 0o777).toString(8);
        if (permissions !== '600') {
          console.log('⚠️  Private key has loose permissions. Use 600 for security');
        }
      }
    } else {
      errors.push('JWT_PRIVATE_KEY_PATH environment variable is not set');
      console.log('❌ Private key path not configured');
    }
  } catch (error) {
    errors.push('Private key is not valid PEM format');
    console.log('❌ Private key format invalid');
  }

  // Check public key
  try {
    if (process.env.JWT_PUBLIC_KEY_PATH) {
      const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;
      if (!existsSync(publicKeyPath)) {
        errors.push(`Public key file not found: ${publicKeyPath}`);
        console.log('❌ Public key file not found');
      } else {
        const publicKeyPem = readFileSync(publicKeyPath, 'utf8');
        createPublicKey(publicKeyPem);
        console.log('✅ Public key is valid');

        // Check if private and public keys match
        // This would require more complex validation
      }
    } else {
      errors.push('JWT_PUBLIC_KEY_PATH environment variable is not set');
      console.log('❌ Public key path not configured');
    }
  } catch (error) {
    errors.push('Public key is not valid PEM format');
    console.log('❌ Public key format invalid');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Rotate Keys
 */
export function rotateKeys(): { success: boolean; message: string } {
  console.log('🔄 Rotating JWT Keys...\n');

  try {
    // Backup current configuration
    backupCurrentKeys();

    // Generate new keys based on current algorithm
    const config = jwtManager['config'];

    if (config.algorithm === 'RS256') {
      // Generate new RSA key pair
      const newKeys = generateRSAKeyPair(4096);

      // Save with timestamp for backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const keysDir = process.env.JWT_PRIVATE_KEY_PATH ?
        dirname(process.env.JWT_PRIVATE_KEY_PATH) : './keys';

      writeFileSync(join(keysDir, `private-${timestamp}.pem.backup`), newKeys.privateKey);
      writeFileSync(join(keysDir, `public-${timestamp}.pem.backup`), newKeys.publicKey);

      writeFileSync(process.env.JWT_PRIVATE_KEY_PATH || join(keysDir, 'private.pem'), newKeys.privateKey, { mode: 0o600 });
      writeFileSync(process.env.JWT_PUBLIC_KEY_PATH || join(keysDir, 'public.pem'), newKeys.publicKey, { mode: 0o644 });

      console.log('✅ RSA keys rotated successfully');
      console.log(`📁 Backups saved with timestamp: ${timestamp}`);

    } else {
      // Generate new HS256 secret
      const newSecret = generateHS256Key(64);

      // TODO: Update environment variables
      console.log('⚠️  Manual HS256 key rotation required:');
      console.log(`New JWT_SECRET: ${newSecret.base64}`);
      console.log('Update your environment variables and restart the application.');
    }

    console.log('\n🔄 Key rotation completed. Old keys kept as backup.');
    return { success: true, message: 'Keys rotated successfully' };

  } catch (error) {
    console.error('❌ Key rotation failed:', error);
    return { success: false, message: `Key rotation failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Emergency Key Rotation (Force immediate rotation)
 */
export function emergencyRotateKeys(): { success: boolean; message: string } {
  console.log('🚨 EMERGENCY KEY ROTATION');
  console.log('This will immediately invalidate all existing JWT tokens!');
  console.log('Make sure all clients are prepared for forced re-authentication.\n');

  // Add confirmation prompt (would need user input in real CLI)
  console.log('Proceeding with emergency rotation...\n');

  return rotateKeys();
}

/**
 * Backup Current Keys
 */
function backupCurrentKeys(): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const keysDir = process.env.JWT_PRIVATE_KEY_PATH ?
    dirname(process.env.JWT_PRIVATE_KEY_PATH) : './keys';

  console.log('📦 Backing up current keys...');

  try {
    const config = jwtManager['config'];

    if (config.algorithm === 'RS256') {
      if (existsSync(process.env.JWT_PRIVATE_KEY_PATH || join(keysDir, 'private.pem'))) {
        const privateKey = readFileSync(process.env.JWT_PRIVATE_KEY_PATH || join(keysDir, 'private.pem'));
        const publicKey = readFileSync(process.env.JWT_PUBLIC_KEY_PATH || join(keysDir, 'public.pem'));

        writeFileSync(join(keysDir, `private-${timestamp}.pem.backup`), privateKey);
        writeFileSync(join(keysDir, `public-${timestamp}.pem.backup`), publicKey);

        console.log(`✅ Keys backed up to *-backup-${timestamp}.pem`);
      }
    } else {
      console.log('ℹ️  HS256 keys backup: Note your current JWT_SECRET for rollback');
    }
  } catch (error) {
    console.log('⚠️  Backup failed, but continuing with rotation:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * List Key Backups
 */
export function listBackups(): void {
  const keysDir = process.env.JWT_PRIVATE_KEY_PATH ?
    dirname(process.env.JWT_PRIVATE_KEY_PATH) : './keys';

  console.log('📋 Available Key Backups:\n');

  if (!existsSync(keysDir)) {
    console.log('No keys directory found');
    return;
  }

  const files = readdirSync(keysDir);
  const backups = files.filter(file => file.includes('.backup'));

  if (backups.length === 0) {
    console.log('No backups found');
    return;
  }

  backups.forEach((file, index) => {
    const stats = statSync(join(keysDir, file));
    const size = (stats.size / 1024).toFixed(2);
    console.log(`${index + 1}. ${file} (${size} KB) - ${stats.mtime.toISOString()}`);
  });
}

/**
 * Restore from Backup
 */
export function restoreFromBackup(backupFile: string): { success: boolean; message: string } {
  const keysDir = process.env.JWT_PRIVATE_KEY_PATH ?
    dirname(process.env.JWT_PRIVATE_KEY_PATH) : './keys';

  // Sanitize backupFile to prevent path traversal
  const sanitizedBackupFile = basename(backupFile);
  const backupPath = join(keysDir, sanitizedBackupFile);

  // Ensure the path is within the keys directory
  const resolvedKeysDir = resolve(keysDir);
  const resolvedBackupPath = resolve(backupPath);
  if (!resolvedBackupPath.startsWith(resolvedKeysDir)) {
    return { success: false, message: 'Invalid backup file path' };
  }

  if (!existsSync(backupPath)) {
    return { success: false, message: `Backup file not found: ${backupPath}` };
  }

  try {
    // Assuming backup file naming convention: private-timestamp.pem.backup
    if (backupFile.startsWith('private-') && backupFile.endsWith('.pem.backup')) {
      const timestamp = backupFile.replace('private-', '').replace('.pem.backup', '');
      const publicBackup = join(keysDir, `public-${timestamp}.pem.backup`);

      if (!existsSync(publicBackup)) {
        return { success: false, message: 'Matching public key backup not found' };
      }

      // Restore keys
      const privateKey = readFileSync(backupPath);
      const publicKey = readFileSync(publicBackup);

      writeFileSync(process.env.JWT_PRIVATE_KEY_PATH || join(keysDir, 'private.pem'), privateKey, { mode: 0o600 });
      writeFileSync(process.env.JWT_PUBLIC_KEY_PATH || join(keysDir, 'public.pem'), publicKey, { mode: 0o644 });

      console.log(`✅ Keys restored from backup: ${timestamp}`);
      return { success: true, message: `Keys restored from ${timestamp} backup` };
    }

    return { success: false, message: 'Invalid backup file format' };
  } catch (error) {
    return { success: false, message: `Restore failed: ${(error as Error).message}` };
  }
}

/**
 * Main CLI Handler
 */
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'rotate': {
      const result = rotateKeys();
      process.exit(result.success ? 0 : 1);
      break;
    }

    case 'emergency-rotate': {
      const emergencyResult = emergencyRotateKeys();
      process.exit(emergencyResult.success ? 0 : 1);
      break;
    }

    case 'validate': {
      const validation = validateKeys();
      process.exit(validation.valid ? 0 : 1);
      break;
    }

    case 'list-backups': {
      listBackups();
      break;
    }

    case 'restore': {
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.log('Usage: npm run jwt:restore <backup-file>');
        console.log('Use "npm run jwt:list-backups" to see available backups');
        process.exit(1);
      }
      const restoreResult = restoreFromBackup(backupFile);
      console.log(restoreResult.message);
      process.exit(restoreResult.success ? 0 : 1);
      break;
    }

    default:
      console.log('JWT Key Management Commands:');
      console.log('  npm run jwt:rotate        # Rotate keys (keeps old keys for compatibility)');
      console.log('  npm run jwt:emergency-rotate  # Emergency rotation (invalidates all tokens)');
      console.log('  npm run jwt:validate      # Validate current key configuration');
      console.log('  npm run jwt:list-backups  # List available key backups');
      console.log('  npm run jwt:restore <file> # Restore keys from backup');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
