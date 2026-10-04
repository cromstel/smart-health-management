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
    // Header first. The query fallback exists because EventSource -- which
    // backs the role/permission SSE stream -- cannot set request headers, so the
    // browser can only pass the token as ?token=. Without this fallback that
    // endpoint could only ever answer 401 and the client retried on an interval.
    //
    // Tradeoff: query strings are more likely to be captured in access logs and
    // referrers than headers are. The token here is short-lived and the endpoint
    // is same-origin; anything longer-lived should use fetch() plus streams.
    const token =
      req.headers.authorization?.split(' ')[1] ||
      (typeof req.query?.token === 'string' ? req.query.token : undefined);

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

      const [userRows] = await pool.query('SELECT role_id FROM users WHERE id = ?', [userId]);
      const roleId: any = (userRows as any[])[0]?.role_id;

      const canAll = async (rid: any): Promise<boolean> => {
        const [rows] = await pool.query(
          `SELECT p.can_${action} as allowed FROM permissions p WHERE p.role_id = ? AND p.module = 'all'`,
          [rid]
        );
        return ((rows as any[])[0]?.allowed === 1);
      };

      const canModule = async (rid: any): Promise<boolean> => {
        // No department predicate: the permissions table has no department_id
        // column (see schema.sql). The old query filtered on
        // p.department_id = ? / IS NULL, which threw ER_BAD_FIELD_ERROR for
        // every user that has a role -- i.e. every real user -- so this
        // middleware answered 500 "Permission check failed" for essentially
        // every guarded request and the dashboard filled with errors.
        //
        // Department scoping, if it is ever wanted, belongs in a permissions
        // column or a join table, not in a filter against a column that does
        // not exist.
        const [rows] = await pool.query(
          `SELECT p.can_${action} as allowed FROM permissions p WHERE p.role_id = ? AND p.module = ?`,
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
        // No role hierarchy walk. It read roles.parent_id, which does not exist
        // in schema.sql, so the query threw ER_BAD_FIELD_ERROR the moment
        // canAll and canModule both missed -- which is precisely the case where
        // the answer is a plain 403. That turned every genuinely
        // permission-denied request into a 500 "Permission check failed".
        if (await canAll(roleId)) {
          allowed = true;
        } else {
          allowed = await canModule(roleId);
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

    // Only the enforcement flags are needed here. This previously also selected
  // `role`, which does not exist on users -- the role name lives in the roles
  // table and users carries role_id -- so the query always threw and every
  // request through this middleware failed with
  // 500 "Password enforcement failed", taking the dashboard down with it.
  const [rows] = await pool.query('SELECT password_must_change, password_postpone_count FROM users WHERE id = ?', [req.user.id]);
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
