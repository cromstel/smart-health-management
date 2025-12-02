import { Router } from 'express'
import { authenticate, enforcePasswordChange, requirePermission } from '../middleware/auth.js'
import { createPrescription, deletePrescription, getPrescription, listPrescriptions, updatePrescription } from '../controllers/prescription.controller.js'

const router = Router()
router.use(authenticate)
router.use(enforcePasswordChange)

router.get('/', requirePermission('pharmacy', 'view'), listPrescriptions)
router.get('/:id', requirePermission('pharmacy', 'view'), getPrescription)
router.post('/', requirePermission('pharmacy', 'add'), createPrescription)
router.put('/:id', requirePermission('pharmacy', 'edit'), updatePrescription)
router.patch('/:id', requirePermission('pharmacy', 'edit'), updatePrescription)
router.delete('/:id', requirePermission('pharmacy', 'delete'), deletePrescription)

export default router