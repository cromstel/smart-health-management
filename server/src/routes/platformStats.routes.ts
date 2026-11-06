import express from 'express';
import rateLimit from 'express-rate-limit';
import { getPlatformStatsHandler } from '../controllers/platformStats.controller';

const router = express.Router();

// Decision (Phase 0, 2026-10-29): this endpoint is intentionally public. It
// exposes only aggregate organisation scale (hospital/staff/patient/appointment
// counts) and no individual records, and it backs the marketing/landing page.
// It is rate-limited and cached so that it cannot be used to probe load or to
// hammer the database; a tighter limit than the global API limiter applies
// because the handler runs four COUNT(*) queries per request.
const platformStatsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many requests' } },
});

router.get(
  '/',
  platformStatsLimiter,
  // Cache the aggregate for a short window at the edge/browser. The counts
  // change slowly and the handler is comparatively expensive.
  (_req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    next();
  },
  getPlatformStatsHandler
);

export default router;