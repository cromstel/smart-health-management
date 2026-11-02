import { Router } from 'express';
import {
  getPreferences,
  setPreference,
  deletePreference,
} from '../controllers/userPreferences.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getPreferences);
router.put('/', setPreference);
router.delete('/:category/:key', deletePreference);

export default router;
