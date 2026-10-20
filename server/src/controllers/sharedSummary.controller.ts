/**
 * Shared patient summary controller.
 *
 * Two very different access models meet here:
 *  - generating a link requires an authenticated clinician with patient access;
 *  - reading a link is deliberately public, because the recipient of a shared
 *    summary is not a user of the platform. The token is the credential.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import * as sharedSummaryService from '../services/sharedSummary.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * POST /api/shared/patient-summary/generate
 *
 * Body: { patientId, patientName? }
 * Response: { token, expiresAt, url }
 */
export const generateSharedSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const patientRef = String(body.patientId || '').trim();
    if (!patientRef) {
      res.status(400).json({ error: 'patientId is required' });
      return;
    }

    const sharedBy = req.user?.id ? Number(req.user.id) : undefined;
    const created = await sharedSummaryService.createShareLink(patientRef, sharedBy);

    if (!created) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    res.status(201).json(created);
  } catch (error) {
    console.error(
      'Error generating shared patient summary:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Failed to generate shared patient summary' });
  }
};

/**
 * GET /api/shared/patient-summary?token=...
 *
 * Public read. Rejects unknown, revoked and expired tokens.
 */
export const getSharedSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const token = String(req.query.token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'A share token is required' });
      return;
    }

    const payload = await sharedSummaryService.readSharedSummary(token);
    if (!payload) {
      res.status(404).json({
        error: 'This shared patient summary link is invalid, revoked, or has expired.',
      });
      return;
    }

    res.status(200).json(payload);
  } catch (error) {
    console.error(
      'Error reading shared patient summary:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Failed to load the shared patient summary' });
  }
};
