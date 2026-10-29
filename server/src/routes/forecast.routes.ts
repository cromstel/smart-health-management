import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as controller from '../controllers/forecast.controller.js';
import {
  FORECAST_LOOKBACK_DAYS_MAX,
  FORECAST_LOOKBACK_DAYS_MIN,
} from '../services/pharmacyForecast.service.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * The router answers on two prefixes.
 *
 * Mounted as `app.use('/api/pharmacy', router)` the empty prefix is the one
 * in use, giving `/api/pharmacy/forecast`. The second prefix keeps the same
 * URL working when the router is mounted at `/api` instead.
 */
const PREFIXES = ['', '/pharmacy'] as const;

type RouteMethod = 'get' | 'post' | 'patch' | 'delete';

const register = (
  method: RouteMethod,
  path: string,
  ...handlers: any[]
): void => {
  for (const prefix of PREFIXES) {
    (router[method] as (...args: any[]) => unknown)(`${prefix}${path}`, ...handlers);
  }
};

register(
  'get',
  '/forecast',
  requirePermission('pharmacy', 'view'),
  [
    query('surgeMultiplier')
      .optional()
      .isFloat({ min: 0.1, max: 10 })
      .withMessage('surgeMultiplier must be a number between 0.1 and 10')
      .toFloat(),
    query('lookbackDays')
      .optional()
      .isInt({ min: FORECAST_LOOKBACK_DAYS_MIN, max: FORECAST_LOOKBACK_DAYS_MAX })
      .withMessage('lookbackDays is out of range')
      .toInt(),
    query('targetCoverDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('targetCoverDays is out of range')
      .toInt(),
    validate,
  ],
  controller.getForecast
);

export default router;
