import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  MedicationAdministrationError,
  createMedicationAdministration,
  deleteMedicationAdministration,
  getMedicationAdministration,
  getMedicationAdministrationOptions,
  listMedicationAdministrations,
  signOffMedicationAdministration,
  toNullableUserId,
  updateMedicationAdministration,
  type MedicationAdministrationStatus,
} from '../services/medicationAdministration.service.js';

/** Turns a service failure into the right HTTP answer. */
const respondWithError = (res: Response, error: unknown): Response => {
  if (error instanceof MedicationAdministrationError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error('Medication administration error:', (error as Error)?.message);
  return res.status(500).json({ error: 'Medication administration request failed' });
};

const toStatus = (value: unknown): MedicationAdministrationStatus | null => {
  if (typeof value !== 'string') return null;
  const normalised = value.trim().toLowerCase();
  if (
    normalised === 'pending' ||
    normalised === 'administered' ||
    normalised === 'overdue' ||
    normalised === 'missed'
  ) {
    return normalised;
  }
  return null;
};

/**
 * GET /api/medication-administrations
 *
 * Query: patientId, status, date (YYYY-MM-DD), assignedStaffId, limit.
 */
export const listAdministrations = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { patientId, status, date, assignedStaffId, limit } = req.query;

    const records = await listMedicationAdministrations({
      patientId: patientId ? Number(patientId) : null,
      status: toStatus(status),
      date: typeof date === 'string' && date ? date : null,
      assignedStaffId: assignedStaffId ? Number(assignedStaffId) : null,
      hospitalId: req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1,
      limit: limit ? Number(limit) : null,
    });

    res.json(records);
  } catch (error) {
    respondWithError(res, error);
  }
};

/**
 * GET /api/medication-administrations/options
 *
 * The patients that can be dosed and the staff a dose can be assigned to.
 */
export const listOptions = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const options = await getMedicationAdministrationOptions(req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1);
    res.json(options);
  } catch (error) {
    respondWithError(res, error);
  }
};

/** GET /api/medication-administrations/:id */
export const getAdministration = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const record = await getMedicationAdministration(
      Number(req.params.id),
      req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1
    );
    if (!record) {
      return res.status(404).json({ error: 'Medication administration not found' });
    }
    res.json(record);
  } catch (error) {
    respondWithError(res, error);
  }
};

/** POST /api/medication-administrations -- schedule a dose. */
export const createAdministration = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const {
      patientId,
      medicineId,
      dosage,
      scheduledTime,
      assignedStaffId,
      criticalNotes,
    } = req.body ?? {};

    const record = await createMedicationAdministration({
      patientId: Number(patientId),
      medicineId: String(medicineId),
      dosage: String(dosage),
      scheduledTime: String(scheduledTime),
      assignedStaffId: assignedStaffId ? Number(assignedStaffId) : null,
      hospitalId: req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1,
      criticalNotes: typeof criticalNotes === 'string' ? criticalNotes : null,
    });

    res.status(201).json(record);
  } catch (error) {
    respondWithError(res, error);
  }
};

/** PATCH /api/medication-administrations/:id/sign-off */
export const signOffAdministration = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const id = Number(req.params.id);
    const actorId = toNullableUserId(req.user?.id);
    const requestedQuantity =
      req.body?.quantity === undefined || req.body?.quantity === null
        ? null
        : Number(req.body.quantity);

    const result = await signOffMedicationAdministration(
      id,
      actorId,
      requestedQuantity,
      req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1
    );

    res.json({ ...result.record, quantity: result.quantity, stockAfter: result.stockAfter });
  } catch (error) {
    respondWithError(res, error);
  }
};

/** PATCH /api/medication-administrations/:id */
export const updateAdministration = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body ?? {};

    const record = await updateMedicationAdministration(id, {
      status: body.status === undefined ? undefined : toStatus(body.status),
      criticalNotes:
        body.criticalNotes === undefined
          ? undefined
          : typeof body.criticalNotes === 'string'
            ? body.criticalNotes
            : null,
      assignedStaffId:
        body.assignedStaffId === undefined
          ? undefined
          : body.assignedStaffId === null || body.assignedStaffId === ''
            ? null
            : Number(body.assignedStaffId),
      dosage: body.dosage === undefined ? undefined : String(body.dosage),
      scheduledTime:
        body.scheduledTime === undefined ? undefined : String(body.scheduledTime),
    }, req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1);

    res.json(record);
  } catch (error) {
    respondWithError(res, error);
  }
};

/** DELETE /api/medication-administrations/:id */
export const removeAdministration = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    await deleteMedicationAdministration(
      Number(req.params.id),
      req.tenant?.platformWide ? undefined : req.tenant?.hospitalId ?? -1
    );
    res.json({ deleted: true, id: Number(req.params.id) });
  } catch (error) {
    respondWithError(res, error);
  }
};
