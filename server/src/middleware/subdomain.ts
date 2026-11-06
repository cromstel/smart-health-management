import { Request, Response, NextFunction } from 'express';
import pool from '../config/database.js';
import { hasSubdomainShape, isReservedSubdomain } from '../utils/subdomains.js';

export interface SubdomainRequest extends Request {
  /** The hospital the request's hostname resolved to, when it resolved. */
  hospitalId?: number | null;
}

/**
 * Resolves the hospital a request belongs to from its hostname.
 *
 * `<hospital>.medicare.example.com` names one tenant, so the first label is
 * looked up against `hospitals.subdomain` and the row's key is attached to
 * the request. Only an ACTIVE hospital resolves: a hospital that has been
 * registered but not yet confirmed does not serve traffic, which is what
 * makes the unauthenticated onboarding endpoint safe to expose.
 *
 * No subdomain — or one that matches nothing — leaves `hospitalId` unset;
 * callers that need a tenant must refuse rather than default to all of them.
 */
export const subdomainResolver = async (
  req: SubdomainRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let host = req.headers.host || '';
    // Dev override: allow explicit subdomain testing on localhost
    if (process.env.HOST_OVERRIDE && (host.startsWith('localhost') || host === '127.0.0.1')) {
      host = process.env.HOST_OVERRIDE;
    } else if ((req.query.subdomain as string) && (host.startsWith('localhost') || host === '127.0.0.1')) {
      host = `${req.query.subdomain}.medicare.cromstelit.com`;
    }

    const sub = host.split('.')[0]?.toLowerCase() ?? '';
    // Only resolve when the first label is a plausible, unreserved subdomain
    // that is not the bare host itself.
    if (sub && sub !== 'localhost' && !isReservedSubdomain(sub) && hasSubdomainShape(sub)) {
      const [rows] = await pool.query(
        'SELECT id FROM hospitals WHERE subdomain = ? AND status = ? LIMIT 1',
        [sub, 'active']
      );
      const row = (rows as any[])[0];
      req.hospitalId = row?.id ? Number(row.id) : null;
    }
    next();
  } catch (err: any) {
    // A resolver that cannot reach the database must not take the request
    // with it: leave the tenant unset and let the guarded routes refuse.
    console.error('[subdomainResolver]', err?.message || err);
    req.hospitalId = null;
    next();
  }
};
