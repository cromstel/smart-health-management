import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { getSecret } from '../config/env.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    hospital_id?: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, getSecret('JWT_SECRET', 'dev-only-jwt-secret')) as {
      id: string;
      email: string;
      role: string;
      hospital_id?: string;
    };

    req.user = decoded;
    next();
  } catch {
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
    const maxPostpones = parseInt(process.env.PASSWORD_MAX_POSTPONES || '3');

    if (mustChange && postponeCount >= maxPostpones) {
      res.status(403).json({ error: 'Password change required' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Password enforcement failed' });
  }
};
