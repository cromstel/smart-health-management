import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as documentController from '../controllers/document.controller.js';
import * as storageController from '../controllers/storage.controller.js';
import { validate } from '../middleware/validator.js';
import { DOCUMENT_CATEGORIES, DOCUMENT_STORAGE_PROVIDERS, CATEGORY_MAP } from '../utils/documents.js';

const router = Router();

// Cloud storage OAuth callbacks are top-level browser navigations, so they
// carry no bearer token. They are protected by a single-use, expiring state
// transaction created by the authenticated initiator below, and are registered
// before the authentication middleware for that reason.
router.get('/onedrive/callback', documentController.handleOneDriveCallback);
router.get('/googledrive/callback', documentController.handleGoogleDriveCallback);

router.use(authenticate);
router.use(enforcePasswordChange);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // The declared MIME type is attacker-controlled; the extension is the
    // only part the server can check without reading the bytes. Both must be
    // on the allow-list.
    const ext = (file.originalname || '').toLowerCase().match(/\.[^.]+$/)?.[0];
    const allowedExts = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.zip']);
    if (!ext || !allowedExts.has(ext)) {
      return cb(new Error('File type not allowed'));
    }
    cb(null, true);
  },
});

router.get('/storage/usage', requirePermission('documents', 'view'), storageController.getStorageUsage);
router.get('/', requirePermission('documents', 'view'), documentController.getDocuments);
router.get('/:id/download', requirePermission('documents', 'view'), documentController.downloadDocument);
router.get('/:id/preview', requirePermission('documents', 'view'), documentController.previewDocument);
router.get('/:id', requirePermission('documents', 'view'), documentController.getDocumentById);

router.post(
  '/',
  requirePermission('documents', 'add'),
  upload.single('document'),
  [
    body('patientId').optional().isInt({ min: 1 }).withMessage('patientId must be a positive integer'),
    body('category').optional().custom((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return true;
      const s = String(v).trim();
      if ((DOCUMENT_CATEGORIES as readonly string[]).includes(s)) return true;
      if (Object.prototype.hasOwnProperty.call(CATEGORY_MAP, s)) return true;
      throw new Error('Invalid document category');
    }),
    body('notes').optional().isString().isLength({ max: 2000 }).withMessage('Notes too long'),
    body('tags').optional().isString().isLength({ max: 500 }).withMessage('Tags too long'),
    body('storageLocation').optional().isIn(DOCUMENT_STORAGE_PROVIDERS).withMessage('Invalid storage location'),
  ],
  validate,
  documentController.createDocument
);

router.put(
  '/:id',
  requirePermission('documents', 'edit'),
  [
    param('id').isString().notEmpty(),
    body('name').optional().isString().isLength({ max: 255 }),
    body('category').optional().custom((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return true;
      const s = String(v).trim();
      if ((DOCUMENT_CATEGORIES as readonly string[]).includes(s)) return true;
      if (Object.prototype.hasOwnProperty.call(CATEGORY_MAP, s)) return true;
      throw new Error('Invalid document category');
    }),
    body('notes').optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  documentController.updateDocument
);

router.delete('/:id', requirePermission('documents', 'delete'), documentController.deleteDocument);

// Cloud storage OAuth flows (Google Drive, OneDrive). The initiators are
// authenticated and permission-gated; the callbacks are registered above.
router.get('/onedrive/auth', requirePermission('documents', 'edit'), documentController.initiateOneDriveOAuth);
router.get('/googledrive/auth', requirePermission('documents', 'edit'), documentController.initiateGoogleDriveOAuth);

export default router;