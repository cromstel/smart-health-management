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
router.patch(
  '/:id/subdomain',
  requirePermission('hospitals', 'edit'),
  hospitalController.updateSubdomain
);
router.delete('/:id', requirePermission('hospitals', 'delete'), hospitalController.deleteHospital);

router.get(
  '/:id/departments',
  requirePermission('hospitals', 'view'),
  hospitalController.getHospitalDepartments
);

export default router;
