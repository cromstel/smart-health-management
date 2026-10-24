import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, enforcePasswordChange } from '../middleware/auth.js';
import * as notificationController from '../controllers/notification.controller.js';
import {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
} from '../services/notification.service.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * The inbox is personal: there is no permission module for it (the seeded
 * permission matrix has no `notifications` entry, so a requirePermission
 * gate would answer 403 for every user). Authentication is the gate, and
 * the service scopes every query to the caller's own user_id.
 */
router.get(
  '/',
  query('unread')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('unread must be true or false'),
  query('status').optional({ nullable: true }).isIn(NOTIFICATION_STATUSES).withMessage('Invalid status'),
  query('type').optional({ nullable: true }).isIn(NOTIFICATION_TYPES).withMessage('Invalid type'),
  query('limit')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 200 })
    .withMessage('limit must be an integer between 1 and 200')
    .toInt(),
  query('offset')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('offset must be a positive integer')
    .toInt(),
  notificationController.getNotifications
);

// Registered before `/:id` routes so the literal path always wins.
router.post(
  '/scan',
  query('force')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('force must be true or false'),
  notificationController.scanNotifications
);

router.post(
  '/',
  body('type').isIn(NOTIFICATION_TYPES).withMessage('Invalid notification type'),
  body('priority')
    .optional({ nullable: true })
    .isIn(NOTIFICATION_PRIORITIES)
    .withMessage('Invalid priority'),
  body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title is required').escape(),
  body('message')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message must be 5,000 characters or fewer')
    .escape(),
  body('status')
    .optional({ nullable: true })
    .isIn(NOTIFICATION_STATUSES)
    .withMessage('Invalid status'),
  body('patientId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('patientId must be a positive integer')
    .toInt(),
  body('patientName')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('patientName must be 255 characters or fewer')
    .escape(),
  body('appointmentId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('appointmentId must be a positive integer')
    .toInt(),
  body('doctorName')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('doctorName must be 255 characters or fewer')
    .escape(),
  body('appointmentTime')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('appointmentTime must be 50 characters or fewer')
    .escape(),
  body('actionUrl')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('actionUrl must be 255 characters or fewer')
    .escape(),
  body('data')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (typeof value !== 'object') {
        throw new Error('data must be an object');
      }
      return true;
    })
    .withMessage('data must be an object'),
  notificationController.createNotification
);

router.patch(
  '/read-all',
  notificationController.markAllNotificationsRead
);

router.patch(
  '/:id/read',
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  notificationController.markNotificationRead
);

router.patch(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  body('status').isIn(NOTIFICATION_STATUSES).withMessage('Invalid status'),
  notificationController.updateNotification
);

router.delete(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  notificationController.deleteNotification
);

export default router;
