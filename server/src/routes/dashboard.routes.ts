import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/stats', requirePermission('dashboard', 'view'), dashboardController.getDashboardStats);
router.get('/disease-trends', requirePermission('dashboard', 'view'), dashboardController.getDiseaseTrends);
router.get('/ghana-health-data', requirePermission('dashboard', 'view'), dashboardController.getGhanaHealthData);
router.post('/ghana-health-import', requirePermission('dashboard', 'add'), dashboardController.importGhanaHealthData);
router.get('/financial-forecast', requirePermission('dashboard', 'view'), dashboardController.getFinancialForecast);
router.get('/resource-optimization', requirePermission('dashboard', 'view'), dashboardController.getResourceOptimization);

export default router;
