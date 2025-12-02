import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getDocuments, createDocument, downloadDocument, previewDocument, initiateOneDriveOAuth, initiateGoogleDriveOAuth, handleOneDriveCallback, handleGoogleDriveCallback } from '../controllers/document.controller.js';
import { getStorageUsage } from '../controllers/storage.controller.js';
import upload from '../middleware/multer.js';
import { downloadLimiter } from '../middleware/document.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('documents', 'view'), getDocuments);
router.post('/', requirePermission('documents', 'add'), upload.single('document'), createDocument);
router.get('/:id/download', requirePermission('documents', 'view'), downloadLimiter, downloadDocument);
router.get('/:id/preview', requirePermission('documents', 'view'), downloadLimiter, previewDocument);
router.get('/storage/usage', requirePermission('documents', 'view'), getStorageUsage);

router.get('/oauth/onedrive/callback', handleOneDriveCallback);
router.get('/oauth/googledrive/callback', handleGoogleDriveCallback);

router.get('/oauth/onedrive/initiate', initiateOneDriveOAuth);
router.get('/oauth/googledrive/initiate', initiateGoogleDriveOAuth);

export default router;
