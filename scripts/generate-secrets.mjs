#!/usr/bin/env node
/**
 * Generates cryptographically random hex keys for SHMS secrets.
 * Node.js built-ins only — no dependencies.
 *
 * Usage:
 *   node scripts/generate-secrets.mjs             # JWT_SECRET (64 bytes / 512 bits)
 *   node scripts/generate-secrets.mjs --bytes 32  # custom length (min 32 bytes / 256 bits)
 *   node scripts/generate-secrets.mjs --all       # JWT_SECRET + SESSION_SECRET + ENCRYPTION_KEY + ENCRYPTION_IV
 *
 * Recommendation: at least 256 bits (32 bytes); 64 bytes is a good default.
 *      - JWT_SECRET / SESSION_SECRET: any length >= 32 bytes (hex encoded)
 *      - ENCRYPTION_KEY: exactly 32 bytes (aes-256-cbc key), hex encoded
 *      - ENCRYPTION_IV:  exactly 16 bytes (aes-256-cbc IV), hex encoded
 */
import { randomBytes } from 'node:crypto';

const MIN_BYTES = 32; // 256 bits
const DEFAULT_BYTES = 64; // 512 bits

const args = process.argv.slice(2);

const bytesEquals = (args.find((a) => a.startsWith('--bytes=')) ?? '').split('=')[1];
const bytesSpace = args.indexOf('--bytes') !== -1 ? args[args.indexOf('--bytes') + 1] : undefined;
const bytesRaw = bytesSpace ?? bytesEquals;
const bytes = bytesRaw ? Number.parseInt(bytesRaw, 10) : DEFAULT_BYTES;
const all = args.includes('--all');

if (!Number.isInteger(bytes) || bytes < MIN_BYTES) {
  console.error(`--bytes must be an integer >= ${MIN_BYTES} (got: ${String(bytesRaw)})`);
  console.error('Example: node scripts/generate-secrets.mjs --bytes 32');
  process.exit(1);
}

const hex = (n) => randomBytes(n).toString('hex');
const stamp = `# Generated ${new Date().toISOString()}`;

if (all) {
  console.log(stamp);
  console.log('# Paste into .env.local / server environment, then delete this block.');
  console.log(`# JWT_SECRET / SESSION_SECRET: ${bytes * 8} bits (min 256; default 512 is recommended)`);
  console.log(`JWT_SECRET=${hex(bytes)}`);
  console.log(`SESSION_SECRET=${hex(bytes)}`);
  console.log('# ENCRYPTION_KEY must be exactly 32 bytes (256 bits) for aes-256-cbc');
  console.log(`ENCRYPTION_KEY=${hex(32)}`);
  console.log('# ENCRYPTION_IV must be exactly 16 bytes (128 bits) for aes-256-cbc');
  console.log(`ENCRYPTION_IV=${hex(16)}`);
} else {
  console.log('# JWT_SECRET only. Use --all for the full set, or --bytes N to change length.');
  console.log(stamp);
  console.log(`# ${bytes * 8} bits (${bytes} bytes) — paste into server .env, then delete this block.`);
  console.log(`JWT_SECRET=${hex(bytes)}`);
}