import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { cacheResponse, invalidateCache, CacheConfigs } from '../middleware/cache.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

// Cache dashboard stats for 1 minute (frequently accessed)
router.get('/stats',
  requirePermission('dashboard', 'view'),
  cacheResponse({
    ttl: 60, // 1 minute
    key: (req) => `dashboard:stats:${req.user?.hospital_id || 'all'}`,
    headers: CacheConfigs.user.headers
  }),
  dashboardController.getDashboardStats
);

// Cache disease trends for 5 minutes
router.get('/disease-trends',
  requirePermission('dashboard', 'view'),
  cacheResponse({
    ttl: 300, // 5 minutes
    key: (req) => `dashboard:disease-trends:${req.user?.hospital_id || 'all'}`,
    headers: CacheConfigs.public.headers
  }),
  dashboardController.getDiseaseTrends
);

// Cache Ghana health data for 10 minutes
router.get('/ghana-health-data',
  requirePermission('dashboard', 'view'),
  cacheResponse({
    ttl: 600, // 10 minutes
    key: () => 'dashboard:ghana-health-data',
    headers: CacheConfigs.public.headers
  }),
  dashboardController.getGhanaHealthData
);

// Import endpoint - invalidate dashboard cache on successful import
router.post('/ghana-health-import',
  requirePermission('dashboard', 'add'),
  invalidateCache(['dashboard:*']),
  dashboardController.importGhanaHealthData
);

// Cache financial forecast for 5 minutes
router.get('/financial-forecast',
  requirePermission('dashboard', 'view'),
  cacheResponse({
    ttl: 300, // 5 minutes
    key: (req) => `dashboard:financial-forecast:${req.user?.hospital_id || 'all'}`,
    headers: CacheConfigs.user.headers
  }),
  dashboardController.getFinancialForecast
);

// Cache resource optimization for 2 minutes
router.get('/resource-optimization',
  requirePermission('dashboard', 'view'),
  cacheResponse({
    ttl: 120, // 2 minutes
    key: (req) => `dashboard:resource-optimization:${req.user?.hospital_id || 'all'}`,
    headers: CacheConfigs.user.headers
  }),
  dashboardController.getResourceOptimization
);

export default router;
