import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as hospitalController from '../controllers/hospital.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('hospitals', 'view'), hospitalController.getHospitals);
router.get('/:id', requirePermission('hospitals', 'view'), hospitalController.getHospitalById);
router.post('/', requirePermission('hospitals', 'add'), hospitalController.createHospital);
router.put('/:id', requirePermission('hospitals', 'edit'), hospitalController.updateHospital);
router.delete('/:id', requirePermission('hospitals', 'delete'), hospitalController.deleteHospital);

router.get('/:id/departments', requirePermission('hospitals', 'view'), async (req, res) => {
  try {
    const { id } = req.params;
    const [departments] = await import('../config/database.js').then(m => m.default.query('SELECT * FROM departments WHERE hospital_id = ?', [id]));
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

export default router;