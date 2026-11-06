import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { buildInventoryForecast } from '../services/pharmacyForecast.service.js';

/**
 * GET /api/pharmacy/forecast
 *
 * Query: surgeMultiplier (0.1 - 10), lookbackDays (7 - 365),
 * targetCoverDays (1 - 365).
 *
 * The response carries the items the forecast table renders and the raw
 * `unitPrice` / `supplier` / `supplierId` the reorder action needs.
 */
export const getForecast = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { surgeMultiplier, lookbackDays, targetCoverDays } = req.query;

    const result = await buildInventoryForecast({
      surgeMultiplier: surgeMultiplier === undefined ? null : Number(surgeMultiplier),
      lookbackDays: lookbackDays === undefined ? null : Number(lookbackDays),
      targetCoverDays: targetCoverDays === undefined ? null : Number(targetCoverDays),
    });

    res.json(result);
  } catch (error) {
    console.error('Pharmacy forecast error:', (error as Error)?.message);
    res.status(500).json({ error: 'Failed to compute the inventory forecast' });
  }
};
