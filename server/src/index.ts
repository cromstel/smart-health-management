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
import { getSecret } from './config/env.js';
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
import './jobs/inventory.job.js';
import './jobs/backup.job.js';
import { scheduleBackups } from './services/cron.service.js';
import { rateLimit } from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
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
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax' }
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

app.post('/api/analytics/event', (_req, res) => {
  res.json({ status: 'success', synced: true });
});

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

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// HTTP server
app.listen(PORT, () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// HTTPS server (for production or when HTTPS_PORT is defined)
if (process.env.NODE_ENV === 'production' || HTTPS_PORT) {
  try {
    const privateKey = fs.readFileSync(path.join(__dirname, '../certs/key.pem'), 'utf8');
    const certificate = fs.readFileSync(path.join(__dirname, '../certs/cert.pem'), 'utf8');
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
