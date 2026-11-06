import { Response } from 'express';
import pool from '../config/database.js';
import { randomToken, isDuplicateEntry } from '../utils/identifiers.js';
import { normalizeSubdomain } from '../utils/subdomains.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * Public hospital onboarding.
 *
 * The request is unauthenticated — a prospective hospital has no account yet
 * — so what it creates is a request to open a tenant, not a tenant. The row
 * is written INACTIVE, and only a super administrator flips it to active
 * (through the hospital settings surface). Until then the subdomain resolver
 * does not serve its address, because the resolver resolves active hospitals
 * only. The response reports exactly that state rather than a hopeful one.
 */

/** Contact fields a prospect may supply; all optional, all bounded. */
const readText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text === '') return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const onboardHospital = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = readText(body.name, 255);
    if (!name) {
      return res.status(400).json({ error: 'A hospital name is required' });
    }

    const subdomain = normalizeSubdomain(body.subdomain);
    if (!subdomain) {
      return res.status(400).json({
        error:
          'Choose a subdomain of 2-100 letters, numbers or hyphens. Names reserved by the platform cannot be used.',
      });
    }

    const email = readText(body.email, 255);
    if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid contact email is required' });
    }

    // The column carries a UNIQUE index: a claimed value is a conflict the
    // caller can correct, not a server fault.
    const [existing] = await pool.query(
      'SELECT id FROM hospitals WHERE subdomain = ? LIMIT 1',
      [subdomain]
    );
    if ((existing as any[]).length > 0) {
      return res.status(409).json({ error: 'That subdomain is already taken' });
    }

    // hospitals.id is a BIGINT UNSIGNED AUTO_INCREMENT column: the public
    // identifier goes in hospitals.hospital_id, which is UNIQUE.
    const insertSql = `INSERT INTO hospitals
        (hospital_id, name, address, phone, email, subdomain, status)
        VALUES (?, ?, ?, ?, ?, ?, 'inactive')`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const hospitalCode = `HOSP-${randomToken(6)}`;
      try {
        const [result] = await pool.query(insertSql, [
          hospitalCode,
          name,
          readText(body.address, 2000),
          readText(body.phone, 20),
          email,
          subdomain,
        ]);

        // The honest state: received, and not live until it is confirmed.
        return res.status(201).json({
          message:
            'Hospital received. A super administrator must confirm it before the address goes live.',
          hospitalId: (result as any).insertId,
          subdomain,
          status: 'inactive',
        });
      } catch (error) {
        // hospital_id is UNIQUE. A collision is unlikely but not impossible,
        // so retry with a fresh identifier instead of failing the request.
        // A subdomain collision is a real conflict the caller must resolve:
        // re-check which value is actually taken and answer accordingly.
        if (isDuplicateEntry(error)) {
          const [taken] = await pool.query(
            'SELECT id FROM hospitals WHERE subdomain = ? LIMIT 1',
            [subdomain]
          );
          if ((taken as any[]).length > 0) {
            return res.status(409).json({ error: 'That subdomain is already taken' });
          }
          if (attempt < 4) continue;
        }
        throw error;
      }
    }

    throw new Error('Unable to allocate a unique hospital identifier');
  } catch (error) {
    console.error('Onboard hospital error:', error);
    res.status(500).json({ error: 'Failed to submit the hospital' });
  }
};
