import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { predictPatientLoads } from '../services/patientLoadPrediction.service.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('dashboard', 'view'), async (_req, res) => {
  try {
    const predictions = await predictPatientLoads();
    res.json({ predictions });
  } catch (error) {
    console.error('Get patient load predictions error:', error);
    res.status(500).json({ error: 'Failed to fetch patient load predictions' });
  }
});

router.post('/refresh', requirePermission('dashboard', 'edit'), async (_req, res) => {
  try {
    const predictions = await predictPatientLoads();
    res.json({ message: 'Forecast refreshed', predictions });
  } catch (error) {
    console.error('Refresh patient load forecast error:', error);
    res.status(500).json({ error: 'Failed to refresh forecast' });
  }
});

export default router;