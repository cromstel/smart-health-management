import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
} from '../controllers/staff.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * The client posts the status as a label ("Active", "On Leave", "Inactive")
 * while the column stores "active", "on_leave" and "inactive". Both spellings
 * are accepted here; the controller normalises the value.
 */
const STATUS_VALUES = ['active', 'on_leave', 'inactive', 'Active', 'On Leave', 'Inactive'];

const staffIdParam = param('id').isInt().withMessage('Invalid staff ID');

router.get('/', requirePermission('staff', 'view'), getStaff);
router.get(
  '/:id',
  requirePermission('staff', 'view'),
  [staffIdParam, validate],
  getStaffById
);
router.post(
  '/',
  requirePermission('staff', 'add'),
  [
    body()
      .custom((value: Record<string, unknown>) => {
        const firstName = value?.firstName ?? value?.first_name;
        const lastName = value?.lastName ?? value?.last_name;
        if (typeof firstName !== 'string' || firstName.trim() === '') {
          throw new Error('First name is required');
        }
        if (typeof lastName !== 'string' || lastName.trim() === '') {
          throw new Error('Last name is required');
        }
        return true;
      })
      .withMessage('First and last name are required'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail()
      .withMessage('Valid email is required'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 20 })
      .withMessage('Phone number is too long'),
    body('role')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage('Role must be a role name'),
    body('roleId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt()
      .withMessage('Role must be a numeric role id'),
    body('hospitalId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt()
      .withMessage('Hospital must be a numeric hospital id'),
    body('departmentId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt()
      .withMessage('Department must be a numeric department id'),
    body('joinDate')
      .optional({ nullable: true, checkFalsy: true })
      .isISO8601()
      .withMessage('Join date must be an ISO date'),
    body('status')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(STATUS_VALUES)
      .withMessage('Invalid status'),
    validate,
  ],
  createStaff
);
router.put(
  '/:id',
  requirePermission('staff', 'edit'),
  [
    staffIdParam,
    body('firstName')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage('First name must be a string'),
    body('lastName')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage('Last name must be a string'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail()
      .withMessage('Valid email is required'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 20 })
      .withMessage('Phone number is too long'),
    body('role')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage('Role must be a role name'),
    body('roleId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt()
      .withMessage('Role must be a numeric role id'),
    body('hospitalId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt()
      .withMessage('Hospital must be a numeric hospital id'),
    body('departmentId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt()
      .withMessage('Department must be a numeric department id'),
    body('joinDate')
      .optional({ nullable: true, checkFalsy: true })
      .isISO8601()
      .withMessage('Join date must be an ISO date'),
    body('status')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(STATUS_VALUES)
      .withMessage('Invalid status'),
    validate,
  ],
  updateStaff
);
router.delete(
  '/:id',
  requirePermission('staff', 'delete'),
  [staffIdParam, validate],
  deleteStaff
);

export default router;
