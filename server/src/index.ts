// Must stay the first import: it loads .env and .env.local. Every other import
// is hoisted above any statement in this file, so loading env in the module
// body (as this used to do) ran too late -- config/database.ts had already
// built its connection pool from an empty process.env.
import './config/env.js';
import path from 'path';
import fs from 'fs';
import https from 'https';

import express from 'express';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { generateCsrfToken, validateCsrfToken } from './middleware/csrf.js';
import { getSecret, getPort } from './config/env.js';
import { allowedFrontendOrigins, DEFAULT_API_PORT, DEFAULT_HTTPS_PORT } from './config/runtime.js';
import authRoutes from './routes/auth.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import patientRoutes from './routes/patient.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import staffRoutes from './routes/staff.routes.js';
import documentRoutes from './routes/document.routes.js';
import pharmacyRoutes from './routes/pharmacy.routes.js';
import financialRoutes from './routes/financial.routes.js';
import roleRoutes from './routes/role.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import superAdminRoutes from './routes/superAdmin.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import batchRoutes from './routes/batch.routes.js';
import prescriptionRoutes from './routes/prescription.routes.js';
import patientLoadPredictionRoutes from './routes/patientLoadPrediction.routes.js';
import demoRequestRoutes from './routes/demoRequest.routes.js';
import vitalsRoutes from './routes/vitals.routes.js';
import sharedSummaryRoutes from './routes/sharedSummary.routes.js';
import geminiRoutes from './routes/gemini.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import clinicalNotesRoutes from './routes/clinicalNotes.routes.js';
import medicationAdministrationRoutes from './routes/medicationAdministration.routes.js';
import dispensingEventRoutes from './routes/dispensingEvent.routes.js';
import forecastRoutes from './routes/forecast.routes.js';
import emergencyRoutes from './routes/emergency.routes.js';
import './jobs/inventory.job.js';
import './jobs/backup.job.js';
import { scheduleBackups } from './services/cron.service.js';
import { rateLimit } from 'express-rate-limit';

const app = express();
// The ports are configuration. `getPort` uses the same rule as `getSecret`:
// a missing port is a hard startup error in production, and a development
// environment falls back to the documented default.
const PORT = getPort('PORT', DEFAULT_API_PORT);
const HTTPS_PORT = getPort('HTTPS_PORT', DEFAULT_HTTPS_PORT);
// The HTTPS listener only starts when it is asked for: in production, or when
// HTTPS_PORT is configured explicitly.
const httpsRequested =
  process.env.NODE_ENV === 'production' || Boolean(process.env.HTTPS_PORT?.trim());
const SESSION_SECRET = getSecret('SESSION_SECRET', 'dev-session-only-secret'); // Hard-fails in production when unset

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting middleware
//
// This is the broad per-IP ceiling across all /api routes, and it is the limit
// that actually bounded the Playwright suite: at 100 requests per 15 minutes a
// single browser run exceeds it, after which auth tests fail with 429 for a
// reason unrelated to the code under test. Overridable so a test run can raise
// it, with the secure default preserved everywhere else.
const apiLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const apiLimitWindowMs = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000),
  10
);

const apiLimiter = rateLimit({
  windowMs: apiLimitWindowMs,
  max: apiLimitMax,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Middleware
app.use(helmet());
// FRONTEND_URL may list several origins, comma separated, so a developer whose
// default app port is occupied by another process can run on a free port without
// also having to edit code. Single value still behaves exactly as before.
const allowedOrigins = allowedFrontendOrigins();

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin and non-browser callers send no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  // Required for the app to read the CSRF token: response headers other than
  // the safelisted ones are withheld from cross-origin scripts unless listed.
  // Without this the X-XSRF-Token header is invisible to the client even though
  // the server sends it.
  exposedHeaders: ['X-XSRF-Token']
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser() as any);
app.use(session({
  secret: SESSION_SECRET,
  name: process.env.SESSION_COOKIE_NAME || 'shms_session',
  resave: process.env.SESSION_RESAVE === 'true',
  saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED !== 'false',
  cookie: {
    secure: process.env.SESSION_SECURE
      ? process.env.SESSION_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    sameSite: (process.env.SESSION_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
    ...(process.env.SESSION_COOKIE_MAX_AGE
      ? { maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE, 10) }
      : {}),
  }
}) as any);
app.use(generateCsrfToken); // Generate token for all requests
app.use(validateCsrfToken); // Validate token for non-GET/HEAD/OPTIONS requests
scheduleBackups();

// Apply the rate limiting middleware to all API requests
app.use('/api/', apiLimiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Issues a CSRF token for clients that cannot read the cookie, because the API
// is on a different origin than the app. GET only, returns no data, and the
// token is derived from the caller's own session, so this grants nothing that a
// GET to any other endpoint would not already grant.
app.get('/api/auth/csrf', (_req, res) => {
  res.json({ ok: true });
});

// The analytics beacon is mounted below with the analytics router, which
// persists the event instead of discarding it.

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/patient-load-predictions', patientLoadPredictionRoutes);
app.use('/api/demo-requests', demoRequestRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/shared', sharedSummaryRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/clinical-notes', clinicalNotesRoutes);
app.use('/api/medication-administrations', medicationAdministrationRoutes);
app.use('/api/dispensing-events', dispensingEventRoutes);
// The forecast router registers its own `/forecast` path, so it is mounted at
// the pharmacy prefix rather than at the full path.
app.use('/api/pharmacy', forecastRoutes);
app.use('/api/emergency', emergencyRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// HTTP server
app.listen(PORT, () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// HTTPS server (for production or when HTTPS_PORT is defined)
if (httpsRequested) {
  try {
    // The certificate locations are configuration. They were fixed relative to
    // this file, so a deployment whose certificates live elsewhere had no way
    // to point at them.
    const certPath = process.env.HTTPS_CERT_PATH
      ? path.resolve(process.cwd(), process.env.HTTPS_CERT_PATH)
      : path.join(__dirname, '../certs/cert.pem');
    const keyPath = process.env.HTTPS_KEY_PATH
      ? path.resolve(process.cwd(), process.env.HTTPS_KEY_PATH)
      : path.join(__dirname, '../certs/key.pem');

    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const certificate = fs.readFileSync(certPath, 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🚀 HTTPS Server running on port ${HTTPS_PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error);
    console.warn('💡 Ensure server/certs/key.pem and server/certs/cert.pem exist for HTTPS.');
  }
}
