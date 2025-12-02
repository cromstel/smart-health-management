import { Router } from 'express'
import { authenticate, enforcePasswordChange, requirePermission } from '../middleware/auth.js'
import { createBatch, expiredBatches, getBatches, recallBatch, updateBatch } from '../controllers/batch.controller.js'

const router = Router()
router.use(authenticate)
router.use(enforcePasswordChange)

router.get('/', requirePermission('pharmacy', 'view'), getBatches)
router.post('/', requirePermission('pharmacy', 'add'), createBatch)
router.put('/:id', requirePermission('pharmacy', 'edit'), updateBatch)
router.patch('/:id', requirePermission('pharmacy', 'edit'), updateBatch)
router.post('/:id/recall', requirePermission('pharmacy', 'edit'), recallBatch)
router.get('/expired', requirePermission('pharmacy', 'view'), expiredBatches)

export default router