import type { Response } from 'express';
import { predictPatientLoads } from '../services/patientLoadPrediction.service.js';
import type { AuthRequest } from '../middleware/auth.js';

export const getPatientLoadPredictions = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const predictions = await predictPatientLoads();
    res.json({ predictions });
  } catch (error) {
    console.error('Error fetching patient load predictions:', error);
    res.status(500).json({ error: 'Failed to fetch patient load predictions' });
  }
};