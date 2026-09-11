// server/src/controllers/webauthn.controller.ts

import type { Request, Response } from 'express';
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import {
  getRpConfig,
  userHandleFor,
  signChallenge,
  verifyChallenge,
  sanitizeDeviceName
} from '../utils/webauthn.js';
import { issueMfaSuccessResponse } from './auth.controller.js';

const bufferToBase64url = (buffer: Uint8Array | Buffer): string =>
  Buffer.from(buffer).toString('base64url');

const base64urlToBuffer = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(Buffer.from(value, 'base64url'));

const uint8ToArrayBuffer = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
};

const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && /.+@.+\..+/.test(value);

interface WebAuthnRow extends RowDataPacket {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string;
  transports: string | null;
  created_at: Date;
  last_used_at: Date | null;
}

/** POST /api/auth/webauthn/register/options — signed-in user starts a passkey ceremony. */
export const registerOptions = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const rp = getRpConfig();
    const options = await generateRegistrationOptions({
      rpName: rp.name,
      rpID: rp.id,
      userName: req.user.email,
      userDisplayName: req.user.email.split('@')[0] || 'User',
      userID: userHandleFor(req.user.id),
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'preferred'
      },
      supportedAlgorithmIDs: [-7, -257],
      timeout: 60_000
    });

    res.json({ options, challengeToken: signChallenge(options.challenge) });
  } catch (error) {
    console.error('webauthn registerOptions failed:', error);
    return res.status(500).json({ error: 'Could not prepare passkey registration' });
  }
};

/** POST /api/auth/webauthn/register/verify — persist the attested credential. */
export const registerVerify = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { registration, challengeToken, deviceName } = req.body as {
      registration?: RegistrationResponseJSON;
      challengeToken?: string;
      deviceName?: unknown;
    };
    if (!registration || typeof challengeToken !== 'string') {
      return res.status(400).json({ error: 'Invalid registration request' });
    }

    const expectedChallenge = verifyChallenge(challengeToken);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Challenge is invalid or has expired. Please try again.' });
    }

    const rp = getRpConfig();
    const verification = await verifyRegistrationResponse({
      response: registration,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey attestation could not be verified.' });
    }

    const { credential } = verification.registrationInfo;
    // v14 returns the base64url credential id directly; counter lives on the credential.
    const credentialId = credential.id;
    const publicKey = bufferToBase64url(credential.publicKey);
    const registeredCounter = credential.counter;

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM webauthn_credentials WHERE credential_id = ?',
      [credentialId]
    );
    if (existing[0]) {
      return res.status(409).json({ error: 'This passkey is already registered on your account.' });
    }

    const transports = Array.isArray(registration?.response?.transports)
      ? JSON.stringify(registration.response.transports)
      : null;

    await pool.query(
      `INSERT INTO webauthn_credentials
         (user_id, credential_id, public_key, counter, device_name, transports)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, credentialId, publicKey, registeredCounter, sanitizeDeviceName(deviceName), transports]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address, user_agent)
       VALUES (?, 'mfa_passkey_registered', 'auth', ?, ?, ?)`,
      [
        req.user.id,
        JSON.stringify({ device: sanitizeDeviceName(deviceName) }),
        req.ip ?? null,
        req.get('user-agent') ?? null
      ]
    );

    res.status(201).json({ message: 'Passkey registered successfully' });
  } catch (error) {
    console.error('webauthn registerVerify failed:', error);
    return res.status(500).json({ error: 'Could not verify passkey registration' });
  }
};

/** POST /api/auth/webauthn/login/options — unauthenticated, email identifies the account. */
export const loginOptions = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email } = req.body as { email?: unknown };
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'No account found for that email' });

    const [credRows] = await pool.query<WebAuthnRow[]>(
      'SELECT credential_id FROM webauthn_credentials WHERE user_id = ?',
      [user.id]
    );
    if (credRows.length === 0) {
      return res.status(400).json({ error: 'This account has no registered passkeys' });
    }

    const rp = getRpConfig();
    const options = await generateAuthenticationOptions({
      rpID: rp.id,
      allowCredentials: credRows.map((c) => ({ id: c.credential_id, type: 'public-key' })),
      userVerification: 'preferred',
      timeout: 60_000
    });

    res.json({ options, challengeToken: signChallenge(options.challenge) });
  } catch (error) {
    console.error('webauthn loginOptions failed:', error);
    return res.status(500).json({ error: 'Could not prepare passkey login' });
  }
};

/** POST /api/auth/webauthn/login/verify — mfa_pending token holder asserts a passkey. */
export const loginVerify = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { assertion, challengeToken } = req.body as {
      assertion?: AuthenticationResponseJSON;
      challengeToken?: string;
    };
    if (!assertion || typeof challengeToken !== 'string') {
      return res.status(400).json({ error: 'Invalid authentication request' });
    }

    const expectedChallenge = verifyChallenge(challengeToken);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Challenge is invalid or has expired. Please try again.' });
    }

    const [credRows] = await pool.query<WebAuthnRow[]>(
      'SELECT * FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?',
      [assertion.id, req.user.id]
    );
    const credentialRow = credRows[0];
    if (!credentialRow) {
      return res.status(401).json({ error: 'No matching passkey for this account' });
    }

    const rp = getRpConfig();
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      credential: {
        id: credentialRow.credential_id,
        publicKey: uint8ToArrayBuffer(base64urlToBuffer(credentialRow.public_key)),
        counter: Number(credentialRow.counter),
        transports: credentialRow.transports ? JSON.parse(credentialRow.transports) : undefined
      }
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Passkey assertion could not be verified.' });
    }

    const { authenticationInfo } = verification;
    await pool.query(
      'UPDATE webauthn_credentials SET counter = ?, last_used_at = NOW() WHERE id = ?',
      [authenticationInfo.newCounter, credentialRow.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address, user_agent)
       VALUES (?, 'mfa_passkey_used', 'auth', ?, ?, ?)`,
      [
        req.user.id,
        JSON.stringify({ device: credentialRow.device_name }),
        req.ip ?? null,
        req.get('user-agent') ?? null
      ]
    );

    // Refresh the user row so the session payload is current, then issue the
    // full-scope JWT exactly like TOTP/recovery verification does.
    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT u.*, h.hospital_id AS hospital_code
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    const userRow = users[0];
    if (!userRow) return res.status(404).json({ error: 'User not found' });

    await issueMfaSuccessResponse(res, userRow);
  } catch (error) {
    console.error('webauthn loginVerify failed:', error);
    return res.status(500).json({ error: 'Could not verify passkey authentication' });
  }
};

/** GET /api/auth/webauthn/credentials — list the caller's passkeys. */
export const listCredentials = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, credential_id, device_name, created_at, last_used_at
       FROM webauthn_credentials
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ credentials: rows });
  } catch (error) {
    console.error('webauthn listCredentials failed:', error);
    return res.status(500).json({ error: 'Could not load passkeys' });
  }
};

/** DELETE /api/auth/webauthn/credentials/:id — remove one of the caller's passkeys. */
export const deleteCredential = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const credentialId = Number(req.params.id);
    if (!Number.isInteger(credentialId) || credentialId <= 0) {
      return res.status(400).json({ error: 'Invalid passkey id' });
    }

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?',
      [credentialId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Passkey not found' });
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address, user_agent)
       VALUES (?, 'mfa_passkey_removed', 'auth', ?, ?, ?)`,
      [req.user.id, JSON.stringify({ credentialId }), req.ip ?? null, req.get('user-agent') ?? null]
    );

    res.json({ message: 'Passkey removed' });
  } catch (error) {
    console.error('webauthn deleteCredential failed:', error);
    return res.status(500).json({ error: 'Could not remove passkey' });
  }
};