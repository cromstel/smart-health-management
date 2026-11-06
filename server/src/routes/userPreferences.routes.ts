import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getPreferences,
  setPreference,
  deletePreference,
} from '../controllers/userPreferences.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';

const router = Router();

router.use(authenticate);

// A preference is addressed by (account, category, key). The category and key
// are bounded exactly as the columns are, so a value that the database cannot
// store is refused with a 400 that says why instead of a 500 from the driver.
const categoryRule = (location: 'body' | 'param', field: string) =>
  location === 'body'
    ? body(field)
        .isString()
        .withMessage('category must be a string')
        .bail()
        .trim()
        .isLength({ min: 1, max: 32 })
        .withMessage('category must be between 1 and 32 characters')
        .bail()
        .matches(/^[a-z][a-z0-9_]*$/)
        .withMessage('category must be lowercase letters, digits or underscores')
    : param(field)
        .isString()
        .withMessage('category must be a string')
        .bail()
        .trim()
        .isLength({ min: 1, max: 32 })
        .withMessage('category must be between 1 and 32 characters')
        .bail()
        .matches(/^[a-z][a-z0-9_]*$/)
        .withMessage('category must be lowercase letters, digits or underscores');

const keyRule = (location: 'body' | 'param', field: string) =>
  location === 'body'
    ? body(field)
        .isString()
        .withMessage('key must be a string')
        .bail()
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('key must be between 1 and 64 characters')
        .bail()
        .matches(/^[A-Za-z0-9_.:-]+$/)
        .withMessage('key must be letters, digits or one of _ . : -')
    : param(field)
        .isString()
        .withMessage('key must be a string')
        .bail()
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('key must be between 1 and 64 characters')
        .bail()
        .matches(/^[A-Za-z0-9_.:-]+$/)
        .withMessage('key must be letters, digits or one of _ . : -');

router.get('/', getPreferences);

router.put(
  '/',
  categoryRule('body', 'category'),
  keyRule('body', 'key'),
  // The value is opaque to the server (a theme name, a JSON layout), so it is
  // bounded rather than interpreted. NULL is the explicit "unset" value.
  body('value')
    .optional({ nullable: true })
    .isString()
    .withMessage('value must be a string or null')
    .bail()
    .isLength({ max: 16384 })
    .withMessage('value must be at most 16384 characters'),
  validate,
  setPreference
);

router.delete(
  '/:category/:key',
  categoryRule('param', 'category'),
  keyRule('param', 'key'),
  validate,
  deletePreference
);

export default router;
