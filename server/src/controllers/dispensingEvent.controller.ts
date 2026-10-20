import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  DispensingEventError,
  createDispensingEvent,
  deleteDispensingEvent,
  getDispensingEvent,
  listDispensingEvents,
} from '../services/dispensingEvent.service.js';
import { toNullableUserId } from '../services/medicationAdministration.service.js';

const respondWithError = (res: Response, error: unknown): Response => {
  if (error instanceof DispensingEventError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error('Dispensing event error:', (error as Error)?.message);
  return res.status(500).json({ error: 'Dispensing event request failed' });
};

/**
 * GET /api/dispensing-events
 *
 * Query: patientId, medicineId, from, to, limit. Newest first.
 */
export const listEvents = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { patientId, medicineId, from, to, limit } = req.query;

    const events = await listDispensingEvents({
      patientId: patientId ? Number(patientId) : null,
      medicineId: typeof medicineId === 'string' && medicineId ? medicineId : null,
      from: typeof from === 'string' && from ? from : null,
      to: typeof to === 'string' && to ? to : null,
      limit: limit ? Number(limit) : null,
    });

    res.json(events);
  } catch (error) {
    respondWithError(res, error);
  }
};

/** GET /api/dispensing-events/:id */
export const getEvent = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const event = await getDispensingEvent(Number(req.params.id));
    if (!event) {
      return res.status(404).json({ error: 'Dispensing event not found' });
    }
    res.json(event);
  } catch (error) {
    respondWithError(res, error);
  }
};

/**
 * POST /api/dispensing-events
 *
 * Body: { prescriptionId?, patientId, medicineId, quantity, notes?, dispensedAt? }
 */
export const createEvent = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { prescriptionId, patientId, medicineId, quantity, notes, dispensedAt } = req.body ?? {};

    const event = await createDispensingEvent({
      prescriptionId: typeof prescriptionId === 'string' && prescriptionId ? prescriptionId : null,
      patientId: Number(patientId),
      medicineId: String(medicineId),
      quantity: Number(quantity),
      notes: typeof notes === 'string' ? notes : null,
      dispensedAt: typeof dispensedAt === 'string' && dispensedAt ? dispensedAt : null,
      dispensedBy: toNullableUserId(req.user?.id),
    });

    res.status(201).json(event);
  } catch (error) {
    respondWithError(res, error);
  }
};

/** DELETE /api/dispensing-events/:id */
export const removeEvent = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    await deleteDispensingEvent(Number(req.params.id));
    res.json({ deleted: true, id: Number(req.params.id) });
  } catch (error) {
    respondWithError(res, error);
  }
};
