import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { extractToken, hashToken, isTokenRevoked, markTokenRevoked } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import pool from '../config/database.js';
import { primaryFrontendOrigin } from '../config/runtime.js';
import { APP_NAME } from '../config/app.js';
import { sendEmail } from '../utils/mail.js';
import type { ResultSetHeader } from 'mysql2';
import { verifyToken as verifyTotp, generateSecret, base32Decode, generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode as recoveryCodeMatches } from '../utils/totp.js';
import { signToken, verifyToken } from '../config/tokens.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/** Fallback session lifetime used when a token carries no `exp` claim. */
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Lifetime of a password reset link. */
const RESET_TOKEN_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || '30', 10);

/** The single response every forgot-password request returns. */
const GENERIC_RESET_MESSAGE = 'If the email exists, a reset link has been sent';

/**
 * Password complexity policy, kept in step with the client-side meter
 * (`computePasswordStrength` in the frontend): the same five dimensions are
 * scored, and three of them have to be satisfied. The minimum length is
 * checked separately, because the frontend scores the length as one of the
 * five dimensions and would otherwise accept a four character password that
 * satisfies four character classes.
 */
export const meetsPasswordPolicy = (password: unknown): boolean => {
  if (typeof password !== 'string' || password.length < 8) {
    return false;
  }
  const classes = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  // Length plus two character classes is the same score of three the UI asks
  // for.
  return classes >= 2;
};

/** Minimal HTML escaping for values that end up in an email body. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');


export const login = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password } = req.body;

    // Get user from database (with affiliation hospital code for hospital scoping)
    const [users] = await pool.query(
      `SELECT u.*, h.hospital_id AS hospital_code
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.email = ?`,
      [email]
    );

    const user = (users as any[])[0];

    if (!user) {
      // A comparison is made anyway. Returning at once would answer in a
      // millisecond where a real answer takes a hundred, and the difference
      // says whether the address is registered.
      await bcrypt.compare(password, ABSENT_ACCOUNT_HASH);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // An account that is not active does not sign in. The check used to
    // refuse only an account that was locked with an end time, so a
    // suspended account, and an account an administrator had locked without
    // one, both signed in -- and the success path then set the status back
    // to active, quietly undoing the suspension.
    if (user.status !== 'active') {
      await bcrypt.compare(password, ABSENT_ACCOUNT_HASH);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // The attempt counter and the lock are one statement, so that parallel
      // attempts cannot all read the same starting value and all decide
      // that the limit has not been reached.
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
      // The lockout window is configuration, in milliseconds.
      const lockoutMs = parseInt(process.env.LOCKOUT_DURATION || '900000', 10);
      const lockedUntil = new Date(Date.now() + lockoutMs);
      await pool.query(
        `UPDATE users
            SET login_attempts = login_attempts + 1,
                status = IF(login_attempts + 1 >= ?, 'locked', status),
                locked_until = IF(login_attempts + 1 >= ?, ?, locked_until)
          WHERE id = ?`,
        [maxAttempts, maxAttempts, lockedUntil, user.id]
      );

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // The attempt counter is cleared and the last sign-in recorded. The
    // status is not written here: it is the account's own business, and
    // setting it here undid an administrator's suspension.
    await pool.query(
      'UPDATE users SET login_attempts = 0, last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Get role information
    const [roles] = await pool.query(
      'SELECT name FROM roles WHERE id = ?',
      [user.role_id]
    );
    const role = (roles as any[])[0]?.name || 'User';

    // Two-factor authentication check â€” when the user has a TOTP secret, do NOT
    // issue a full token yet. Only a short-lived temp token that gates the
    // verify-2fa endpoint; the full JWT is issued after the code checks out.
    if (user.totp_secret) {
      const tempToken = signToken(
        {
          id: user.id,
          email: user.email,
          role,
          hospital_id: user.hospital_code || undefined,
          hospital_ref: user.hospital_id ?? undefined,
          department_id: user.department_id != null ? String(user.department_id) : undefined,
          ver: Number(user.token_version ?? 0),
          mfa_pending: true
        },
        '5m'
      );

      return res.json({
        requiresMfa: true,
        tempToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role,
          hospital_id: user.hospital_code || undefined,
          totp_enabled: true,
          password_must_change: !!user.password_must_change
        }
      });
    }

    // Generate JWT token
    const token = signToken(
      {
        id: user.id,
        email: user.email,
        role,
        hospital_id: user.hospital_code || undefined,
        hospital_ref: user.hospital_id ?? undefined,
        department_id: user.department_id != null ? String(user.department_id) : undefined,
        ver: Number(user.token_version ?? 0),
      },
      JWT_EXPIRES_IN
    );

    const [perms] = await pool.query(
      'SELECT module, can_view, can_add, can_edit, can_delete FROM permissions WHERE role_id = ?',
      [user.role_id]
    );
    const permissions = (perms as any[]).flatMap((p) => {
      const list: string[] = [];
      if (p.can_view) list.push(`${p.module}:view`);
      if (p.can_add) list.push(`${p.module}:add`);
      if (p.can_edit) list.push(`${p.module}:edit`);
      if (p.can_delete) list.push(`${p.module}:delete`);
      return list;
    });

    // Determine password change requirement
    const mustChange = !!user.password_must_change;

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        hospital_id: user.hospital_code || undefined,
        permissions,
        totp_enabled: !!user.totp_secret,
        password_must_change: mustChange
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * The roles a person may give themselves when they register.
 *
 * Registration is self-service: anybody who can reach the sign-up page can
 * create an account. The role in the request used to be written straight
 * into the account, which meant that anybody could create themselves an
 * administrator â€” and an administrator sees every hospital's records.
 *
 * The role is therefore taken from this list, which is configuration, and a
 * role that is not on it is refused. The administrator roles are not on the
 * list by default; a deployment that wants them to be adds them, and that
 * deployment has to want it.
 */
const selfRegistrationRoles = (): string[] =>
  (process.env.REGISTRATION_ALLOWED_ROLES || 'doctor,nurse,pharmacist,patient')
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

/**
 * A hash to compare against when the account is not there.
 *
 * Comparing against nothing returns immediately, and comparing against a
 * hash takes about a hundred milliseconds. The difference tells a caller
 * whether the address is registered, so a comparison is made either way.
 */
const ABSENT_ACCOUNT_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7dJEbtLdRxGSxuTsvJiI.JLO9CLz0';

export const register = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password, name, roleId, hospital, department } = req.body;

    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Resolve the hospital/department names from the registration form into
    // their numeric IDs. Registration is self-service, so unknown names fail
    // gracefully to NULL instead of blocking the account.
    const [hospitalRows] = await pool.query(
      'SELECT id FROM hospitals WHERE name = ? LIMIT 1',
      [hospital ?? null]
    );
    const hospitalId = (hospitalRows as any[])[0]?.id ?? null;

    let departmentId: number | null = null;
    if (department) {
      const [deptRows] = await pool.query(
        'SELECT id FROM departments WHERE name = ? AND (hospital_id = ? OR ? IS NULL) LIMIT 1',
        [department, hospitalId, hospitalId]
      );
      departmentId = (deptRows as any[])[0]?.id ?? null;
    }

    // The role is a name, and it has to be one a person may give
    // themselves. A number is not a name and is not accepted: the number is
    // the role's key, and accepting it would let a caller pick any role in
    // the installation, including the ones that are not on the list.
    let resolvedRoleId: number | null = null;
    const requestedRole = String(roleId ?? '').trim().toLowerCase();
    const allowedRoles = selfRegistrationRoles();

    if (requestedRole) {
      if (!allowedRoles.includes(requestedRole)) {
        return res.status(400).json({ error: 'The selected role is not configured for this system.' });
      }
      const [roleRows] = await pool.query(
        'SELECT id FROM roles WHERE LOWER(name) = ? LIMIT 1',
        [requestedRole]
      );
      resolvedRoleId = Number((roleRows as any[])[0]?.id) || null;

      if (!resolvedRoleId) {
        return res.status(400).json({ error: 'The selected role is not configured for this system.' });
      }
    }

    // Hash password. The cost is configuration, so a deployment can raise it
    // without the cost of a hash and the cost of a newly created account
    // disagreeing.
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(password, bcryptRounds);

    // Create user
    //
    // The account is created inactive. It cannot sign in until somebody
    // with the authority to say so has said so, which is the only thing that
    // separates "somebody filled in a form" from "somebody works here". The
    // console activates the account, and the account has to change its
    // password when it first signs in.
    const [insertResult] = await pool.query<any>(
      'INSERT INTO users (email, password, name, role_id, hospital_id, department_id, status, password_must_change) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name, resolvedRoleId, hospitalId, departmentId, 'inactive', true]
    );

    res.status(201).json({
      message: 'Account created. It can sign in once an administrator has activated it.',
      userId: String(insertResult.insertId),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { token } = req.body as { token?: string };

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = verifyToken(token);

    // A token that is still waiting for its second factor is not a session
    // and cannot be exchanged for one. It used to be accepted here, which
    // meant that knowing somebody's password was enough to get a full
    // session for an account that has a second factor.
    if (decoded.mfa_pending) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // A token that was invalidated by logout cannot be refreshed back to life.
    if (await isTokenRevoked(hashToken(token))) {
      return res.status(401).json({ error: 'Session has been revoked' });
    }

    // The payload is rebuilt from the database instead of being copied from
    // the decoded token. Re-signing the decoded payload dropped hospital_id,
    // so a refreshed token lost its tenant scope and every scoped route
    // answered 403 "Missing hospital context". A client-supplied payload is
    // never trusted for the scope fields.
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role_id, u.department_id, u.status, u.token_version,
              r.name AS role, h.hospital_id AS hospital_code
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         LEFT JOIN hospitals h ON u.hospital_id = h.id
        WHERE u.id = ?`,
      [decoded.id]
    );

    const user = (rows as any[])[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // An account that has been suspended or locked does not get a new
    // session, however old the token it presented is.
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const newToken = signToken(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'User',
        hospital_id: user.hospital_code || undefined,
        hospital_ref: user.hospital_id ?? undefined,
        department_id: user.department_id != null ? String(user.department_id) : undefined,
        ver: Number(user.token_version ?? 0),
      },
      JWT_EXPIRES_IN
    );

    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Ends the session.
 *
 * The presented token is hashed and written to `revoked_tokens`, and the auth
 * middleware rejects revoked tokens from then on. Without this the JWT stayed
 * usable until its natural expiry, so "log out" only removed the token from
 * the browser.
 */
export const logout = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const token = extractToken(req);

    if (token) {
      const tokenHash = hashToken(token);
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + DEFAULT_SESSION_TTL_MS);

      await recordRevokedToken(tokenHash, req.user?.id ?? null, expiresAt);

      // Make the revocation effective immediately, without waiting for the
      // revocation cache to expire.
      markTokenRevoked(tokenHash);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to complete logout' });
  }
};

/**
 * Stores a token in the revocation list.
 *
 * `user_id` is a foreign key, so a token belonging to an account that no
 * longer exists is stored without the user reference rather than dropped.
 */
const recordRevokedToken = async (
  tokenHash: string,
  userId: string | null,
  expiresAt: Date
): Promise<void> => {
  try {
    await pool.query(
      'INSERT INTO revoked_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
      [tokenHash, userId, expiresAt]
    );
  } catch (error) {
    console.error(
      'Logout: could not link the revoked token to its user, retrying without it:',
      error instanceof Error ? error.message : String(error)
    );
    await pool.query(
      'INSERT INTO revoked_tokens (token_hash, user_id, expires_at) VALUES (?, NULL, ?)',
      [tokenHash, expiresAt]
    );
  }
};

/**
 * Sends the reset link.
 *
 * When SMTP is not configured the link cannot be delivered. Outside
 * production the link is printed so a developer can complete the flow; in
 * production the raw token is never written to a log (only the digest
 * prefix), because a log entry is not a safe place for a live credential.
 */
const deliverResetLink = async (params: {
  email: string;
  resetLink: string;
  rawToken: string;
  userId: number;
}): Promise<void> => {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);

  if (!smtpConfigured) {
    // The link is never written to the log. It carries a live token: anyone
    // who can read the log can take the account over, and a log is exactly
    // the sort of thing that is copied, kept and read by people who are not
    // the operator. The token's digest is recorded instead, which identifies
    // the reset without being one.
    console.error(
      '[auth] password reset requested but SMTP is not configured; the reset link was not delivered',
      { userId: params.userId, tokenHashPrefix: hashToken(params.rawToken).slice(0, 12) }
    );
    return;
  }

  const expiryMinutes = RESET_TOKEN_TTL_MINUTES;
  const safeEmail = escapeHtml(params.email);
  const safeLink = escapeHtml(params.resetLink);

  try {
    await sendEmail({
      to: params.email,
      subject: `${APP_NAME} password reset`,
      text: `A password reset was requested for your ${APP_NAME} account.\n\nReset link (valid for ${expiryMinutes} minutes):\n${params.resetLink}\n\nIf you did not request this, you can ignore this message.`,
      html: `<p>A password reset was requested for your ${APP_NAME} account.</p><p><a href="${safeLink}">Reset your password</a></p><p>This link is valid for ${expiryMinutes} minutes. If you did not request it, you can ignore this message.</p><p>Account: ${safeEmail}</p>`,
    });
  } catch (error) {
    // Delivery is best effort: the request was accepted and the generic
    // response has already been decided, so a mail outage must not turn
    // into a 500 that hints at whether the account exists.
    console.error(
      '[auth] password reset email delivery failed',
      { userId: params.userId, error: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email } = req.body as { email: string };

    // The role is read with the account so the recovery link can point at the
    // right surface. The tenant administrator recovers on their own pages;
    // patients and hospital staff recover on the clinical ones. The two
    // audiences share no URL, so a site owner never lands in the clinical
    // workstation's recovery flow.
    const [users] = await pool.query(
      `SELECT u.id, u.email, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.email = ? LIMIT 1`,
      [email]
    );

    const user = (users as any[])[0];

    // Always return success to prevent email enumeration: the response is
    // identical whether or not the account exists.
    if (!user) {
      return res.json({ message: GENERIC_RESET_MESSAGE });
    }

    // Cryptographically random token. `Math.random()` is not a CSPRNG, so
    // the reset links it produced were guessable.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // Only the digest is stored: the raw token exists solely in the email
    // the account owner receives.
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    // Any previous, still-unused reset link is invalidated first, so only
    // the most recent request can complete a reset.
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, tokenHash, expiresAt, (req as any).ip ?? null]
    );

    // The link points at the address the application is published at, so a
    // deployment does not have to be told about it twice.
    const frontendOrigin = primaryFrontendOrigin();
    if (!frontendOrigin) {
      throw new Error('FRONTEND_URL is not configured: the recovery link has nowhere to point.');
    }
    // The reset route is audience-specific, because the three audiences
    // recover on three separate pages: the platform site owner, the tenant
    // hospital administrator, and the clinical workforce. Sending a link to
    // the wrong one puts an administrator in a clinical form.
    const roleName = String(user.role_name ?? '').toLowerCase();
    const isSuperAdmin = roleName === 'super_admin' || roleName === 'super admin';
    const isHospitalAdmin = roleName === 'admin';
    const resetPath = isSuperAdmin
      ? '/auth/super-admin/reset-password'
      : isHospitalAdmin
        ? '/auth/admin/reset-password'
        : '/auth/reset-password';
    const resetLink = `${frontendOrigin}${resetPath}?token=${rawToken}`;

    await deliverResetLink({ email: user.email, resetLink, rawToken, userId: user.id });

    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!meetsPasswordPolicy(password)) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements' });
    }

    const tokenHash = hashToken(token.trim());

    const [rows] = await pool.query(
      `SELECT id, user_id, expires_at, used_at
         FROM password_resets
        WHERE token_hash = ?
        LIMIT 1`,
      [tokenHash]
    );

    const reset = (rows as any[])[0];

    if (!reset) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    if (reset.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    if (new Date(reset.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'This reset link has expired' });
    }

    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hashed = await bcrypt.hash(password as string, bcryptRounds);

    // Burn the token first. The conditional update makes the redemption
    // single-use even when two requests race for the same link.
    const [burned] = await pool.query<ResultSetHeader>(
      'UPDATE password_resets SET used_at = NOW() WHERE id = ? AND used_at IS NULL',
      [reset.id]
    );

    if (!burned.affectedRows) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    await pool.query(
      `UPDATE users
          SET password = ?,
              password_must_change = FALSE,
              password_changed_at = NOW(),
              password_postpone_count = 0,
              login_attempts = 0
        WHERE id = ?`,
      [hashed, reset.user_id]
    );

    // Clear an automatic lockout (failed-login timeout) but never an
    // administrator's explicit lock, which has no `locked_until`.
    await pool.query(
      `UPDATE users
          SET status = 'active', locked_until = NULL
        WHERE id = ?
          AND status = 'locked'
          AND locked_until IS NOT NULL
          AND locked_until > NOW()`,
      [reset.user_id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        reset.user_id,
        'password_reset',
        'auth',
        String(reset.user_id),
        JSON.stringify({ success: true }),
        (req as any).ip ?? null,
        req.headers['user-agent'] || '',
      ]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // users has no `role` column -- the role name lives in `roles`, joined via
    // role_id. Selecting `role` here threw ER_BAD_FIELD_ERROR, so changing a
    // password returned 500.
    const [rows] = await pool.query(
      `SELECT u.id, u.password, u.password_must_change, u.password_postpone_count, r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    const dbUser = (rows as any[])[0];
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validCurrent = await bcrypt.compare(currentPassword, dbUser.password);
    if (!validCurrent) {
      await pool.query(
        'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, 'password_change_attempt', 'auth', dbUser.id, JSON.stringify({ success: false, reason: 'invalid_current' }), (req as any).ip, req.headers['user-agent'] || '']
      );
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const complexity = {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword)
    };
    if (!Object.values(complexity).every(Boolean)) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password = ?, password_must_change = ?, password_changed_at = NOW(), password_postpone_count = 0 WHERE id = ?',
      [hashed, false, dbUser.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, 'password_change', 'auth', dbUser.id, JSON.stringify({ success: true }), (req as any).ip, req.headers['user-agent'] || '']
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

export const postponePasswordChange = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const MAX_POSTPONES = parseInt(process.env.PASSWORD_MAX_POSTPONES || '3');
    // Same nonexistent `role` column as in changePassword: join roles for the
    // name, since the super-admin check below needs it.
    const [rows] = await pool.query(
      `SELECT u.id, u.password_must_change, u.password_postpone_count, r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    const dbUser = (rows as any[])[0];
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Super Admins cannot postpone if default password must change
    if (dbUser.role === 'Super Admin' && dbUser.password_must_change) {
      return res.status(403).json({ error: 'Super Admins must change default password immediately' });
    }

    if (!dbUser.password_must_change) {
      return res.status(400).json({ error: 'No password change required' });
    }

    if (dbUser.password_postpone_count >= MAX_POSTPONES) {
      return res.status(403).json({ error: 'Postpone limit reached' });
    }

    await pool.query('UPDATE users SET password_postpone_count = password_postpone_count + 1 WHERE id = ?', [dbUser.id]);
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, 'password_change_postpone', 'auth', dbUser.id, JSON.stringify({ count: dbUser.password_postpone_count + 1 }), (req as any).ip, req.headers['user-agent'] || '']
    );
    res.json({ message: 'Password change postponed', remaining: MAX_POSTPONES - (dbUser.password_postpone_count + 1) });
  } catch (error) {
    console.error('Postpone password change error:', error);
    res.status(500).json({ error: 'Failed to postpone password change' });
  }
};

export const verifyTwoFactor = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body as { code: string };

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    const [users] = await pool.query(
      `SELECT u.*, h.hospital_id AS hospital_code
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    const user = (users as any[])[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.totp_secret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled for this account' });
    }

    // Constant-time TOTP verification (Â±1 Ã— 30 s step for clock skew)
    if (!verifyTotp(user.totp_secret, code)) {
      return res.status(401).json({ error: 'Invalid or expired authentication code' });
    }

    // Code verified â€” sign the full JWT and return the authenticated session.
    // Shared with the recovery-code verifier so both MFA paths behave identically.
    await issueMfaSuccessResponse(res, user);
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
};

/**
 * Shared success path for the MFA verification endpoints (TOTP, recovery
 * code, or passkey): looks up the role + permissions and issues the
 * full-scope JWT in the same shape as a direct password login, so the
 * frontend session is identical regardless of which verification path
 * authenticated it.
 */
export const issueMfaSuccessResponse = async (res: Response, user: any): Promise<void> => {
  const [roles] = await pool.query('SELECT name FROM roles WHERE id = ?', [user.role_id]);
  const role = (roles as any[])[0]?.name || 'User';

  const token = signToken(
    {
      id: user.id,
      email: user.email,
      role,
      hospital_id: user.hospital_code || undefined,
      hospital_ref: user.hospital_id ?? undefined,
      department_id: user.department_id != null ? String(user.department_id) : undefined,
      ver: Number(user.token_version ?? 0),
    },
    JWT_EXPIRES_IN
  );

  const [perms] = await pool.query(
    'SELECT module, can_view, can_add, can_edit, can_delete FROM permissions WHERE role_id = ?',
    [user.role_id]
  );
  const permissions = (perms as any[]).flatMap((p) => {
    const list: string[] = [];
    if (p.can_view) list.push(`${p.module}:view`);
    if (p.can_add) list.push(`${p.module}:add`);
    if (p.can_edit) list.push(`${p.module}:edit`);
    if (p.can_delete) list.push(`${p.module}:delete`);
    return list;
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      hospital_id: user.hospital_code || undefined,
      permissions,
      totp_enabled: true,
      password_must_change: !!user.password_must_change
    }
  });
};

/**
 * Verify a single-use recovery code issued at TOTP enrollment. Fallback access
 * for when the authenticator app is lost â€” shares the 2FA brute-force limiter.
 * On a match the code is burned (its hash removed) so each code works once,
 * then the full JWT is issued exactly as verify-2fa would.
 */
export const verifyRecovery = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body as { code: string };

    if (!code || !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(code)) {
      return res.status(400).json({ error: 'Recovery code must be in XXXXX-XXXXX format' });
    }

    const [users] = await pool.query(
      `SELECT u.*, h.hospital_id AS hospital_code
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    const user = (users as any[])[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.totp_secret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled for this account' });
    }

    const hashedCodes: string[] = Array.isArray(user.recovery_codes)
      ? user.recovery_codes
      : (() => {
          try {
            const parsed = JSON.parse(user.recovery_codes || '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();

    if (!hashedCodes.length) {
      return res.status(400).json({ error: 'No recovery codes are available for this account' });
    }

    if (!recoveryCodeMatches(hashedCodes, code)) {
      return res.status(401).json({ error: 'Invalid or already used recovery code' });
    }

    // Re-hash the submitted code and drop it from the stored list â†’ single-use,
    // so a replay of the same code is rejected even inside the limiter window.
    const burned = hashRecoveryCode(code);
    const remaining = hashedCodes.filter((h) => h !== burned);
    await pool.query('UPDATE users SET recovery_codes = ? WHERE id = ?', [JSON.stringify(remaining), req.user.id]);

    await logMfaEvent(req, 'mfa_recovery_used', { remaining: remaining.length });

    await issueMfaSuccessResponse(res, user);
  } catch (error) {
    console.error('Recovery code verification error:', error);
    res.status(500).json({ error: 'Failed to verify recovery code' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [users] = await pool.query(
      'SELECT u.id, u.email, u.name, u.role_id, u.password_must_change, u.totp_secret, u.hospital_id, r.name as role_name, h.hospital_id AS hospital_code FROM users u LEFT JOIN roles r ON u.role_id = r.id LEFT JOIN hospitals h ON u.hospital_id = h.id WHERE u.id = ?',
      [req.user.id]
    );
    const user = (users as any[])[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [perms] = await pool.query(
      'SELECT module, can_view, can_add, can_edit, can_delete FROM permissions WHERE role_id = ?',
      [user.role_id]
    );
    const permissions = (perms as any[]).flatMap((p) => {
      const list: string[] = [];
      if (p.can_view) list.push(`${p.module}:view`);
      if (p.can_add) list.push(`${p.module}:add`);
      if (p.can_edit) list.push(`${p.module}:edit`);
      if (p.can_delete) list.push(`${p.module}:delete`);
      return list;
    });

    // Recovery codes are stored as hashes only, so the count (not the values)
    // is exposed for the settings UI; codes themselves are shown once at setup.
    const recoveryCodesCount = (() => {
      if (!user.recovery_codes) return 0;
      try {
        const parsed = JSON.parse(user.recovery_codes);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    })();

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name || 'User',
        hospital_id: user.hospital_code || undefined,
        permissions,
        totp_enabled: !!user.totp_secret,
        recovery_codes_count: recoveryCodesCount,
        password_must_change: !!user.password_must_change
      }
    });
  } catch {
    console.error('Get me error');
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/** Shared audit trail helper for 2FA lifecycle events. */
const logMfaEvent = async (req: AuthRequest, action: string, payload: Record<string, unknown>) => {
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user?.id || null, action, 'auth', req.user?.id || null, JSON.stringify(payload), (req as any).ip, req.headers['user-agent'] || '']
  );
};

/**
 * Per-user MFA lifecycle audit trail (self-service, read-only). Returns only
 * the caller's own 2FA events â€” enrollment/rotation, disable, and
 * recovery-code use â€” newest first. `new_value` is returned both raw and
 * parsed so the frontend can render friendly labels.
 */
export const getMfaEvents = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const [rows] = await pool.query(
      `SELECT id, action, new_value, ip_address, created_at
       FROM audit_logs
       WHERE user_id = ? AND module = 'auth'
         AND action IN ('mfa_totp_changed', 'mfa_totp_disabled', 'mfa_recovery_used')
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    const events = (rows as any[]).map((row) => {
      let details: unknown;
      try {
        details = row.new_value ? JSON.parse(row.new_value) : null;
      } catch {
        details = null;
      }
      return {
        id: row.id,
        action: row.action,
        details,
        ip: row.ip_address,
        createdAt: row.created_at
      };
    });
    res.json({ events });
  } catch (error) {
    console.error('Fetch MFA events error:', error);
    res.status(500).json({ error: 'Failed to fetch MFA events' });
  }
};

/**
 * Generate a fresh TOTP secret for authenticator pairing. Stateless â€” the
 * secret is returned but NOT persisted; /totp/confirm proves possession of
 * the new key first. Works both for first-time enrollment and rotation.
 */
export const totpEnroll = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const secret = generateSecret();
    const otpauthUrl = `otpauth://totp/SmartHealth:${encodeURIComponent(req.user.email)}?secret=${secret}&issuer=SmartHealth&algorithm=SHA1&digits=6&period=30`;

    res.json({ secret, otpauthUrl });
  } catch (error) {
    console.error('TOTP enroll error:', error);
    res.status(500).json({ error: 'Failed to generate authenticator secret' });
  }
};

/**
 * Verify a code against a freshly generated (or existing) secret and persist
 * it, enabling 2FA or rotating the current key. The code proves the caller
 * controls the authenticator app for the new secret.
 */
export const totpConfirm = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { secret, code } = req.body as { secret: string; code: string };

    if (!secret || !code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Sanity-check the secret is base32-decodable before treating it as a key.
    try {
      base32Decode(secret.trim());
    } catch {
      return res.status(400).json({ error: 'Invalid secret key' });
    }

    if (!verifyTotp(secret.trim(), code)) {
      return res.status(401).json({ error: 'Invalid or expired authentication code' });
    }

    const recoveryCodes = generateRecoveryCodes(10);
    const recovered = recoveryCodes.map(hashRecoveryCode);
    await pool.query('UPDATE users SET totp_secret = ?, recovery_codes = ? WHERE id = ?', [
      secret.trim(),
      JSON.stringify(recovered),
      req.user.id,
    ]);
    await logMfaEvent(req, 'mfa_totp_changed', { enabled: true, recovery_codes: recovered.length });

    // Recovery codes are returned in cleartext exactly once â€” from this
    // moment only their hashes exist in the database. Rotating the key
    // regenerates a fresh set and invalidates the previous one.
    res.json({ enabled: true, recoveryCodes });
  } catch (error) {
    console.error('TOTP confirm error:', error);
    res.status(500).json({ error: 'Failed to enable two-factor authentication' });
  }
};

/**
 * Remove two-factor by verifying a current code against the stored secret â€”
 * possession of the authenticator app is required before disabling.
 */
export const totpDisable = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body as { code: string };
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    const [rows] = await pool.query('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);
    const user = (rows as any[])[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.totp_secret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled for this account' });
    }

    if (!verifyTotp(user.totp_secret, code)) {
      return res.status(401).json({ error: 'Invalid or expired authentication code' });
    }

    await pool.query('UPDATE users SET totp_secret = NULL, recovery_codes = NULL WHERE id = ?', [req.user.id]);
    await logMfaEvent(req, 'mfa_totp_disabled', { enabled: false });

    res.json({ enabled: false });
  } catch (error) {
    console.error('TOTP disable error:', error);
    res.status(500).json({ error: 'Failed to disable two-factor authentication' });
  }
};
