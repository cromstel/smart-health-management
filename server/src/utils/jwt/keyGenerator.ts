/**
 * JWT Key Generation Utilities
 * Provides secure key generation for JWT tokens
 * Author: Security Team
 * Created: 2024-11-24
 */

import { generateKeyPairSync, randomBytes } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Generate HS256 Symmetric Key
 */
export function generateHS256Key(length: number = 64): { secret: string; base64: string } {
  const secret = randomBytes(length);
  const base64 = secret.toString('base64');

  console.log('Generated HS256 Secret Key:');
  console.log(`Length: ${length} bytes`);
  console.log(`Base64: ${base64}`);
  console.log('\n⚠️  IMPORTANT: Store this key securely. Never commit to version control.');

  return { secret: secret.toString('hex'), base64 };
}

/**
 * Generate RSA Key Pair for RS256
 */
export function generateRSAKeyPair(modulusLength: number = 4096): {
  publicKey: string;
  privateKey: string;
  kid: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const kid = randomBytes(16).toString('hex');

  console.log('Generated RSA Key Pair for RS256:');
  console.log(`Key ID: ${kid}`);
  console.log(`Modulus Length: ${modulusLength} bits`);
  console.log('\n⚠️  IMPORTANT: Store private key securely. Never commit to version control.');

  return { publicKey, privateKey, kid };
}

/**
 * Save RSA Keys to Files
 */
export function saveRSAKeys(directory: string = './keys', modulusLength: number = 4096): void {
  const keysDir = join(process.cwd(), directory);

  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true });
  }

  const { publicKey, privateKey } = generateRSAKeyPair(modulusLength);

  const privateKeyPath = join(keysDir, 'private.pem');
  const publicKeyPath = join(keysDir, 'public.pem');

  writeFileSync(privateKeyPath, privateKey, { mode: 0o600 }); // Read/write for owner only
  writeFileSync(publicKeyPath, publicKey, { mode: 0o644 }); // Read for all, write for owner

  console.log(`\n✅ RSA Keys saved to:`);
  console.log(`Private Key: ${privateKeyPath}`);
  console.log(`Public Key: ${publicKeyPath}`);
  console.log('\n🔒 File permissions set for security.');

  // Generate sample .env entries
  console.log('\n📝 Add these to your .env file:');
  console.log(`JWT_ALGORITHM=RS256`);
  console.log(`JWT_PRIVATE_KEY_PATH=${privateKeyPath}`);
  console.log(`JWT_PUBLIC_KEY_PATH=${publicKeyPath}`);
}

/**
 * Main CLI Handler
 */
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'generate-hs256': {
      const length = parseInt(process.argv[3]) || 64;
      generateHS256Key(length);
      break;
    }

    case 'generate-rsa': {
      const modulusLength = parseInt(process.argv[3]) || 4096;
      saveRSAKeys('./keys', modulusLength);
      break;
    }

    default:
      console.log('Usage:');
      console.log('  npm run jwt:generate-key          # Generate HS256 key');
      console.log('  npm run jwt:generate-key <length> # Generate HS256 key with custom length');
      console.log('  npm run jwt:generate-rsa          # Generate RSA key pair');
      console.log('  npm run jwt:generate-rsa <bits>   # Generate RSA key pair with custom modulus');
      process.exit(1);
  }
}

// In ES modules, we check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
