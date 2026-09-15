import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { submitDemoRequest } from '../controllers/demoRequest.controller.js';
import { validate } from '../middleware/validator.js';

const router = Router();

const demoRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many demo requests from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/',
  demoRequestLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters').escape(),
    body('email').trim().isEmail().withMessage('A valid work email is required').normalizeEmail(),
    body('organization').trim().isLength({ min: 2, max: 160 }).withMessage('Organisation must be between 2 and 160 characters').escape(),
    body('role').trim().isLength({ min: 2, max: 120 }).withMessage('Role must be between 2 and 120 characters').escape(),
    body('organizationSize').isIn(['1-50', '51-250', '251-1000', '1000+']).withMessage('Select an organisation size'),
    body('preferredContact').isIn(['email', 'phone']).withMessage('Select a preferred contact method'),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).matches(/^[0-9+().\-\s]*$/).withMessage('Enter a valid phone number'),
    body('phone').if(body('preferredContact').equals('phone')).trim().isLength({ min: 7, max: 30 }).withMessage('A phone number is required when phone contact is selected'),
    body('message').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Message must be 1,000 characters or fewer').escape(),
    body('website').optional().isString().isLength({ max: 200 }),
    validate,
  ],
  submitDemoRequest,
);

export default router;
