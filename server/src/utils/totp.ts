/**
 * RFC 6238 TOTP utility — pure Node crypto, zero external dependencies.
 *
 * Default parameters match the Google Authenticator / Authy standard:
 *   HMAC-SHA1, 30 s period, 6-digit code, ±1 step window tolerance.
 */

import crypto from 'crypto';

const DIGITS = 6;
const PERIOD = 30; // seconds
const WINDOW = 1; // number of steps before/after current for clock-skew tolerance

/* ── Base32 helpers ─────────────────────────────────────────────── */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  // Pad to multiple of 5
  while (bits.length % 5 !== 0) bits += '0';
  return bits
    .match(/.{5}/g)!
    .map((chunk) => BASE32_ALPHABET[parseInt(chunk, 2)])
    .join('');
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s=]+/g, '');
  let bits = '';
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

/* ── TOTP core ──────────────────────────────────────────────────── */

function intToBytes(n: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(n >>> 0, 4);
  return buf;
}

/** Generate the 6-digit TOTP string for a given secret and time step. */
function generateForStep(secret: string, timeStep: number): string {
  const key = base32Decode(secret);
  const data = intToBytes(timeStep);
  const hmac = crypto.createHmac('sha1', key).update(data).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/**
 * Return the TOTP code that is valid *right now*.
 * Used by the DEV-only endpoint so the demo auto-fill always works.
 */
export function currentToken(secret: string): string {
  const step = Math.floor(Date.now() / 1000 / PERIOD);
  return generateForStep(secret, step);
}

/**
 * Verify a submitted token against the stored secret.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing side-channels and
 * checks ±1 time-step window (±30 s) to tolerate minor clock skew.
 */
export function verifyToken(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  const now = Math.floor(Date.now() / 1000 / PERIOD);
  const tokenBuffer = Buffer.from(token);

  for (let i = -WINDOW; i <= WINDOW; i++) {
    const expected = generateForStep(secret, now + i);
    const expectedBuffer = Buffer.from(expected);
    if (tokenBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
      return true;
    }
  }
  return false;
}

/** Generate a random 20-byte TOTP secret (base32-encoded, 32 chars). */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}
