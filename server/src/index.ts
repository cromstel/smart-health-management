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
import pool from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { generateCsrfToken, validateCsrfToken } from './middleware/csrf.js';
import { getSecret } from './config/env.js';
import { corsOptions } from './middleware/cors.js';
import { createSessionStore } from './config/session.js';
import { apiPort, optionalHttpsPort, trustProxyHops } from './config/runtime.js';
import { frontendDistDir } from './config/frontend.js';
import { resolveConfiguredPath } from './config/paths.js';
import { frontendFallback, frontendStatic } from './middleware/serveFrontend.js';
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
import onboardRoutes from './routes/onboard.routes.js';
import patientPortalRoutes from './routes/patientPortal.routes.js';
import './jobs/inventory.job.js';
import './jobs/backup.job.js';
import { scheduleBackups } from './services/cron.service.js';
import { rateLimit } from 'express-rate-limit';

const app = express();
// The ports are configuration, and they are required. A missing port is
// reported by name rather than guessed: a guessed port moves the service
// somewhere nobody is listening.
const PORT = apiPort();
// The HTTPS listener is only opened when a deployment asks for one. A
// deployment that terminates TLS at the platform's proxy has no use for it,
// and demanding the port from such a deployment would stop it from starting.
const HTTPS_PORT = optionalHttpsPort();
const SESSION_SECRET = getSecret('SESSION_SECRET', 'dev-session-only-secret'); // Hard-fails in production when unset

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting middleware
//
// This is the broad per-IP ceiling across all /api routes. It is overridable
// because a test run has to be able to raise it: at the default ceiling a
// single browser run exceeds it, after which auth tests fail with 429 for a
// reason unrelated to the code under test.
//
// The default is set for a real deployment rather than for a test. A hospital
// reaches the service through one address, so every member of staff and
// every device on the network share one allowance when the limit counts the
// address rather than the person. A ceiling low enough to stop one client
// from abusing the service is low enough to lock a ward out of it.
//
// The sign-in and second-factor routes carry their own, much tighter
// ceilings, which is where an abuse of the service actually costs something.
const apiLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000', 10);
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
// The framework announces itself in a header by default, which tells a
// visitor which server software is in use and nothing else. It is turned
// off: the answer to a request says what the request was about, not what
// answered it.
app.disable('x-powered-by');
app.use(helmet());
// FRONTEND_URL may list several origins, comma separated, so a developer whose
// default app port is occupied by another process can run on a free port without
// also having to edit code. Single value still behaves exactly as before. The
// list is read once, when the service starts, and every request is answered
// against it.
app.use(cors(corsOptions()));
// The body limit is stated rather than left to the framework's default, so
// that the limit a deployment has is the one its configuration says it has.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_BODY_LIMIT || '1mb' }));
// The access log records the request and its answer. It records nothing
// about the person who made it: no body, no session, and no query string.
//
// The query string is dropped because one of the streams carries its token
// there, and a token in the access log is a token in every copy of the log.
// The format is the one a server operator reads.
const accessLogFormat = (tokens: any, req: any, res: any): string => {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  return `${req.method} ${path} ${res.statusCode} ${tokens['response-time']}ms`;
};
app.use(morgan(process.env.NODE_ENV === 'production' ? accessLogFormat : ('dev' as any)));
app.use(cookieParser() as any);
// The application is published through a proxy that terminates TLS. Trusting
// that hop is what makes the request look like the secure one it is: without
// it the secure session cookie is never set, so no session is established
// and no one can sign in.
const proxyHops = trustProxyHops();
if (proxyHops > 0) {
  app.set('trust proxy', proxyHops);
}
// The sessions are kept in the database, so that a restart does not sign
// everybody out and so that the instances of the service share them. The store
// is chosen before the service starts listening, and a database that cannot
// be reached leaves the service running on the in-memory store rather than
// stopping it: the sessions are a convenience, and the service's other work
// must not stop because of them.
//
// The store is made without waiting for anything. A module that waits at the
// top level turns the entry point into a promise, and the platform loads the
// entry point with `require()`, which cannot load a module graph with a
// top-level wait in it.
const sessionStore = createSessionStore();
app.use(session({
  secret: SESSION_SECRET,
  name: process.env.SESSION_COOKIE_NAME || 'shms_session',
  resave: process.env.SESSION_RESAVE === 'true',
  saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED !== 'false',
  store: sessionStore.store,
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

// The API is mounted below. The uploaded documents are deliberately NOT
// served as static files: they are the patient's records, and a static route
// hands every one of them to anybody who can guess or derive the address,
// with no sign-in and no check that the person asking is allowed to see it.
// They are served by the document routes instead, which authenticate the
// caller, check the permission and check whose record it is.

// The service's own status. It sits under the API prefix because the root
// path belongs to the application itself whenever a front-end build is
// present.
app.get('/api/health', (_req, res) => {
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
// Public hospital registration (no account yet; the row it creates is
// inactive until confirmed) and the per-hospital patient portal, which
// resolves its tenant from the request hostname.
app.use('/api/onboard', onboardRoutes);
app.use('/api/patient-portal', patientPortalRoutes);

// ---------------------------------------------------------------------------
// The front-end
//
// In a deployment the platform sends every request for the site to this
// process, so this process answers the page requests as well as the API
// requests. The build's assets are served from disk, and any other page
// request is answered with the entry document, because the application reads
// its routes from the address bar.
//
// The API prefix is left alone: an unknown API route has to answer with a
// JSON error, not with the application's HTML. A request for an uploaded
// file that does not exist is left alone for the same reason.
// ---------------------------------------------------------------------------
const webRoot = frontendDistDir();

if (webRoot) {
  app.use(frontendStatic(webRoot));
  app.use(frontendFallback(webRoot));
} else {
  // With no front-end build there is no application document to serve, so the
  // root answers with the service's own status.
  app.get('/', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// HTTP server
app.listen(PORT, () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// HTTPS server
//
// A deployment that terminates TLS at the platform's proxy does not need a
// listener of its own, and a deployment that does need one has to say where
// its certificate is. The listener is therefore opened only when a
// certificate and its key are both present, and the port is only required in
// that case. The certificate locations are configuration, so a deployment
// whose certificates live elsewhere can point at them.
const certPath = resolveConfiguredPath(
  process.env.HTTPS_CERT_PATH,
  path.join(__dirname, '../certs/cert.pem')
);
const keyPath = resolveConfiguredPath(
  process.env.HTTPS_KEY_PATH,
  path.join(__dirname, '../certs/key.pem')
);

const certificatesPresent = fs.existsSync(certPath) && fs.existsSync(keyPath);

if (certificatesPresent && HTTPS_PORT !== null) {
  try {
    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const certificate = fs.readFileSync(certPath, 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🚀 HTTPS Server running on port ${HTTPS_PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error);
  }
} else if (certificatesPresent) {
  console.warn(
    '⚠️  A TLS certificate was found but HTTPS_PORT is not set, so the HTTPS listener was not opened.'
  );
} else {
  console.log(
    'ℹ️  No TLS certificate was found, so the server is serving plain HTTP. TLS is expected to be terminated upstream.'
  );
}

// The service is stopped by the platform that runs it, and a process that is
// stopping has no use for the connections it is holding. The session store
// keeps a timer running and shares the service's pool, so the store is closed
// and the pool is ended on the way out instead of being dropped.
//
// The exit status is the one the process would have had if it had not caught
// the signal at all, so that a platform watching the service is told the same
// thing it was told before.
const stop = async (signal: string, exitCode: number): Promise<void> => {
  console.log(`ℹ️  ${signal} received: closing the session store and the database connections.`);

  try {
    await sessionStore.close();
  } catch (error) {
    console.warn('⚠️  The session store did not close cleanly:', error);
  }

  try {
    await pool.end();
  } catch (error) {
    console.warn('⚠️  The database connections did not close cleanly:', error);
  }

  process.exit(exitCode);
};

process.on('SIGTERM', () => { void stop('SIGTERM', 143); });
process.on('SIGINT', () => { void stop('SIGINT', 130); });
