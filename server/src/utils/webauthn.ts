// server/src/utils/webauthn.ts

import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { getSecret } from '../config/env.js';

/** Relying-party identity used for WebAuthn ceremonies and expected values. */
export const getRpConfig = (): { id: string; name: string; origin: string } => ({
  id: process.env.WEBAUTHN_RP_ID || 'localhost',
  name: process.env.WEBAUTHN_RP_NAME || 'Smart Health Management System',
  origin: process.env.WEBAUTHN_RP_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000'
});

/** Stable per-user WebAuthn user handle (derived, never random per ceremony). */
export const userHandleFor = (userId: string | number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(
    createHash('sha256').update(String(userId)).digest().subarray(0, 16).buffer.slice(0, 16) as ArrayBuffer
  );

/**
 * Stateless challenge transport: the challenge from the options generation is
 * signed into a short-lived JWT handed to the client; the verification step
 * recovers it from the returned token. Avoids in-memory challenge stores and
 * survives multi-instance deployments.
 */
const CHALLENGE_TTL_SECONDS = 5 * 60;

export const signChallenge = (challenge: string): string =>
  jwt.sign(
    { purpose: 'webauthn-challenge', challenge },
    getSecret('JWT_SECRET', 'dev-only-jwt-secret'),
    { expiresIn: CHALLENGE_TTL_SECONDS } as jwt.SignOptions
  );

export const verifyChallenge = (challengeToken: string): string | null => {
  try {
    const decoded = jwt.verify(challengeToken, getSecret('JWT_SECRET', 'dev-only-jwt-secret')) as {
      purpose?: string;
      challenge?: string;
    };
    if (decoded.purpose !== 'webauthn-challenge' || typeof decoded.challenge !== 'string') {
      return null;
    }
    return decoded.challenge;
  } catch {
    return null; // invalid signature or expired
  }
};

/** PASSLESS device-label sanitizer (server-side source of truth). */
export const sanitizeDeviceName = (raw: unknown, fallback = 'Passkey'): string => {
  if (typeof raw !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.trim().replace(/[\u0000-\u001F<>]/g, '').slice(0, 120);
  return cleaned || fallback;
};