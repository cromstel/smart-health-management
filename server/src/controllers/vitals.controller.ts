/**
 * Patient vitals controller.
 *
 * Validation and orchestration only -- the clinical rules live in
 * services/vitals.service.ts.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import * as vitalsService from '../services/vitals.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

const readRecorder = async (req: AuthRequest) => {
  const userId = req.user?.id ? Number(req.user.id) : undefined;
  const name = await vitalsService.getClinicianName(userId);
  return { id: userId, name: name || undefined };
};

/**
 * GET /api/vitals?patientId=...&from=...&to=...&limit=...
 * GET /api/vitals/:patientId
 */
export const getVitals = async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const params = req.params as Record<string, string | undefined>;
    const query = req.query as Record<string, string | undefined>;
    const patientRef = params.patientId || query.patientId;

    if (patientRef) {
      const patient = await vitalsService.resolvePatient(patientRef);
      if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
    }

    const records = await vitalsService.listVitals({
      patientRef,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    });

    res.status(200).json({ vitals: records, count: records.length });
  } catch (error) {
    console.error('Error fetching vitals:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch vitals' });
  }
};

/**
 * GET /api/vitals/:patientId/summary
 */
export const getVitalsSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { patientId } = req.params as { patientId: string };
    const patient = await vitalsService.resolvePatient(patientId);
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const summary = await vitalsService.getPatientVitalsSummary(patient.id);
    res.status(200).json({ summary, patientId: patient.patientId });
  } catch (error) {
    console.error('Error fetching vitals summary:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch vitals summary' });
  }
};

/**
 * GET /api/vitals/alerts -- active alerts across every patient.
 */
export const getAllAlerts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await vitalsService.getAllActiveAlerts();
    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    console.error('Error fetching vitals alerts:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch vitals alerts' });
  }
};

/**
 * GET /api/vitals/:patientId/alerts -- alerts for the latest reading.
 */
export const getPatientAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { patientId } = req.params as { patientId: string };
    const patient = await vitalsService.resolvePatient(patientId);
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const alerts = await vitalsService.getPatientAlerts(patient.id);
    res.status(200).json({ alerts, count: alerts.length, patientId: patient.patientId });
  } catch (error) {
    console.error('Error fetching patient vitals alerts:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch vitals alerts' });
  }
};

/**
 * POST /api/vitals -- record a reading. The status is derived server-side.
 */
export const createVital = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const recorder = await readRecorder(req);

    const vital = await vitalsService.createVital(
      {
        patientId: String(body.patientId),
        patientName: body.patientName ? String(body.patientName) : undefined,
        recordedAt: body.recordedAt ? String(body.recordedAt) : undefined,
        recordedBy: body.recordedBy ? String(body.recordedBy) : undefined,
        systolicBp: Number(body.systolicBp),
        diastolicBp: Number(body.diastolicBp),
        heartRate: Number(body.heartRate),
        temperature: Number(body.temperature),
        respiratoryRate:
          body.respiratoryRate === undefined || body.respiratoryRate === null
            ? undefined
            : Number(body.respiratoryRate),
        oxygenSaturation:
          body.oxygenSaturation === undefined || body.oxygenSaturation === null
            ? undefined
            : Number(body.oxygenSaturation),
        notes: body.notes === undefined || body.notes === null ? undefined : String(body.notes),
      },
      recorder
    );

    if (!vital) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    res.status(201).json({ vital });
  } catch (error) {
    console.error('Error recording vitals:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to record vitals' });
  }
};

/**
 * PUT /api/vitals/:id -- correct a reading. The status is re-derived.
 */
export const updateVital = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const vital = await vitalsService.updateVital(id, {
      recordedAt: body.recordedAt ? String(body.recordedAt) : undefined,
      recordedBy: body.recordedBy ? String(body.recordedBy) : undefined,
      systolicBp: body.systolicBp === undefined ? undefined : Number(body.systolicBp),
      diastolicBp: body.diastolicBp === undefined ? undefined : Number(body.diastolicBp),
      heartRate: body.heartRate === undefined ? undefined : Number(body.heartRate),
      temperature: body.temperature === undefined ? undefined : Number(body.temperature),
      respiratoryRate:
        body.respiratoryRate === undefined
          ? undefined
          : body.respiratoryRate === null
            ? null
            : Number(body.respiratoryRate),
      oxygenSaturation:
        body.oxygenSaturation === undefined
          ? undefined
          : body.oxygenSaturation === null
            ? null
            : Number(body.oxygenSaturation),
      notes: body.notes === undefined ? undefined : body.notes === null ? null : String(body.notes),
    });

    if (!vital) {
      res.status(404).json({ error: 'Vitals record not found' });
      return;
    }

    res.status(200).json({ vital });
  } catch (error) {
    console.error('Error updating vitals:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to update vitals' });
  }
};

/**
 * DELETE /api/vitals/:id
 */
export const deleteVital = async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const { id } = req.params as { id: string };
    const deleted = await vitalsService.deleteVital(id);
    if (!deleted) {
      res.status(404).json({ error: 'Vitals record not found' });
      return;
    }

    res.status(200).json({ success: true, id });
  } catch (error) {
    console.error('Error deleting vitals:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to delete vitals' });
  }
};
