import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as documentController from '../controllers/document.controller.js';
import * as storageController from '../controllers/storage.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

router.get('/storage/usage', requirePermission('documents', 'view'), storageController.getStorageUsage);
router.get('/', requirePermission('documents', 'view'), documentController.getDocuments);
router.get('/:id', requirePermission('documents', 'view'), documentController.getDocumentById);
router.post('/', requirePermission('documents', 'add'), upload.single('document'), documentController.createDocument);
router.put('/:id', requirePermission('documents', 'edit'), documentController.updateDocument);
router.delete('/:id', requirePermission('documents', 'delete'), documentController.deleteDocument);
router.get('/:id/download', requirePermission('documents', 'view'), documentController.downloadDocument);
router.get('/:id/preview', requirePermission('documents', 'view'), documentController.previewDocument);

// Cloud storage OAuth flows (Google Drive, OneDrive)
router.get('/onedrive/auth', documentController.initiateOneDriveOAuth);
router.get('/googledrive/auth', documentController.initiateGoogleDriveOAuth);
router.get('/onedrive/callback', documentController.handleOneDriveCallback);
router.get('/googledrive/callback', documentController.handleGoogleDriveCallback);

export default router;