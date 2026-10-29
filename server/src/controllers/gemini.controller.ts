/**
 * Gemini AI controller.
 *
 * Validation and orchestration only -- the model calls live in
 * services/gemini.service.ts.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import * as geminiService from '../services/gemini.service.js';
import { computeVitalStatus } from '../services/vitals.service.js';
import type { VitalsRecord } from '../services/vitals.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * POST /api/gemini/chat
 *
 * Body: { messages: [{ role, content }], modelType?, systemInstruction?, enableSearchGrounding? }
 * Response: { text, modelUsed, simulated, groundingMetadata }
 */
export const chat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const result = await geminiService.chat({
      messages: messages.map((m: any) => ({
        role: String(m?.role ?? 'user'),
        content: String(m?.content ?? ''),
      })),
      modelType: body.modelType ? String(body.modelType) : undefined,
      systemInstruction: body.systemInstruction ? String(body.systemInstruction) : undefined,
      enableSearchGrounding: body.enableSearchGrounding === true,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error handling Gemini chat:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to handle the AI request' });
  }
};

/**
 * POST /api/gemini/insights
 *
 * Body: { patientId?, patientName?, vitalsList? }
 * Response: { text, modelUsed, simulated, groundingMetadata }
 */
export const insights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const rawVitals = Array.isArray(body.vitalsList) ? body.vitalsList : [];

    const vitalsList: VitalsRecord[] = rawVitals.map((v: any) => {
      const record: VitalsRecord = {
        id: String(v?.id ?? ''),
        patientId: String(v?.patientId ?? body.patientId ?? ''),
        patientName: String(v?.patientName ?? body.patientName ?? ''),
        recordedAt: String(v?.recordedAt ?? ''),
        recordedBy: String(v?.recordedBy ?? ''),
        systolicBp: Number(v?.systolicBp),
        diastolicBp: Number(v?.diastolicBp),
        heartRate: Number(v?.heartRate),
        temperature: Number(v?.temperature),
        // The status is re-derived by the service; the client value is ignored.
        status: 'normal',
      };
      if (v?.respiratoryRate !== undefined && v?.respiratoryRate !== null) {
        record.respiratoryRate = Number(v.respiratoryRate);
      }
      if (v?.oxygenSaturation !== undefined && v?.oxygenSaturation !== null) {
        record.oxygenSaturation = Number(v.oxygenSaturation);
      }
      if (v?.notes !== undefined && v?.notes !== null) {
        record.notes = String(v.notes);
      }
      record.status = computeVitalStatus(
        record.systolicBp,
        record.diastolicBp,
        record.heartRate,
        record.temperature
      );
      return record;
    });

    const result = await geminiService.clinicalInsights({
      patientId: body.patientId ? String(body.patientId) : undefined,
      patientName: body.patientName ? String(body.patientName) : undefined,
      vitalsList,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error handling Gemini insights:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to generate clinical insights' });
  }
};
