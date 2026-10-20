/**
 * Emergency triage and ER bed controller.
 *
 * Validation and orchestration only -- the bed and admission rules live in
 * services/emergency.service.ts.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import * as emergencyService from '../services/emergency.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * Maps a service error onto its HTTP status. Anything that is not a known
 * business error is a bug or an outage and becomes a 500 without leaking the
 * underlying message.
 */
const respondWithServiceError = (error: unknown, res: Response, context: string): void => {
  if (error instanceof emergencyService.EmergencyServiceError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error(`${context}:`, error instanceof Error ? error.message : error);
  res.status(500).json({ error: 'Emergency request failed' });
};

const readActor = async (req: AuthRequest) => {
  const rawId = req.user?.id ? Number(req.user.id) : NaN;
  const userId = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
  const userName = await emergencyService.getActorName(userId);
  return {
    userId,
    userName,
    ipAddress: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  };
};

/**
 * GET /api/emergency/triage-board
 *
 * The whole board in one response: the active admissions and the bed list.
 */
export const getTriageBoard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const board = await emergencyService.getTriageBoard();
    res.status(200).json({
      patients: board.patients,
      beds: board.beds,
      hotline: board.hotline,
      generatedAt: board.generatedAt,
    });
  } catch (error) {
    respondWithServiceError(error, res, 'Error fetching triage board');
  }
};

/**
 * GET /api/emergency/beds
 */
export const getBeds = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const beds = await emergencyService.listBeds();
    res.status(200).json({ beds, count: beds.length });
  } catch (error) {
    respondWithServiceError(error, res, 'Error fetching emergency beds');
  }
};

/**
 * PATCH /api/emergency/beds/:id
 *
 * Updates the state of a bay and keeps the admission link in step.
 */
export const updateBed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const bed = await emergencyService.updateBed({
      id,
      status: String(body.status) as emergencyService.BedStatus,
      patientId:
        body.patientId === undefined || body.patientId === null
          ? null
          : String(body.patientId),
      triage:
        body.triage === undefined || body.triage === null
          ? null
          : (String(body.triage) as emergencyService.TriageLevel),
    });

    res.status(200).json({ bed });
  } catch (error) {
    respondWithServiceError(error, res, 'Error updating emergency bed');
  }
};

/**
 * POST /api/emergency/admissions
 */
export const createAdmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const optionalNumber = (key: string): number | null =>
      body[key] === undefined || body[key] === null ? null : Number(body[key]);

    const admission = await emergencyService.createAdmission({
      patientId: String(body.patientId),
      triageLevel: String(body.triageLevel) as emergencyService.TriageLevel,
      condition: body.condition === undefined || body.condition === null ? null : String(body.condition),
      systolicBp: optionalNumber('systolicBp'),
      diastolicBp: optionalNumber('diastolicBp'),
      heartRate: optionalNumber('heartRate'),
      temperature: optionalNumber('temperature'),
      respiratoryRate: optionalNumber('respiratoryRate'),
      spo2: optionalNumber('spo2'),
      bedId: body.bedId === undefined || body.bedId === null ? null : String(body.bedId),
      recordedBy: req.user?.id ? Number(req.user.id) : null,
      recordedByName: req.user?.email ?? null,
    });

    res.status(201).json({ admission });
  } catch (error) {
    respondWithServiceError(error, res, 'Error admitting patient');
  }
};

/**
 * PATCH /api/emergency/admissions/:id
 */
export const updateAdmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const optionalNumber = (key: string): number | null | undefined =>
      body[key] === undefined ? undefined : body[key] === null ? null : Number(body[key]);

    const admission = await emergencyService.updateAdmission(id, {
      triageLevel:
        body.triageLevel === undefined || body.triageLevel === null
          ? undefined
          : (String(body.triageLevel) as emergencyService.TriageLevel),
      condition: body.condition === undefined ? undefined : body.condition === null ? null : String(body.condition),
      systolicBp: optionalNumber('systolicBp'),
      diastolicBp: optionalNumber('diastolicBp'),
      heartRate: optionalNumber('heartRate'),
      spo2: optionalNumber('spo2'),
    });

    res.status(200).json({ admission });
  } catch (error) {
    respondWithServiceError(error, res, 'Error updating emergency admission');
  }
};

/**
 * POST /api/emergency/admissions/:id/discharge
 */
export const dischargeAdmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { id } = req.params as { id: string };
    const { admission, bed } = await emergencyService.dischargeAdmission(id);
    res.status(200).json({ admission, bed });
  } catch (error) {
    respondWithServiceError(error, res, 'Error discharging patient');
  }
};

/**
 * POST /api/emergency/code-blue
 *
 * Records the event in the audit trail. The response states plainly that no
 * external dispatch happened, because none did.
 */
export const recordCodeBlue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const actor = await readActor(req);

    const result = await emergencyService.recordCodeBlue(
      {
        patientId:
          body.patientId === undefined || body.patientId === null ? null : String(body.patientId),
        note: body.note === undefined || body.note === null ? null : String(body.note),
      },
      actor
    );

    res.status(201).json({ codeBlue: result });
  } catch (error) {
    respondWithServiceError(error, res, 'Error recording code blue');
  }
};

/**
 * GET /api/emergency/options
 *
 * The real patient list for the admit form plus the current bed list. The
 * patient list is scoped to the caller's hospital when the caller has one.
 */
export const getOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const options = await emergencyService.listAdmissionOptions(req.user?.hospital_id ?? null);
    res.status(200).json({
      patients: options.patients,
      beds: options.beds,
      hotline: options.hotline,
    });
  } catch (error) {
    respondWithServiceError(error, res, 'Error fetching emergency options');
  }
};
