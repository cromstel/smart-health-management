import type { Request, Response } from 'express';
import { getPlatformStats } from '../services/platformStats.service'

export async function getPlatformStatsHandler(_req: Request, res: Response) {
  try {
    const stats = await getPlatformStats()
    return res.status(200).json({
      success: true,
      data: stats,
    })
  } catch (_error) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'platform_stats_unavailable',
        message: 'Platform statistics temporarily unavailable',
      },
    })
  }
}