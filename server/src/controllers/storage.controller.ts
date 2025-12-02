import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { getStorageUsage as getServiceStorageUsage } from '../services/storage.service.js'

export const getStorageUsage = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const usage = await getServiceStorageUsage();
    res.json(usage);
  } catch (error) {
    console.error('Get storage usage error:', error);
    res.status(500).json({ error: 'Failed to get storage usage' });
  }
};