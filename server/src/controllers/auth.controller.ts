import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { getSecret } from '../config/env.js';
import { verifyToken, currentToken, generateSecret, base32Decode, generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode as recoveryCodeMatches } from '../utils/totp.js';

const JWT_SECRET = getSecret('JWT_SECRET', 'dev-only-jwt-secret'); // Hard-fails in production when unset
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.status === 'locked' && user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account is locked. Please try again later.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Increment login attempts
      await pool.query(
        'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?',
        [user.id]
      );

      // Lock account if max attempts reached
      if (user.login_attempts + 1 >= 5) {
        const lockoutDuration = 15; // minutes
        const lockedUntil = new Date(Date.now() + lockoutDuration * 60000);
        await pool.query(
          'UPDATE users SET status = ?, locked_until = ? WHERE id = ?',
          ['locked', lockedUntil, user.id]
        );
      }

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset login attempts and update last login
    await pool.query(
      'UPDATE users SET login_attempts = 0, status = ?, last_login = NOW() WHERE id = ?',
      ['active', user.id]
    );

    // Get role information
    const [roles] = await pool.query(
      'SELECT name FROM roles WHERE id = ?',
      [user.role_id]
    );
    const role = (roles as any[])[0]?.name || 'User';

    // Two-factor authentication check — when the user has a TOTP secret, do NOT
    // issue a full token yet. Only a short-lived temp token that gates the
    // verify-2fa endpoint; the full JWT is issued after the code checks out.
    if (user.totp_secret) {
      const tempToken = jwt.sign(
        { id: user.id, email: user.email, role, hospital_id: user.hospital_code || undefined, mfa_pending: true },
        JWT_SECRET,
        { expiresIn: '5m' } as jwt.SignOptions
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
    const token = jwt.sign(
      { id: user.id, email: user.email, role, hospital_id: user.hospital_code || undefined },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
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

    // Registration submits the role's canonical name from the UI, while the
    // database stores its numeric foreign key. Resolve either representation
    // before the insert so a valid staff registration never creates an
    // unassigned account or attempts to write a string into a BIGINT column.
    let resolvedRoleId: number | null = null;
    if (roleId !== undefined && roleId !== null && String(roleId).trim()) {
      const numericRoleId = Number(roleId);
      if (Number.isSafeInteger(numericRoleId) && numericRoleId > 0) {
        resolvedRoleId = numericRoleId;
      } else {
        const [roleRows] = await pool.query(
          'SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1',
          [String(roleId).trim()]
        );
        resolvedRoleId = Number((roleRows as any[])[0]?.id) || null;
      }

      if (!resolvedRoleId) {
        return res.status(400).json({ error: 'The selected role is not configured for this system.' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [insertResult] = await pool.query<any>(
      'INSERT INTO users (email, password, name, role_id, hospital_id, department_id, password_must_change) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name, resolvedRoleId, hospitalId, departmentId, true]
    );

    res.status(201).json({ message: 'User registered successfully', userId: String(insertResult.insertId) });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  // In a production app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
};

export const forgotPassword = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email } = req.body;

    // Check if user exists
    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    const user = (users as any[])[0];

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // Generate reset token (in production, use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15);
    // const resetExpires = new Date(Date.now() + 3600000); // 1 hour - would be used in production

    // Store reset token (you'd need a password_resets table in production)
    // For now, we'll just log it
    console.log(`Reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: http://localhost:5173/reset-password?token=${resetToken}`);

    // In production, send email here
    // await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch {
    console.error('Forgot password error');
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    void _req;
    // Disable unauthenticated reset in favor of change-password after login
    return res.status(403).json({ error: 'Password reset disabled. Please login and change your password.' });
  } catch {
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

    const [rows] = await pool.query('SELECT id, password, role, password_must_change, password_postpone_count FROM users WHERE id = ?', [req.user.id]);
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
    const [rows] = await pool.query('SELECT id, password_must_change, password_postpone_count, role FROM users WHERE id = ?', [req.user.id]);
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

    // Constant-time TOTP verification (±1 × 30 s step for clock skew)
    if (!verifyToken(user.totp_secret, code)) {
      return res.status(401).json({ error: 'Invalid or expired authentication code' });
    }

    // Code verified — sign the full JWT and return the authenticated session.
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

  const token = jwt.sign(
    { id: user.id, email: user.email, role, hospital_id: user.hospital_code || undefined },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
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
 * for when the authenticator app is lost — shares the 2FA brute-force limiter.
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

    // Re-hash the submitted code and drop it from the stored list → single-use,
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

/**
 * DEV-ONLY helper used by the demo auto-fill buttons on the login and 2FA
 * pages. Returns the *currently valid* TOTP code for the seeded demo user so
 * the demo stays one-click without weakening the real verification path.
 * The route guard lives in auth.routes.ts (never mounted in production).
 */
export const devCurrentTotp = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    res.json({ code: currentToken('GEZDGNBVGY3TQOJQ') });
  } catch (error) {
    console.error('dev-totp-current error:', error);
    res.status(500).json({ error: 'Failed to compute demo code' });
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
 * the caller's own 2FA events — enrollment/rotation, disable, and
 * recovery-code use — newest first. `new_value` is returned both raw and
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
 * Generate a fresh TOTP secret for authenticator pairing. Stateless — the
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

    if (!verifyToken(secret.trim(), code)) {
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

    // Recovery codes are returned in cleartext exactly once — from this
    // moment only their hashes exist in the database. Rotating the key
    // regenerates a fresh set and invalidates the previous one.
    res.json({ enabled: true, recoveryCodes });
  } catch (error) {
    console.error('TOTP confirm error:', error);
    res.status(500).json({ error: 'Failed to enable two-factor authentication' });
  }
};

/**
 * Remove two-factor by verifying a current code against the stored secret —
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

    if (!verifyToken(user.totp_secret, code)) {
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
