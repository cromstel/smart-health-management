import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import express from 'express';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import csrf from 'csurf';
import authRoutes from './routes/auth.routes.js';
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
import './jobs/inventory.job.js';
import './jobs/backup.job.js';
import { scheduleBackups } from './services/cron.service.js';
import { initReminderScheduler } from './services/reminderScheduler.service.js';
import { rateLimit } from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT) : 8443;

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not defined in environment variables.');
}
const SESSION_SECRET = process.env.SESSION_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept', 'Cache-Control']
}));
// Request size limits to prevent DoS attacks
app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_URLENCODED_SIZE || '10mb' }));
app.use(morgan('dev'));
app.use(cookieParser() as any);
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax' }
}) as any);

// CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    httpOnly: process.env.NODE_ENV === 'production',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});
app.use(csrfProtection);

// Route to get CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
scheduleBackups();
initReminderScheduler();

// Apply the rate limiting middleware to all API requests
app.use('/api/', apiLimiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
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

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

// HTTP server
app.listen(PORT, () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// HTTPS server (for production or when HTTPS_PORT is defined)
if (HTTPS_PORT) {
  const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH;
  const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;

  if (!HTTPS_KEY_PATH || !HTTPS_CERT_PATH) {
    throw new Error('HTTPS_KEY_PATH and HTTPS_CERT_PATH must be defined in environment variables in production.');
  }

  try {
    const privateKey = fs.readFileSync(HTTPS_KEY_PATH, 'utf8');
    const certificate = fs.readFileSync(HTTPS_CERT_PATH, 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🚀 HTTPS Server running on port ${HTTPS_PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error);
    console.warn(`💡 Ensure certificate files exist at ${HTTPS_KEY_PATH} and ${HTTPS_CERT_PATH} for HTTPS.`);
  }
}
