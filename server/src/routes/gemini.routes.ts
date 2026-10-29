import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { authenticate, enforcePasswordChange } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import * as geminiController from '../controllers/gemini.controller.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * The AI endpoints are the most expensive calls in the API (an outbound model
 * request per hit), so they get their own, tighter budget on top of the
 * global per-IP limiter.
 */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GEMINI_RATE_LIMIT_MAX || '20'),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many AI requests from this IP, please try again later',
});

const insightsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GEMINI_RATE_LIMIT_MAX || '30'),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many clinical insight requests from this IP, please try again later',
});

const messageValidators = [
  body('messages')
    .isArray({ min: 1, max: 50 })
    .withMessage('messages must be an array of 1 to 50 entries'),
  body('messages.*.role')
    .isString()
    .withMessage('each message needs a role')
    .bail()
    .isLength({ max: 32 }),
  body('messages.*.content')
    .isString()
    .withMessage('each message needs content')
    .bail()
    .isLength({ min: 1, max: 8000 })
    .withMessage('each message must be at most 8000 characters'),
  body('modelType')
    .optional({ nullable: true })
    .isString()
    .withMessage('modelType must be a string')
    .bail()
    .isLength({ max: 64 })
    .matches(/^(pro|flash|lite|gemini[a-z0-9._-]{0,50})$/i)
    .withMessage('modelType must be pro, flash, lite or a gemini model id'),
  body('systemInstruction')
    .optional({ nullable: true })
    .isString()
    .withMessage('systemInstruction must be a string')
    .bail()
    .isLength({ max: 4000 })
    .withMessage('systemInstruction must be at most 4000 characters'),
  body('enableSearchGrounding')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('enableSearchGrounding must be a boolean'),
];

const insightsValidators = [
  body('patientId').optional({ nullable: true }).isString().withMessage('patientId must be a string').bail().isLength({ max: 64 }),
  body('patientName').optional({ nullable: true }).isString().withMessage('patientName must be a string').bail().isLength({ max: 255 }),
  body('vitalsList')
    .optional({ nullable: true })
    .isArray({ max: 100 })
    .withMessage('vitalsList must be an array with at most 100 entries'),
  body('vitalsList.*.systolicBp').optional({ nullable: true }).isFloat().withMessage('systolicBp must be a number'),
  body('vitalsList.*.diastolicBp').optional({ nullable: true }).isFloat().withMessage('diastolicBp must be a number'),
  body('vitalsList.*.heartRate').optional({ nullable: true }).isFloat().withMessage('heartRate must be a number'),
  body('vitalsList.*.temperature').optional({ nullable: true }).isFloat().withMessage('temperature must be a number'),
  body('vitalsList.*.recordedAt').optional({ nullable: true }).isString().withMessage('recordedAt must be a string').bail().isLength({ max: 40 }),
  body('vitalsList.*.recordedBy').optional({ nullable: true }).isString().withMessage('recordedBy must be a string').bail().isLength({ max: 255 }),
  body('vitalsList.*.notes').optional({ nullable: true }).isString().withMessage('notes must be a string').bail().isLength({ max: 2000 }),
];

router.post('/chat', chatLimiter, messageValidators, validate, geminiController.chat);
router.post('/insights', insightsLimiter, insightsValidators, validate, geminiController.insights);

export default router;
