import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { subdomainResolver } from '../middleware/subdomain.js';
import * as portalController from '../controllers/patientPortal.controller.js';

const router = Router();

/**
 * The patient portal.
 *
 * Resolved by hostname first, so a request arriving on a hospital's address
 * carries its tenant before authentication runs.
 *
 * The gate is `authenticate` alone, not a module permission: every handler
 * serves only the caller's own record, matched by the account's email within
 * their hospital. There is no collection here to gate — a caller whose email
 * matches no patient row at their hospital is answered "not found", the same
 * way the self-service account routes behave. A module permission would need
 * a row per role and would still not scope which record is shown.
 */
router.use(subdomainResolver);
router.use(authenticate);

router.get('/', portalController.getMyPortal);
router.get('/appointments', portalController.getMyAppointments);
router.get('/summaries', portalController.getMySharedSummaries);

export default router;
