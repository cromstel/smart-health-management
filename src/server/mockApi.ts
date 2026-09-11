import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

// Initial data seeded from seed.sql and demo records
const users: Array<{ id: string; role_id: number; email: string; password?: string; name: string; role: string; permissions: string[]; hospital_id?: string; status?: string }> = [
  { id: '1', role_id: 1, email: 'superadmin@smarthealth.com', password: 'April--2024!!!!', name: 'Super Admin', role: 'super_admin', permissions: ['all:view', 'all:add', 'all:edit', 'all:delete'], hospital_id: 'HOSP-001', status: 'active' },
  { id: '2', role_id: 2, email: 'admin@smarthealth.com', password: 'Pass@135709', name: 'Admin User', role: 'admin', permissions: ['all:view', 'all:add', 'all:edit', 'all:delete'], hospital_id: 'HOSP-001', status: 'active' },
  { id: '3', role_id: 3, email: 'doctor@smarthealth.com', password: 'Demo@135790', name: 'Dr. John Smith', role: 'doctor', permissions: ['patients:view', 'patients:add', 'patients:edit', 'appointments:view', 'appointments:add', 'appointments:edit', 'medical_history:view', 'medical_history:add', 'medical_history:edit'], hospital_id: 'HOSP-001', status: 'active' },
  { id: '4', role_id: 4, email: 'patient@smarthealth.com', password: 'P@ssword135', name: 'John Doe', role: 'patient', permissions: ['appointments:view', 'appointments:add', 'medical_history:view'], hospital_id: 'HOSP-001', status: 'active' },
];

// In-memory store for secure temporary view-only patient summary links
const sharedLinks = new Map<string, { patientId: string; patientName: string; expiresAt: string }>();

// DEV-only reflection of the user's TOTP enrollment flag so the Settings 2FA
// card behaves coherently while running against the mock API. The real server
// is the source of truth in production.
let mockTotpEnabled = false;
let mockRecoveryCodes: string[] = [];
const DEMO_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

const hospitals = [
  { id: '1', hospital_id: 'HOSP-001', name: 'General Hospital', address: '123 Main St, Accra, Ghana', phone: '+233 30 212 3456', email: 'contact@generalhospital.gh', status: 'active', beds: 250, occupancy: 198 },
  { id: '2', hospital_id: 'HOSP-002', name: 'Ridge Regional Hospital', address: 'Castle Rd, Accra, Ghana', phone: '+233 30 222 7890', email: 'info@ridgehospital.gh', status: 'active', beds: 420, occupancy: 350 },
];

const departments = [
  { id: '1', hospital_id: '1', name: 'Cardiology', head_of_department: 'Dr. Heart', staff_count: 14 },
  { id: '2', hospital_id: '1', name: 'Orthopedics', head_of_department: 'Dr. Bones', staff_count: 10 },
  { id: '3', hospital_id: '1', name: 'Emergency', head_of_department: 'Dr. Quick', staff_count: 22 },
  { id: '4', hospital_id: '1', name: 'Pediatrics', head_of_department: 'Dr. Care', staff_count: 12 },
];

const staff = [
  { id: '1', staff_id: 'STAFF-001', user_id: '3', first_name: 'John', last_name: 'Smith', name: 'Dr. John Smith', role: 'Doctor', department: 'Cardiology', department_id: '1', hospital: 'General Hospital', hospital_id: 'HOSP-001', email: 'doctor@smarthealth.com', phone: '+233 24 555 5678', joinDate: '2022-01-15', status: 'active' },
  { id: '2', staff_id: 'STAFF-002', user_id: '5', first_name: 'Sarah', last_name: 'Mensah', name: 'Sarah Mensah', role: 'Nurse', department: 'Emergency', department_id: '3', hospital: 'General Hospital', hospital_id: 'HOSP-001', email: 'sarah.m@smarthealth.com', phone: '+233 24 555 9012', joinDate: '2023-03-10', status: 'active' },
  { id: '3', staff_id: 'STAFF-003', user_id: '6', first_name: 'Kwame', last_name: 'Osei', name: 'Dr. Kwame Osei', role: 'Surgeon', department: 'Orthopedics', department_id: '2', hospital: 'General Hospital', hospital_id: 'HOSP-001', email: 'k.osei@smarthealth.com', phone: '+233 24 555 3421', joinDate: '2021-08-20', status: 'active' },
];

const patients = [
  { id: '1', patient_id: 'PAT-001', first_name: 'John', last_name: 'Doe', name: 'John Doe', age: 45, gender: 'male', phone: '+233 24 555 8765', email: 'patient@smarthealth.com', address: '456 Oak Ave, Accra', hospital_id: 'HOSP-001', hospital: 'General Hospital', status: 'active', bloodGroup: 'O+', last_visit: '2026-03-01', medicalConditions: ['Hypertension'] },
  { id: '2', patient_id: 'PAT-002', first_name: 'Grace', last_name: 'Appiah', name: 'Grace Appiah', age: 34, gender: 'female', phone: '+233 20 444 1234', email: 'grace.a@example.com', address: '78 Palm Grove, Tema', hospital_id: 'HOSP-001', hospital: 'General Hospital', status: 'active', bloodGroup: 'A+', last_visit: '2026-03-04', medicalConditions: ['Asthma'] },
  { id: '3', patient_id: 'PAT-003', first_name: 'Kofi', last_name: 'Annan', name: 'Kofi Annan', age: 52, gender: 'male', phone: '+233 55 333 7890', email: 'kofi.annan@example.com', address: '12 Independence Ave, Accra', hospital_id: 'HOSP-001', hospital: 'General Hospital', status: 'active', bloodGroup: 'B+', last_visit: '2026-02-28', medicalConditions: ['Type 2 Diabetes'] },
];

const appointments = [
  { id: '1', appointment_id: 'APP-001', patient_id: '1', patient_name: 'John Doe', doctor_id: '1', doctor_name: 'Dr. John Smith', department: 'Cardiology', department_id: '1', appointment_date: '2026-09-10', appointment_time: '10:00 AM', type: 'Consultation', status: 'scheduled', hospital_id: 'HOSP-001', notes: 'Routine cardiovascular follow-up' },
  { id: '2', appointment_id: 'APP-002', patient_id: '2', patient_name: 'Grace Appiah', doctor_id: '1', doctor_name: 'Dr. John Smith', department: 'Emergency', department_id: '3', appointment_date: '2026-09-10', appointment_time: '11:30 AM', type: 'Follow-up', status: 'confirmed', hospital_id: 'HOSP-001', notes: 'Asthma inhaler refill review' },
  { id: '3', appointment_id: 'APP-003', patient_id: '3', patient_name: 'Kofi Annan', doctor_id: '3', doctor_name: 'Dr. Kwame Osei', department: 'Orthopedics', department_id: '2', appointment_date: '2026-09-11', appointment_time: '02:00 PM', type: 'Checkup', status: 'scheduled', hospital_id: 'HOSP-001', notes: 'Knee joint mobility evaluation' },
];

const medicines = [
  { id: '1', name: 'Amoxicillin 500mg', category: 'Antibiotic', stock: 350, unitPrice: 12.50, expiryDate: '2027-06-30', supplier: 'PharmaGhana Ltd', minStock: 50 },
  { id: '2', name: 'Paracetamol 500mg', category: 'Analgesic', stock: 1200, unitPrice: 2.00, expiryDate: '2028-01-15', supplier: 'HealthCare Dist', minStock: 200 },
  { id: '3', name: 'Amlodipine 5mg', category: 'Antihypertensive', stock: 450, unitPrice: 8.75, expiryDate: '2026-11-20', supplier: 'MediCorp Int', minStock: 60 },
  { id: '4', name: 'Salbutamol Inhaler 100mcg', category: 'Respiratory', stock: 85, unitPrice: 24.00, expiryDate: '2027-03-10', supplier: 'PharmaGhana Ltd', minStock: 30 },
];

const suppliers = [
  { id: '1', name: 'PharmaGhana Ltd', contactPerson: 'Emmanuel Darko', phone: '+233 30 299 1122', email: 'orders@pharmaghana.com', address: 'Industrial Area, Accra', status: 'active' },
  { id: '2', name: 'HealthCare Dist', contactPerson: 'Beatrice Asante', phone: '+233 30 288 3344', email: 'sales@healthcaredist.com', address: 'Ring Road Central, Accra', status: 'active' },
];

const purchaseOrders = [
  { id: '1', poNumber: 'PO-2026-001', supplier: 'PharmaGhana Ltd', supplierId: '1', items: [{ medicineId: '1', name: 'Amoxicillin 500mg', quantity: 200, unitPrice: 10.00 }], totalAmount: 2000.00, status: 'approved', orderDate: '2026-03-01' },
];

const accounts = [
  { id: '1', account_number: 'ACC-001', name: 'Operating Account', type: 'Asset', balance: 142500.00, currency: 'USD' },
  { id: '2', account_number: 'ACC-002', name: 'Pharmacy Revenue', type: 'Revenue', balance: 78900.00, currency: 'USD' },
  { id: '3', account_number: 'ACC-003', name: 'Medical Equipment CapEx', type: 'Expense', balance: 45000.00, currency: 'USD' },
];

const transactions = [
  { id: '1', reference: 'TXN-1001', account_id: '1', description: 'Patient Consultation Fees', amount: 1540.00, type: 'credit', date: '2026-03-05' },
  { id: '2', reference: 'TXN-1002', account_id: '2', description: 'Pharmacy Dispensing Revenue', amount: 890.00, type: 'credit', date: '2026-03-05' },
  { id: '3', reference: 'TXN-1003', account_id: '3', description: 'Surgical Disposables Supply', amount: -650.00, type: 'debit', date: '2026-03-04' },
];

const roles = [
  { id: '1', name: 'super_admin', description: 'Super Administrator with ultimate control', permissions: ['all:view', 'all:add', 'all:edit', 'all:delete'] },
  { id: '2', name: 'admin', description: 'Administrator with full access', permissions: ['all:view', 'all:add', 'all:edit', 'all:delete'] },
  { id: '3', name: 'doctor', description: 'Medical doctor with access to patient data', permissions: ['patients:view', 'patients:add', 'patients:edit', 'appointments:view', 'appointments:add', 'appointments:edit'] },
  { id: '4', name: 'nurse', description: 'Nurse with care management access', permissions: ['patients:view', 'appointments:view'] },
  { id: '5', name: 'patient', description: 'Patient with self-service access', permissions: ['appointments:view', 'appointments:add'] },
];

const documents = [
  { id: '1', title: 'Cardiology Guidelines 2026.pdf', patientId: '1', patientName: 'John Doe', type: 'Medical Report', uploadedAt: '2026-03-01', size: '1.4 MB' },
  { id: '2', title: 'Chest X-Ray Analysis.pdf', patientId: '2', patientName: 'Grace Appiah', type: 'Radiology', uploadedAt: '2026-03-04', size: '3.8 MB' },
];

const auditLogs = [
  { id: '1', user: 'admin@smarthealth.com', action: 'LOGIN', details: 'User logged in successfully', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', user: 'doctor@smarthealth.com', action: 'UPDATE_PATIENT', details: 'Updated patient record PAT-001', timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: '3', user: 'admin@smarthealth.com', action: 'CREATE_APPOINTMENT', details: 'Created appointment APP-003', timestamp: new Date(Date.now() - 600000).toISOString() },
];

let appSettings: Record<string, any> = {
  hospitalName: 'Smart Health System',
  enableTwoFactor: false,
  enableSmsReminders: true,
  enableEmailAlerts: true,
  theme: 'light',
  language: 'en',
};

// Helper to read request body
function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

export function handleMockApi(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url || '';
  if (!url.startsWith('/api')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  const [pathname, queryString] = url.split('?');
  const params = new URLSearchParams(queryString || '');

  // SSE Stream for live updates
  if (pathname === '/api/roles/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    const interval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
      } catch {
        clearInterval(interval);
      }
    }, 15000);
    req.on('close', () => clearInterval(interval));
    req.on('error', () => clearInterval(interval));
    return true;
  }

  // Health check
  if (pathname === '/api/health' || pathname === '/api/super-admin/health') {
    sendJson(res, 200, {
      status: 'healthy',
      database: 'connected (in-memory persistent)',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
    return true;
  }

  // Auth endpoints
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      const email = body.email || '';
      const password = body.password || '';
      const matched = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (matched && matched.password && matched.password !== password) {
        sendJson(res, 401, { error: 'Invalid password. Please check your credentials.' });
        return;
      }

      const user = matched || {
        id: '2',
        name: email.split('@')[0] || 'Admin User',
        email: email || 'admin@smarthealth.com',
        role: 'admin',
        permissions: ['all:view', 'all:add', 'all:edit', 'all:delete'],
        hospital_id: 'HOSP-001',
      };
      sendJson(res, 200, {
        token: `mock-token-${user.id}-${Date.now()}`,
        user: { ...user, totp_enabled: mockTotpEnabled, recovery_codes_count: mockTotpEnabled ? mockRecoveryCodes.length : 0 },
      });
    });
    return true;
  }

  if (pathname === '/api/auth/me') {
    sendJson(res, 200, {
      user: { ...users[1], totp_enabled: mockTotpEnabled, recovery_codes_count: mockTotpEnabled ? mockRecoveryCodes.length : 0 }, // Default to Admin
    });
    return true;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      const newUser = {
        id: String(users.length + 1),
        role_id: 2,
        email: body.email || 'user@example.com',
        password: body.password || 'Default123!',
        name: body.name || 'New User',
        role: 'admin',
        permissions: ['all:view', 'all:add', 'all:edit'],
        hospital_id: 'HOSP-001',
        status: 'active',
      };
      users.push(newUser);
      sendJson(res, 201, {
        message: 'Registration successful',
        token: `mock-token-${newUser.id}-${Date.now()}`,
        user: newUser,
      });
    });
    return true;
  }

  if (pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password' || pathname === '/api/auth/change-password' || pathname === '/api/auth/postpone-password-change') {
    sendJson(res, 200, { message: 'Operation successful' });
    return true;
  }

  if (pathname === '/api/auth/verify-2fa') {
    sendJson(res, 200, { token: `mock-token-2fa-${Date.now()}`, user: { ...users[1], totp_enabled: true, recovery_codes_count: mockRecoveryCodes.length } });
    return true;
  }

  if (pathname === '/api/auth/verify-recovery') {
    readJsonBody(req).then((body) => {
      const submitted = String(body.code || '').trim().toUpperCase();
      const valid = mockRecoveryCodes.some((c) => c.toUpperCase() === submitted);
      if (!valid) {
        sendJson(res, mockRecoveryCodes.length ? 401 : 400, {
          error: mockRecoveryCodes.length ? 'Invalid or already used recovery code' : 'No recovery codes are available for this account',
        });
        return;
      }
      mockRecoveryCodes = mockRecoveryCodes.filter((c) => c.toUpperCase() !== submitted); // single-use
      sendJson(res, 200, { token: `mock-token-recovery-${Date.now()}`, user: { ...users[1], totp_enabled: true, recovery_codes_count: mockRecoveryCodes.length } });
    });
    return true;
  }

  if (pathname === '/api/auth/totp/enroll' && req.method === 'POST') {
    sendJson(res, 200, {
      secret: DEMO_TOTP_SECRET,
      otpauthUrl: `otpauth://totp/SmartHealth:${encodeURIComponent(users[1].email)}?secret=${DEMO_TOTP_SECRET}&issuer=SmartHealth&algorithm=SHA1&digits=6&period=30`,
    });
    return true;
  }

  if (pathname === '/api/auth/totp/confirm' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      if (!body.secret || !/^\d{6}$/.test((body.code || '').toString())) {
        sendJson(res, 400, { error: 'Invalid code' });
        return;
      }
      mockTotpEnabled = true;
      mockRecoveryCodes = [
        'ABCDE-FGHJK', 'MNPQR-STUVW', 'X2345-6789A', 'BCDEF-GHJKM',
        'NPQRS-TUVWX', '23456-789AB', 'CDEFG-HJKMN', 'PQRST-UVWXY',
        '34567-89ABC', 'DEFGH-JKMNP',
      ];
      sendJson(res, 200, { enabled: true, recoveryCodes: mockRecoveryCodes });
    });
    return true;
  }

  if (pathname === '/api/auth/totp/disable' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      if (!/^\d{6}$/.test((body.code || '').toString())) {
        sendJson(res, 400, { error: 'Invalid code' });
        return;
      }
      mockTotpEnabled = false;
      mockRecoveryCodes = [];
      sendJson(res, 200, { enabled: false });
    });
    return true;
  }

  // Dashboard endpoints
  if (pathname === '/api/dashboard/stats') {
    sendJson(res, 200, {
      stats: {
        totalPatients: patients.length,
        activeAppointments: appointments.length,
        totalStaff: staff.length,
        occupancyRate: 78,
        revenue: 265400,
        pendingPrescriptions: 5,
      },
      patientGrowth: [
        { month: 'Jan', count: 95 },
        { month: 'Feb', count: 112 },
        { month: 'Mar', count: 140 },
        { month: 'Apr', count: 125 },
        { month: 'May', count: 160 },
        { month: 'Jun', count: 180 },
      ],
      weeklyAppointments: [
        { day: 'Mon', completed: 18, scheduled: 24 },
        { day: 'Tue', completed: 22, scheduled: 26 },
        { day: 'Wed', completed: 19, scheduled: 20 },
        { day: 'Thu', completed: 25, scheduled: 28 },
        { day: 'Fri', completed: 21, scheduled: 25 },
        { day: 'Sat', completed: 12, scheduled: 15 },
        { day: 'Sun', completed: 8, scheduled: 10 },
      ],
      recentActivities: [
        { id: '1', title: 'New Patient Registered', time: '10 minutes ago', type: 'patient' },
        { id: '2', title: 'Cardiology Appointment Completed', time: '45 minutes ago', type: 'appointment' },
        { id: '3', title: 'Inventory Batch Reorder Approved', time: '2 hours ago', type: 'inventory' },
      ],
    });
    return true;
  }

  if (pathname === '/api/dashboard/financial-forecast') {
    sendJson(res, 200, {
      forecast: [
        { month: 'Jul', projectedRevenue: 280000, projectedExpense: 175000 },
        { month: 'Aug', projectedRevenue: 295000, projectedExpense: 180000 },
        { month: 'Sep', projectedRevenue: 310000, projectedExpense: 185000 },
      ],
    });
    return true;
  }

  if (pathname === '/api/dashboard/resource-optimization') {
    sendJson(res, 200, {
      bedUtilization: 82,
      staffToPatientRatio: '1:4.2',
      otUtilization: 74,
      avgWaitTimeMinutes: 18,
    });
    return true;
  }

  if (pathname === '/api/dashboard/ghana-health-import') {
    sendJson(res, 200, { message: 'Ghana Health Service indicators imported successfully', records: 48 });
    return true;
  }

  if (pathname === '/api/dashboard/ghana-health-data') {
    sendJson(res, 200, [
      { region: 'Greater Accra', malariaCases: 142, immunizationRate: 94, maternalHealthScore: 88 },
      { region: 'Ashanti', malariaCases: 210, immunizationRate: 91, maternalHealthScore: 85 },
      { region: 'Central', malariaCases: 98, immunizationRate: 89, maternalHealthScore: 82 },
      { region: 'Eastern', malariaCases: 130, immunizationRate: 92, maternalHealthScore: 86 },
    ]);
    return true;
  }

  if (pathname === '/api/patient-load-predictions') {
    sendJson(res, 200, {
      predictions: [
        { day: 'Monday', predictedLoad: 45 },
        { day: 'Tuesday', predictedLoad: 52 },
        { day: 'Wednesday', predictedLoad: 48 },
        { day: 'Thursday', predictedLoad: 56 },
        { day: 'Friday', predictedLoad: 62 },
        { day: 'Saturday', predictedLoad: 35 },
        { day: 'Sunday', predictedLoad: 28 },
      ],
    });
    return true;
  }

  // Patients CRUD
  if (pathname === '/api/patients') {
    if (req.method === 'GET') {
      const search = params.get('search')?.toLowerCase();
      let resList = patients;
      if (search) {
        resList = patients.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            p.patient_id.toLowerCase().includes(search) ||
            p.email.toLowerCase().includes(search)
        );
      }
      sendJson(res, 200, resList);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const newPatient = {
          id: String(patients.length + 1),
          patient_id: `PAT-00${patients.length + 1}`,
          name: `${body.first_name || ''} ${body.last_name || ''}`.trim() || body.name || 'New Patient',
          first_name: body.first_name || '',
          last_name: body.last_name || '',
          age: Number(body.age) || 30,
          gender: body.gender || 'unspecified',
          phone: body.phone || '',
          email: body.email || '',
          address: body.address || '',
          hospital_id: body.hospital_id || 'HOSP-001',
          hospital: 'General Hospital',
          status: 'active',
          bloodGroup: body.bloodGroup || 'O+',
          medicalConditions: body.medicalConditions || [],
          last_visit: new Date().toISOString().split('T')[0],
        };
        patients.unshift(newPatient);
        sendJson(res, 201, newPatient);
      });
      return true;
    }
  }

  if (pathname.startsWith('/api/patients/')) {
    const id = pathname.replace('/api/patients/', '');
    const patientIndex = patients.findIndex((p) => p.id === id || p.patient_id === id);
    if (req.method === 'GET') {
      const patient = patients[patientIndex] || patients[0];
      sendJson(res, 200, patient);
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        if (patientIndex !== -1) {
          patients[patientIndex] = { ...patients[patientIndex], ...body };
          sendJson(res, 200, patients[patientIndex]);
        } else {
          sendJson(res, 200, body);
        }
      });
      return true;
    }
    if (req.method === 'DELETE') {
      if (patientIndex !== -1) {
        patients.splice(patientIndex, 1);
      }
      sendJson(res, 200, { message: 'Patient deleted successfully' });
      return true;
    }
  }

  // Appointments CRUD
  if (pathname === '/api/appointments') {
    if (req.method === 'GET') {
      sendJson(res, 200, appointments);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const newAppt = {
          id: String(appointments.length + 1),
          appointment_id: `APP-00${appointments.length + 1}`,
          patient_id: body.patient_id || '1',
          patient_name: body.patient_name || 'Patient',
          doctor_id: body.doctor_id || '1',
          doctor_name: body.doctor_name || 'Dr. John Smith',
          department: body.department || 'Cardiology',
          department_id: body.department_id || '1',
          appointment_date: body.appointment_date || new Date().toISOString().split('T')[0],
          appointment_time: body.appointment_time || '10:00 AM',
          type: body.type || 'Consultation',
          status: 'scheduled',
          hospital_id: body.hospital_id || 'HOSP-001',
          notes: body.notes || '',
        };
        appointments.unshift(newAppt);
        sendJson(res, 201, newAppt);
      });
      return true;
    }
  }

  if (pathname.startsWith('/api/appointments/')) {
    const id = pathname.replace('/api/appointments/', '');
    const idx = appointments.findIndex((a) => a.id === id || a.appointment_id === id);
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        if (idx !== -1) {
          appointments[idx] = { ...appointments[idx], ...body };
          sendJson(res, 200, appointments[idx]);
        } else {
          sendJson(res, 200, body);
        }
      });
      return true;
    }
    if (req.method === 'DELETE') {
      if (idx !== -1) appointments.splice(idx, 1);
      sendJson(res, 200, { message: 'Appointment deleted successfully' });
      return true;
    }
  }

  // Hospitals & Departments
  if (pathname === '/api/hospitals') {
    if (req.method === 'GET') {
      sendJson(res, 200, hospitals);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const newHosp = { id: String(hospitals.length + 1), hospital_id: `HOSP-00${hospitals.length + 1}`, status: 'active', ...body };
        hospitals.push(newHosp);
        sendJson(res, 201, newHosp);
      });
      return true;
    }
  }

  if (pathname.match(/^\/api\/hospitals\/([^/]+)\/departments$/)) {
    sendJson(res, 200, departments);
    return true;
  }

  if (pathname.startsWith('/api/hospitals/')) {
    const id = pathname.replace('/api/hospitals/', '');
    const idx = hospitals.findIndex((h) => h.id === id || h.hospital_id === id);
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        if (idx !== -1) hospitals[idx] = { ...hospitals[idx], ...body };
        sendJson(res, 200, hospitals[idx] || body);
      });
      return true;
    }
    if (req.method === 'DELETE') {
      if (idx !== -1) hospitals.splice(idx, 1);
      sendJson(res, 200, { message: 'Hospital deleted' });
      return true;
    }
  }

  // Staff
  if (pathname === '/api/staff') {
    if (req.method === 'GET') {
      sendJson(res, 200, staff);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const newStaff = {
          id: String(staff.length + 1),
          staff_id: `STAFF-00${staff.length + 1}`,
          status: 'active',
          joinDate: new Date().toISOString().split('T')[0],
          name: `${body.first_name || ''} ${body.last_name || ''}`.trim() || 'Staff Member',
          ...body,
        };
        staff.push(newStaff);
        sendJson(res, 201, newStaff);
      });
      return true;
    }
  }

  if (pathname.startsWith('/api/staff/')) {
    const id = pathname.replace('/api/staff/', '');
    const idx = staff.findIndex((s) => s.id === id || s.staff_id === id);
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        if (idx !== -1) staff[idx] = { ...staff[idx], ...body };
        sendJson(res, 200, staff[idx] || body);
      });
      return true;
    }
    if (req.method === 'DELETE') {
      if (idx !== -1) staff.splice(idx, 1);
      sendJson(res, 200, { message: 'Staff deleted' });
      return true;
    }
  }

  // Pharmacy & Medicines
  if (pathname === '/api/pharmacy/medicines' || pathname === '/api/pharmacy') {
    if (req.method === 'GET') {
      sendJson(res, 200, medicines);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const item = { id: String(medicines.length + 1), ...body };
        medicines.push(item);
        sendJson(res, 201, item);
      });
      return true;
    }
  }

  if (pathname.startsWith('/api/pharmacy/medicines/')) {
    const id = pathname.replace('/api/pharmacy/medicines/', '');
    const idx = medicines.findIndex((m) => m.id === id);
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        if (idx !== -1) medicines[idx] = { ...medicines[idx], ...body };
        sendJson(res, 200, medicines[idx] || body);
      });
      return true;
    }
  }

  if (pathname === '/api/pharmacy/reports') {
    sendJson(res, 200, {
      totalMedicines: medicines.length,
      lowStockItems: medicines.filter((m) => m.stock <= m.minStock),
      expiringWithin90Days: medicines.filter((m) => m.expiryDate.startsWith('2026')),
      stockValuation: medicines.reduce((sum, m) => sum + m.stock * m.unitPrice, 0),
    });
    return true;
  }

  // Suppliers & Purchase Orders
  if (pathname === '/api/suppliers') {
    if (req.method === 'GET') {
      sendJson(res, 200, suppliers);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const item = { id: String(suppliers.length + 1), status: 'active', ...body };
        suppliers.push(item);
        sendJson(res, 201, item);
      });
      return true;
    }
  }

  if (pathname === '/api/purchase-orders') {
    if (req.method === 'GET') {
      sendJson(res, 200, purchaseOrders);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const po = { id: String(purchaseOrders.length + 1), poNumber: `PO-2026-00${purchaseOrders.length + 1}`, status: 'pending', ...body };
        purchaseOrders.push(po);
        sendJson(res, 201, po);
      });
      return true;
    }
  }

  if (pathname.startsWith('/api/purchase-orders/')) {
    const id = pathname.replace('/api/purchase-orders/', '');
    const idx = purchaseOrders.findIndex((p) => p.id === id);
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        if (idx !== -1) purchaseOrders[idx] = { ...purchaseOrders[idx], ...body };
        sendJson(res, 200, purchaseOrders[idx] || body);
      });
      return true;
    }
  }

  // Financial
  if (pathname === '/api/financial/accounts') {
    if (req.method === 'GET') {
      sendJson(res, 200, accounts);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const item = { id: String(accounts.length + 1), ...body };
        accounts.push(item);
        sendJson(res, 201, item);
      });
      return true;
    }
  }

  if (pathname === '/api/financial/transactions') {
    if (req.method === 'GET') {
      sendJson(res, 200, transactions);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const item = { id: String(transactions.length + 1), date: new Date().toISOString().split('T')[0], ...body };
        transactions.unshift(item);
        sendJson(res, 201, item);
      });
      return true;
    }
  }

  // Roles & Settings
  if (pathname === '/api/roles') {
    if (req.method === 'GET') {
      sendJson(res, 200, roles);
      return true;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const r = { id: String(roles.length + 1), ...body };
        roles.push(r);
        sendJson(res, 201, r);
      });
      return true;
    }
  }

  if (pathname === '/api/settings') {
    if (req.method === 'GET') {
      sendJson(res, 200, appSettings);
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        appSettings = { ...appSettings, ...body };
        sendJson(res, 200, appSettings);
      });
      return true;
    }
  }

  // Documents
  if (pathname === '/api/documents') {
    if (req.method === 'GET') {
      sendJson(res, 200, documents);
      return true;
    }
    if (req.method === 'POST') {
      const doc = {
        id: String(documents.length + 1),
        title: 'Uploaded Document.pdf',
        patientId: '1',
        patientName: 'John Doe',
        type: 'General Medical',
        uploadedAt: new Date().toISOString().split('T')[0],
        size: '1.2 MB',
      };
      documents.unshift(doc);
      sendJson(res, 201, doc);
      return true;
    }
  }

  if (pathname.startsWith('/api/documents/')) {
    const id = pathname.replace('/api/documents/', '');
    const idx = documents.findIndex((d) => d.id === id);
    if (idx !== -1) documents.splice(idx, 1);
    sendJson(res, 200, { message: 'Document deleted' });
    return true;
  }

  // Gemini Chat Proxy Endpoint with Google Search Grounding
  if (pathname === '/api/gemini/chat' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const { messages, modelType, systemInstruction, enableSearchGrounding = true } = body;
      
      // Determine the model based on modelType (pro, flash, lite)
      let resolvedModel = 'gemini-3.5-flash';
      if (modelType === 'pro') {
        resolvedModel = 'gemini-3.1-pro-preview';
      } else if (modelType === 'lite') {
        resolvedModel = 'gemini-3.1-flash-lite';
      } else if (modelType === 'flash') {
        resolvedModel = 'gemini-3.5-flash';
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Return a highly realistic simulated clinical AI response with Google Search Grounding for preview testing
        const lastUserMessage = messages?.[messages.length - 1]?.content || 'Hello';
        let simulatedReply: string;
        let simulatedQueries: string[];
        let simulatedSources: { title: string; uri: string }[];

        if (lastUserMessage.toLowerCase().includes('hypertension') || lastUserMessage.toLowerCase().includes('blood pressure')) {
          simulatedQueries = ['2025 2026 ACC AHA Hypertension clinical guidelines update', 'Resistant hypertension treatment protocols'];
          simulatedSources = [
            { title: 'ACC/AHA Clinical Practice Guidelines - Blood Pressure Management', uri: 'https://www.acc.org/guidelines' },
            { title: 'The Lancet - Pharmacotherapy of Essential Hypertension', uri: 'https://www.thelancet.com' },
            { title: 'PubMed Central - Renal Denervation & Combination Anti-Hypertensives', uri: 'https://pubmed.ncbi.nlm.nih.gov' }
          ];
          simulatedReply = `### [Google Search Grounded Medical Analysis]\n\nBased on recent 2025/2026 cardiovascular guidelines and grounded medical literature:\n\n1. **Diagnostic Benchmark**: Stage 2 hypertension is defined by sustained systolic BP ≥140 mmHg or diastolic BP ≥90 mmHg. Diurnal variability should be verified via 24-hour Ambulatory Blood Pressure Monitoring (ABPM).\n2. **Therapeutic Protocol**: Dual-agent first-line therapy (e.g., ACE-inhibitor/ARB combined with a DHP-calcium channel blocker or thiazide-like diuretic) is strongly recommended.\n3. **Monitoring**: Baseline renal panel (eGFR, serum electrolytes) must be checked prior to initiation and after 4 weeks.\n\n*DISCLAIMER: AI-generated clinical aid for authorized healthcare practitioners. Attach GEMINI_API_KEY in Settings to enable live web queries.*`;
        } else if (lastUserMessage.toLowerCase().includes('diabetes') || lastUserMessage.toLowerCase().includes('glp-1') || lastUserMessage.toLowerCase().includes('ckd')) {
          simulatedQueries = ['ADA Standards of Care 2025 GLP-1 receptor agonists CKD', 'NEJM SGLT2 inhibitors and kidney disease'];
          simulatedSources = [
            { title: 'American Diabetes Association (ADA) Standards of Care', uri: 'https://diabetesjournals.org/care' },
            { title: 'New England Journal of Medicine - Cardiorenal Protection in T2D', uri: 'https://www.nejm.org' },
            { title: 'KDIGO 2025 Clinical Practice Guideline for Diabetes in CKD', uri: 'https://kdigo.org' }
          ];
          simulatedReply = `### [Google Search Grounded Medical Research]\n\nAccording to the latest ADA Standards of Care and cardiorenal consensus trials:\n\n1. **Cardiorenal Protection**: For patients with Type 2 Diabetes and established CKD (eGFR 20-60 mL/min/1.73m² or urine ACR >30 mg/g), SGLT2 inhibitors and GLP-1 receptor agonists have demonstrated significant nephroprotective and cardiovascular mortality benefits.\n2. **Target HbA1c**: Individualized glycemic targets (typically <7.0% for most adults, or <8.0% for frail multimorbid individuals) remain the standard.\n3. **Safety Monitoring**: Periodic monitoring of eGFR, volume status, and electrolytes is required.\n\n*DISCLAIMER: AI-generated clinical aid for licensed professionals. Attach GEMINI_API_KEY in Settings to activate real-time search grounding.*`;
        } else {
          simulatedQueries = [`Current medical consensus for "${lastUserMessage.slice(0, 45)}"`, 'CDC & WHO Clinical Guidelines 2025/2026'];
          simulatedSources = [
            { title: 'World Health Organization (WHO) Guidelines & Publications', uri: 'https://www.who.int' },
            { title: 'CDC Clinical Guidance and Epidemiological Data', uri: 'https://www.cdc.gov' },
            { title: 'National Institutes of Health (NIH) Medical Database', uri: 'https://www.nih.gov' }
          ];
          simulatedReply = `### [Google Search Grounded Response]\n\nSynthesizing up-to-date medical references and clinical protocols for **"${lastUserMessage}"**:\n\n* **Evidence Summary**: Clinical best practices require structured risk stratification, standardized vital benchmarks, and adherence to evidence-based clinical algorithms.\n* **Operational Recommendations**: Verify patient allergies, prior pharmacological history, and schedule follow-up appointments appropriately.\n\n*DISCLAIMER: This is an AI-generated clinical assistant response. Attach your GEMINI_API_KEY in Settings to execute live Google Search grounding.*`;
        }

        sendJson(res, 200, {
          text: simulatedReply,
          modelUsed: resolvedModel,
          simulated: true,
          groundingMetadata: {
            searchQueries: simulatedQueries,
            sources: simulatedSources,
            grounded: true
          }
        });
        return;
      }

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        // Map client messages to Content objects
        const contents = (messages || []).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const toolsConfig = enableSearchGrounding ? [{ googleSearch: {} }] : undefined;

        const response = await ai.models.generateContent({
          model: resolvedModel,
          contents,
          config: {
            systemInstruction: (systemInstruction || 'You are an expert clinical assistant. Provide accurate, up-to-date, professional medical insights grounded in latest medical research, and always append a standard clinical disclaimer.') + '\nWhen Google Search is available, ground your responses in up-to-date peer-reviewed medical publications, WHO, CDC, and professional guidelines.',
            temperature: modelType === 'pro' ? 0.3 : 0.7,
            tools: toolsConfig,
          }
        });

        const candidate = response.candidates?.[0];
        const searchChunks = (candidate?.groundingMetadata?.groundingChunks || []).map((chunk: any) => ({
          title: chunk.web?.title || 'Medical Reference Source',
          uri: chunk.web?.uri || '',
        })).filter((c: any) => Boolean(c.uri));

        const searchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

        sendJson(res, 200, {
          text: response.text || 'No response text generated by the model.',
          modelUsed: resolvedModel,
          simulated: false,
          groundingMetadata: {
            searchQueries,
            sources: searchChunks,
            grounded: searchChunks.length > 0 || searchQueries.length > 0
          }
        });
      } catch (error: any) {
        console.error('Gemini API Error:', error);
        sendJson(res, 500, {
          error: error.message || 'Failed to call Gemini API',
          modelUsed: resolvedModel
        });
      }
    });
    return true;
  }

  // Gemini Clinical Insights Endpoint
  if (pathname === '/api/gemini/insights' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const { patientId, patientName, vitalsList } = body;
      const resolvedModel = 'gemini-3.5-flash';
      const apiKey = process.env.GEMINI_API_KEY;

      const lastVitals = (vitalsList || []).slice(0, 5);
      const latestReading = lastVitals[0];

      if (!apiKey) {
        // High-fidelity clinical AI response builder when key is missing
        let patternSummary = 'Patient shows stable physiological trends within normal margins.';
        let followUpTests = '*   No high-urgency tests required at this time.\n*   Routine annual wellness panel (CBC, metabolic profile).';
        let medAdjustments = '*   No modifications suggested. Maintain active dosages.\n*   Advise patient on continuing current lifestyle guidelines.';
        let alertWarning = '';

        if (latestReading) {
          const sys = latestReading.systolicBp;
          const dia = latestReading.diastolicBp;
          const hr = latestReading.heartRate;
          const temp = latestReading.temperature;

          if (sys >= 140 || dia >= 90) {
            patternSummary = `Historical trends reflect sustained high blood pressure (${sys}/${dia} mmHg), indicative of Stage 2 Hypertension. Pulse rates fluctuate around ${hr} bpm.`;
            followUpTests = `*   **12-Lead Electrocardiogram (ECG)**: Assess for cardiac remodeling or left ventricular hypertrophy.\n*   **Comprehensive Lipid Panel**: Quantify cardiovascular risk markers.\n*   **Basic Metabolic Panel (BMP)**: Benchmark renal function (eGFR, serum creatinine) prior to any dosage modification.\n*   **Ambulatory BP Monitoring (ABPM)**: Review diurnal dipping patterns over a 24-hour cycle.`;
            medAdjustments = `*   **Lisinopril Adjustment**: Consider increasing standard dosage from 10mg to 20mg daily if BMP reveals normal renal function.\n*   **Calcium Channel Blocker**: Evaluate adding Amlodipine 5mg daily if BP remains uncontrolled past 2 weeks.\n*   **Lifestyle Optimization**: Stress sodium restriction (<1.5g/day) and active lifestyle tracking.`;
            alertWarning = `⚠️ **Alert Triggered**: Blood pressure of ${sys}/${dia} mmHg is elevated.`;
          } else if (temp >= 38.0) {
            patternSummary = `Historical records suggest acute pyrexia (temperature ${temp}°C) combined with compensatory sinus tachycardia (${hr} bpm).`;
            followUpTests = `*   **Complete Blood Count (CBC)**: Evaluate for leukocytosis / infection indicators.\n*   **Urinalysis & Culture**: Screen for localized urinary tract infection source.\n*   **Inflammatory Markers (CRP/ESR)**: Benchmark acute phase reactants.`;
            medAdjustments = `*   **Antipyretics**: Regular Paracetamol (Acetaminophen) 500mg-1000mg every 6 hours as needed (do not exceed 4g/day).\n*   **Antibiotic Regimen**: Defer until specific culture results are established unless sepsis markers present.\n*   **Hydration Protocol**: Maintain aggressive oral rehydration.`;
            alertWarning = `⚠️ **Alert Triggered**: Active pyrexia (${temp}°C) flagged in clinical chart.`;
          } else if (hr >= 100) {
            patternSummary = `Patient exhibits tachycardic resting pulse of ${hr} bpm. BP remains stable.`;
            followUpTests = `*   **ECG & Holter Monitor**: Check for paroxysmal atrial fibrillation or supraventricular tachycardia.\n*   **Thyroid Panel (TSH, Free T4)**: Assess for subclinical hyperthyroidism.`;
            medAdjustments = `*   **Beta-Blocker Evaluation**: Review beta-blocker introduction (e.g., Metoprolol Succinate 25mg daily) if persistent resting tachycardia is confirmed.\n*   **Stimulant Review**: Screen for excess caffeine, sympathomimetics, or bronchodilator use.`;
          }
        }

        const simulatedOutput = `### [AI CLINICAL INSIGHTS - SIMULATION MODE]
*Patient: **${patientName || 'Sarah Johnson'}** (ID: ${patientId || 'P-1001'})*

${alertWarning ? alertWarning + '\n\n' : ''}#### 1. Pattern & Physiological Assessment
${patternSummary}

#### 2. Suggested Diagnostic Follow-Up Tests
${followUpTests}

#### 3. Recommended Medication & Lifestyle Adjustments
${medAdjustments}

***

**DISCLAIMER**: This clinical summary is an AI-generated reference tool compiled for licensed practitioners. It does NOT constitute medical validation or replace direct patient evaluation. Please attach your \`GEMINI_API_KEY\` in Settings to enable real-time clinical diagnostics.`;

        sendJson(res, 200, {
          text: simulatedOutput,
          modelUsed: resolvedModel,
          simulated: true
        });
        return;
      }

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const vitalsString = (vitalsList || []).map((v: any) => 
          `- Date: ${v.recordedAt}, BP: ${v.systolicBp}/${v.diastolicBp}, HR: ${v.heartRate} bpm, Temp: ${v.temperature}°C, SpO2: ${v.oxygenSaturation}%`
        ).join('\n');

        const systemInstruction = `You are a clinical artificial intelligence advisor. Your job is to analyze historical patient vital signs and provide expert suggestions on potential diagnostic follow-up tests, medical investigations, and potential medication adjustments.\n\nAlways use markdown styling with logical headers. Keep advice clinical, analytical, and professional. Always append the mandatory disclaimer at the very end: "DISCLAIMER: This is an AI-generated clinical aid for licensed professionals. It does not replace independent clinical judgment or direct patient examination."`;

        const prompt = `Analyze these vital sign historical patterns for patient **${patientName}** (ID: ${patientId}):\n\n${vitalsString || 'No historical vital signs logged.'}\n\nPlease output:\n1. A summary of physiological trends (BP, Heart Rate, SpO2, Temperature).\n2. Targeted follow-up diagnostic tests (e.g., ECG, labs, cultures) with clinical justifications.\n3. Potential medication adjustments or therapeutic reviews (with precautions).`;

        const response = await ai.models.generateContent({
          model: resolvedModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { systemInstruction, temperature: 0.3 }
        });

        sendJson(res, 200, {
          text: response.text || 'Failed to generate clinical analysis.',
          modelUsed: resolvedModel,
          simulated: false
        });
      } catch (error: any) {
        console.error('Insights Error:', error);
        sendJson(res, 500, {
          error: error.message || 'Failed to call Gemini API'
        });
      }
    });
    return true;
  }

  // Generate temporary patient summary share link
  if (pathname === '/api/shared/patient-summary/generate' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      const { patientId, patientName } = body;
      if (!patientId) {
        sendJson(res, 400, { error: 'patientId is required' });
        return;
      }

      const token = `share-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours expiry

      sharedLinks.set(token, {
        patientId,
        patientName: patientName || 'Patient',
        expiresAt
      });

      sendJson(res, 200, {
        token,
        expiresAt,
        url: `/shared/patient-summary/${token}`
      });
    });
    return true;
  }

  // Retrieve temporary shared patient summary
  if (pathname === '/api/shared/patient-summary' && req.method === 'GET') {
    const token = params.get('token') || '';
    if (!token || !sharedLinks.has(token)) {
      sendJson(res, 403, { error: 'Invalid or expired temporary secure link' });
      return true;
    }

    const linkInfo = sharedLinks.get(token)!;
    const expiresDate = new Date(linkInfo.expiresAt);
    if (expiresDate.getTime() < Date.now()) {
      sharedLinks.delete(token);
      sendJson(res, 403, { error: 'Secure temporary link has expired' });
      return true;
    }

    // Load upcoming appointments for this patient
    const patientAppointments = appointments.filter(
      (a) => a.patient_id === linkInfo.patientId || a.patient_name.toLowerCase().includes(linkInfo.patientName.toLowerCase())
    );

    sendJson(res, 200, {
      patientId: linkInfo.patientId,
      patientName: linkInfo.patientName,
      expiresAt: linkInfo.expiresAt,
      appointments: patientAppointments,
    });
    return true;
  }

  // Super Admin endpoints
  if (pathname === '/api/super-admin/status') {
    sendJson(res, 200, {
      status: 'operational',
      version: '1.2.0',
      uptime: '99.98%',
      activeUsers: users.length,
      storageUsed: '4.8 GB',
      lastBackup: '2026-03-05 02:00 UTC',
    });
    return true;
  }

  if (pathname === '/api/super-admin/backup' && req.method === 'POST') {
    sendJson(res, 200, { message: 'Backup created successfully', backupId: `BKP-${Date.now()}` });
    return true;
  }

  if (pathname === '/api/super-admin/backups') {
    sendJson(res, 200, [
      { id: '1', name: 'backup-2026-03-05.sql', size: '28.4 MB', createdAt: '2026-03-05 02:00 UTC' },
      { id: '2', name: 'backup-2026-03-04.sql', size: '27.9 MB', createdAt: '2026-03-04 02:00 UTC' },
    ]);
    return true;
  }

  if (pathname === '/api/super-admin/audit-logs') {
    sendJson(res, 200, { logs: auditLogs, total: auditLogs.length });
    return true;
  }

  if (pathname === '/api/super-admin/hospitals') {
    sendJson(res, 200, hospitals);
    return true;
  }

  if (pathname === '/api/super-admin/upgrade' && req.method === 'POST') {
    sendJson(res, 200, { message: 'System upgrade initiated' });
    return true;
  }

  if (pathname === '/api/super-admin/settings') {
    if (req.method === 'GET') {
      sendJson(res, 200, {
        maintenanceMode: false,
        allowRegistration: true,
        auditLogRetentionDays: 90,
        enforcePasswordRotation: false,
      });
      return true;
    }
    if (req.method === 'PUT') {
      sendJson(res, 200, { message: 'System settings updated' });
      return true;
    }
  }

  if (pathname === '/api/super-admin/users') {
    if (req.method === 'GET') {
      sendJson(res, 200, users);
      return true;
    }
  }

  if (pathname.match(/^\/api\/super-admin\/users\/([^/]+)\/status$/)) {
    sendJson(res, 200, { message: 'User status updated' });
    return true;
  }

  if (pathname.match(/^\/api\/super-admin\/users\/([^/]+)\/reset-password$/)) {
    if (req.method === 'POST') {
      readJsonBody(req).then((body) => {
        sendJson(res, 200, {
          message: 'Password reset successfully',
          temporaryPassword: 'TempPass@' + Math.random().toString(36).slice(2, 10),
          mustChange: true,
          twoFactorDisabled: body.clear_two_factor === true,
        });
      });
      return true;
    }
  }

  if (pathname === '/api/demo-requests' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      if (body.website) {
        sendJson(res, 202, { message: 'Thanks for your interest. We will be in touch shortly.' });
        return;
      }

      if (!body.name || !body.email || !body.organization || !body.role || !body.organizationSize || !body.preferredContact || (body.preferredContact === 'phone' && !body.phone)) {
        sendJson(res, 400, { error: 'Please complete all required demo request fields.' });
        return;
      }

      sendJson(res, 202, { message: 'Thanks for your interest. Our team will be in touch shortly.' });
    });
    return true;
  }

  // Fallback for any other API route
  sendJson(res, 200, { status: 'ok', message: 'Endpoint processed' });
  return true;
}
