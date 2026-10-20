import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { getSecret } from '../config/env.js';
import type { RowDataPacket } from 'mysql2';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    hospital_id?: string;
    department_id?: string;
  };
}

/**
 * Extracts the raw bearer token from a request.
 *
 * Header first. The query fallback exists because EventSource -- which
 * backs the role/permission SSE stream -- cannot set request headers, so the
 * browser can only pass the token as ?token=. Without this fallback that
 * endpoint could only ever answer 401 and the client retried on an interval.
 *
 * Tradeoff: query strings are more likely to be captured in access logs and
 * referrers than headers are. The token here is short-lived and the endpoint
 * is same-origin; anything longer-lived should use fetch() plus streams.
 */
export const extractToken = (req: Request): string | undefined => {
  const headerToken = req.headers.authorization?.split(' ')[1];
  if (headerToken) {
    return headerToken;
  }
  const queryToken = req.query?.token;
  return typeof queryToken === 'string' && queryToken.length > 0 ? queryToken : undefined;
};

/**
 * SHA-256 hex digest of a bearer token.
 *
 * A JWT is a bearer credential: anyone holding it can act as the user. Only
 * a digest is ever persisted (revocation list, audit trails), so a dump of
 * those tables cannot be replayed as a session.
 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Short-lived cache of revocation lookups.
 *
 * The revocation check runs on every authenticated request, so the result is
 * memoised. The cache is only a fast path: the database remains the source
 * of truth and an entry that leaves the cache is simply re-read.
 *
 * A revoked token is cached for longer than a valid one. A valid token that
 * is revoked by another process is picked up within the short window; a
 * token that is revoked by this process is marked directly (see
 * `markTokenRevoked`) and is rejected immediately.
 */
const REVOKED_CACHE_TTL_MS = 60_000;
const VALID_CACHE_TTL_MS = 5_000;

interface RevocationEntry {
  revoked: boolean;
  expiresAt: number;
}

const revocationCache = new Map<string, RevocationEntry>();

/**
 * Marks a token as revoked in the cache.
 *
 * Called by the logout handler right after the revocation row is written, so
 * a token that was just invalidated is rejected on the very next request
 * instead of staying usable for the length of the cache window.
 */
export const markTokenRevoked = (tokenHash: string): void => {
  revocationCache.set(tokenHash, { revoked: true, expiresAt: Date.now() + REVOKED_CACHE_TTL_MS });
};

/**
 * True when the token has been explicitly invalidated (logout) and has not
 * expired yet.
 */
export const isTokenRevoked = async (tokenHash: string): Promise<boolean> => {
  const now = Date.now();
  const cached = revocationCache.get(tokenHash);

  if (cached && cached.expiresAt > now) {
    return cached.revoked;
  }
  if (cached) {
    revocationCache.delete(tokenHash);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 AS revoked FROM revoked_tokens WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
    [tokenHash]
  );

  const revoked = rows.length > 0;
  revocationCache.set(tokenHash, {
    revoked,
    expiresAt: now + (revoked ? REVOKED_CACHE_TTL_MS : VALID_CACHE_TTL_MS),
  });
  return revoked;
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, getSecret('JWT_SECRET', 'dev-only-jwt-secret')) as {
      id: string;
      email: string;
      role: string;
      hospital_id?: string;
      department_id?: string;
    };

    // A token that was invalidated by logout must stop working immediately
    // instead of staying valid until its natural expiry.
    if (await isTokenRevoked(hashToken(token))) {
      res.status(401).json({ error: 'Session has been revoked' });
      return;
    }

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
        // The target hospital can arrive under either spelling: the clients
        // send `hospital_id` on some payloads and `hospitalId` on others, and
        // only reading one of them let a record be attached to a hospital
        // outside the caller's own.
        const targetHospital =
          (req.query.hospital as string) ||
          (req.query.hospitalId as string) ||
          (req.body?.hospitalId as string) ||
          (req.body?.hospital_id as string) ||
          (req.params?.hospitalId as string) ||
          userHospital;
        if (targetHospital && String(targetHospital) !== String(userHospital)) {
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
