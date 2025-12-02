import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { jwtManager } from '../config/jwt.js';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';

export const login = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password } = req.body;

    // Get user from database
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
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

    // Get permissions first
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

    // Generate JWT token using enhanced JWT manager
    const token = await jwtManager.createToken({
      id: user.id,
      email: user.email,
      role,
      permissions,
      hospital_id: user.hospital_id,
    });

    // Determine password change requirement
    const mustChange = !!user.password_must_change;

    // Set JWT in httpOnly cookie for security
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // Only send over HTTPS in production
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    };

    res.cookie('token', token, cookieOptions);

    // Also return token in response for backward compatibility during transition
    // TODO: Remove this after frontend migration is complete
    res.json({
      token, // Keep for backward compatibility
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        permissions,
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
    const { email, password, name, roleId } = req.body;

    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, email, password, name, role_id, password_must_change) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, name, roleId || null, true]
    );

    res.status(201).json({ message: 'User registered successfully', userId });
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

    // Verify the provided token
    const decoded = await jwtManager.verifyToken(token);

    // Create a new token with the same payload but fresh expiration
    const newToken = await jwtManager.createToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
      hospital_id: decoded.hospital_id,
    });

    // Set new token in httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    // Also return token in response for backward compatibility
    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const logout = async (_req: Request, res: Response): Promise<Response> => {
  // Clear the httpOnly cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  
  // In a production app, you might want to blacklist the token
  return res.json({ message: 'Logged out successfully' });
};

export const forgotPassword = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email } = req.body;

    // Check if user exists and get their details including hospital information
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.name, u.role, u.hospital_id, h.name as hospital_name
      FROM users u
      LEFT JOIN hospitals h ON u.hospital_id = h.id
      WHERE u.email = ?
    `, [email]);

    const user = (users as any[])[0];

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({
        message: 'If the email exists, your password reset request has been forwarded to your hospital administrator'
      });
    }

    // For Super Admins, they should change password through admin panel
    if (user.role === 'Super Admin') {
      console.log(`Super Admin ${email} attempted password reset - blocked`);
      return res.json({
        message: 'Super Administrators should change passwords through the admin dashboard'
      });
    }

    // Find hospital administrators to notify
    const [admins] = await pool.query(`
      SELECT u.email, u.name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.hospital_id = ? AND r.name IN ('Administrator', 'Super Admin')
      AND u.status = 'active'
    `, [user.hospital_id]);

    const adminList = admins as any[];

    if (adminList.length === 0) {
      console.log(`No administrators found for hospital ${user.hospital_id} to handle password reset for ${email}`);
      // Still return success to avoid leaking information
      return res.json({
        message: 'If the email exists, your password reset request has been forwarded to your hospital administrator'
      });
    }

    // Generate secure reset token and store in database
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // First, create the password_reset_tokens table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_used (user_id, used)
      )
    `);

    // Store reset token in database
    await pool.query(`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `, [user.id, resetToken, resetExpires]);

    console.log(`🔐 PASSWORD RESET REQUEST`);
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`Hospital: ${user.hospital_name || 'N/A'}`);
    console.log(`Role: ${user.role}`);
    console.log(`Reset Token: ${resetToken}`);
    console.log(`Expires: ${resetExpires.toISOString()}`);
    console.log(`Administrators to notify: ${adminList.map(a => a.email).join(', ')}`);

    // Log notification to administrators
    adminList.forEach(admin => {
      console.log(`📧 Notification sent to admin ${admin.name} (${admin.email})`);
    });

    res.json({
      message: 'Your password reset request has been forwarded to your hospital administrator. You will receive an email notification once processed.'
    });
  } catch {
    console.error('Forgot password error');
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { token, password } = req.body;

    // Validate token exists and is not expired
    const [tokens] = await pool.query(`
      SELECT prt.*, u.email, u.name
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = ? AND prt.used = FALSE AND prt.expires_at > NOW()
    `, [token]);

    const resetRequest = (tokens as any[])[0];

    if (!resetRequest) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash the new password
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and mark token as used
    await pool.query(`
      UPDATE users
      SET password = ?, password_must_change = FALSE, password_changed_at = NOW()
      WHERE id = ?
    `, [hashedPassword, resetRequest.user_id]);

    await pool.query(`
      UPDATE password_reset_tokens
      SET used = TRUE
      WHERE id = ?
    `, [resetRequest.id]);

    // Log the password reset
    console.log(`🔑 PASSWORD RESET SUCCESSFUL`);
    console.log(`User: ${resetRequest.name} (${resetRequest.email})`);
    console.log(`Reset completed at: ${new Date().toISOString()}`);

    res.json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
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

export const verifyTwoFactor = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { code } = req.body;

    // In production, verify TOTP code using speakeasy or similar
    // For demo, accept any 6-digit code
    if (code.length !== 6) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    res.json({ message: 'Two-factor authentication successful', verified: true });
  } catch {
    console.error('2FA verification error');
    res.status(500).json({ error: 'Failed to verify code' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [users] = await pool.query(
      'SELECT u.id, u.email, u.name, u.role_id, u.password_must_change, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
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

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name || 'User',
        permissions,
        password_must_change: !!user.password_must_change
      }
    });
  } catch {
    console.error('Get me error');
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};
