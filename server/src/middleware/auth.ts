import type { Request, Response, NextFunction } from 'express';
import { jwtManager } from '../config/jwt.js';
import pool from '../config/database.js';
import { cacheService, CacheKeys } from '../services/cache.service.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    hospital_id?: string;
  };
}

/**
 * Enhanced Authentication Middleware with JWT Security Features
 * Uses the new custom JWT manager with enhanced security validation
 * Supports both httpOnly cookies (preferred) and Authorization header (backward compatibility)
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Try to get token from httpOnly cookie first (preferred method)
    let token = req.cookies?.token;

    // Fallback to Authorization header for backward compatibility
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Use the enhanced JWT manager for verification
    const decoded = await jwtManager.verifyToken(token);

    // Map the JWT payload to the expected AuthRequest user object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      hospital_id: decoded.hospital_id,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Provide specific error messages based on the error type
    if (error instanceof Error && error.message === 'Token has been revoked') {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requirePermission = (module: string, action: 'view' | 'add' | 'edit' | 'delete') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = req.user.id;

      const departmentId = (req.query.department as string) || (req.query.departmentId as string) || (req.body?.departmentId as string) || (req.params?.departmentId as string) || null;

      // Check cache first for permission result
      const cacheKey = CacheKeys.permission(userId, module, action, departmentId);
      const cachedPermission = await cacheService.get<boolean>(cacheKey);
      
      if (cachedPermission !== null) {
        if (cachedPermission) {
          // Permission granted, proceed with hospital check
          const hospitalScopedModules = new Set(['patients', 'staff', 'appointments', 'purchaseOrder']);
          if (hospitalScopedModules.has(module)) {
            const userHospital = req.user.hospital_id;
            if (!userHospital) {
              res.status(403).json({ error: 'Missing hospital context' });
              return;
            }
            const targetHospital = (req.query.hospital as string) || (req.query.hospitalId as string) || (req.body?.hospitalId as string) || (req.params?.hospitalId as string) || userHospital;
            if (targetHospital && targetHospital !== userHospital) {
              res.status(403).json({ error: 'Hospital mismatch' });
              return;
            }
          }
          next();
          return;
        } else {
          res.status(403).json({ error: 'Insufficient permissions' });
          return;
        }
      }

      // Cache miss, query database
      const [userRows] = await pool.query('SELECT role_id FROM users WHERE id = ?', [userId]);
      let roleId: any = (userRows as any[])[0]?.role_id;

      const canAll = async (rid: any): Promise<boolean> => {
        const [rows] = await pool.query(
          `SELECT p.can_${action} as allowed FROM permissions p WHERE p.role_id = ? AND p.module = 'all'`,
          [rid]
        );
        return ((rows as any[])[0]?.allowed === 1);
      };

      const canModule = async (rid: any, dept: any): Promise<boolean> => {
        if (dept) {
          const [rowsDept] = await pool.query(
            `SELECT p.can_${action} as allowed FROM permissions p WHERE p.role_id = ? AND p.module = ? AND p.department_id = ?`,
            [rid, module, dept]
          );
          if ((rowsDept as any[])[0]?.allowed === 1) return true;
        }
        const [rows] = await pool.query(
          `SELECT p.can_${action} as allowed FROM permissions p WHERE p.role_id = ? AND p.module = ? AND p.department_id IS NULL`,
          [rid, module]
        );
        return ((rows as any[])[0]?.allowed === 1);
      };

      let allowed = false;
      if (!roleId) {
        const [allRows] = await pool.query(
          `SELECT p.can_${action} as allowed
           FROM users u
           JOIN permissions p ON p.role_id = u.role_id
           WHERE u.id = ? AND p.module = 'all'`,
          [userId]
        );
        const allAllowed = (allRows as any[])[0]?.allowed === 1;
        if (allAllowed) {
          allowed = true;
        } else {
          const [rows] = await pool.query(
            `SELECT p.can_${action} as allowed
             FROM users u
             JOIN permissions p ON p.role_id = u.role_id
             WHERE u.id = ? AND p.module = ?`,
            [userId, module]
          );
          allowed = (rows as any[])[0]?.allowed === 1;
        }
      } else {
        while (roleId && !allowed) {
          if (await canAll(roleId)) {
            allowed = true;
            break;
          }
          if (await canModule(roleId, departmentId)) {
            allowed = true;
            break;
          }
          const [parentRows] = await pool.query('SELECT parent_id FROM roles WHERE id = ?', [roleId]);
          roleId = (parentRows as any[])[0]?.parent_id || null;
        }
      }

      // Cache the permission result (5 minute TTL)
      await cacheService.set(cacheKey, allowed, 300);

      if (!allowed) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const hospitalScopedModules = new Set(['patients', 'staff', 'appointments', 'purchaseOrder']);
      if (hospitalScopedModules.has(module)) {
        const userHospital = req.user.hospital_id;
        if (!userHospital) {
          res.status(403).json({ error: 'Missing hospital context' });
          return;
        }
        const targetHospital = (req.query.hospital as string) || (req.query.hospitalId as string) || (req.body?.hospitalId as string) || (req.params?.hospitalId as string) || userHospital;
        if (targetHospital && targetHospital !== userHospital) {
          res.status(403).json({ error: 'Hospital mismatch' });
          return;
        }
      }
      next();
    } catch {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

export const enforcePasswordChange = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const exemptPaths = new Set([
      '/api/auth/change-password',
      '/api/auth/postpone-password-change',
      '/api/auth/logout',
      '/api/auth/me'
    ]);
    const path = req.path ? req.baseUrl + req.path : req.originalUrl;
    if (Array.from(exemptPaths).some((p) => (req.originalUrl || path).startsWith(p))) {
      next();
      return;
    }

    const [rows] = await pool.query('SELECT password_must_change, password_postpone_count, role FROM users WHERE id = ?', [req.user.id]);
    const userRow = (rows as any[])[0];
    const mustChange = !!userRow?.password_must_change;
    const postponeCount = Number(userRow?.password_postpone_count || 0);
    const passwordMaxPostpones = process.env.PASSWORD_MAX_POSTPONES;
    if (!passwordMaxPostpones) {
      throw new Error('PASSWORD_MAX_POSTPONES is not defined in environment variables.');
    }
    const maxPostpones = parseInt(passwordMaxPostpones);
    if (isNaN(maxPostpones)) {
      throw new Error('PASSWORD_MAX_POSTPONES must be a number.');
    }

    if (mustChange && postponeCount >= maxPostpones) {
      res.status(403).json({ error: 'Password change required' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Password enforcement failed' });
  }
};
