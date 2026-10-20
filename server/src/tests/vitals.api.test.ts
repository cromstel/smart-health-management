import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: { query: queryMock },
}));

import * as vitalsController from '../controllers/vitals.controller';
import vitalsRoutes from '../routes/vitals.routes';

function resMock() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn(function (this: any, code: number) {
    this.statusCode = code;
    return this;
  });
  res.json = vi.fn((payload: any) => {
    res.payload = payload;
    return res;
  });
  return res;
}

const patientRow = { id: 7, patient_id: 'PAT-007', first_name: 'Ada', last_name: 'Lovelace' };

function vitalsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    patient_id: 7,
    recorded_by: 1,
    recorded_by_name: 'Dr. Smith',
    recorded_at: new Date(2025, 0, 10, 9, 15, 0),
    systolic_bp: 118,
    diastolic_bp: 78,
    heart_rate: 72,
    temperature: 36.6,
    respiratory_rate: 16,
    oxygen_saturation: 98,
    notes: null,
    status: 'normal',
    patient_code: 'PAT-007',
    first_name: 'Ada',
    last_name: 'Lovelace',
    ...overrides,
  };
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('vitals routes', () => {
  it('exposes the documented vitals surface', () => {
    const paths = vitalsRoutes.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

    expect(paths).toEqual(
      expect.arrayContaining([
        'GET /alerts',
        'GET /',
        'GET /:patientId',
        'GET /:patientId/summary',
        'GET /:patientId/alerts',
        'POST /',
        'PUT /:id',
        'DELETE /:id',
      ])
    );
  });
});

describe('createVital controller', () => {
  it('ignores a client supplied status and stores the derived one', async () => {
    const insertParams: any[] = [];
    queryMock.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM users WHERE id')) return [[{ name: 'Dr. Smith' }], []];
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.startsWith('INSERT INTO vitals')) {
        insertParams.push(...params);
        return [{ insertId: 42 }, []];
      }
      if (sql.includes('FROM vitals v')) {
        return [[vitalsRow({ systolic_bp: 185, status: 'critical' })], []];
      }
      return [[], []];
    });

    const req: any = {
      body: {
        patientId: 'PAT-007',
        recordedAt: '2025-01-10 09:15',
        systolicBp: 185,
        diastolicBp: 121,
        heartRate: 72,
        temperature: 36.6,
        // A client claiming the reading is fine must not change the outcome.
        status: 'normal',
      },
      user: { id: '1', email: 'doctor@smarthealth.com', role: 'Doctor' },
    };
    const res = resMock();

    await vitalsController.createVital(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.payload.vital.status).toBe('critical');
    expect(insertParams[insertParams.length - 1]).toBe('critical');
  });

  it('answers 404 for an unknown patient', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id')) return [[{ name: 'Dr. Smith' }], []];
      if (sql.includes('FROM patients WHERE patient_id')) return [[], []];
      return [[], []];
    });

    const req: any = {
      body: { patientId: 'PAT-404', systolicBp: 120, diastolicBp: 80, heartRate: 72, temperature: 36.8 },
      user: { id: '1' },
    };
    const res = resMock();

    await vitalsController.createVital(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('getVitals controller', () => {
  it('answers 404 for an unknown patient', async () => {
    queryMock.mockResolvedValueOnce([[], []]);
    const res = resMock();
    await vitalsController.getVitals({ params: { patientId: 'PAT-404' }, query: {} } as any, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns the readings and a count', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.includes('FROM vitals v')) return [[vitalsRow()], []];
      return [[], []];
    });

    const res = resMock();
    await vitalsController.getVitals({ params: {}, query: { patientId: 'PAT-007' } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.count).toBe(1);
    expect(res.payload.vitals[0].patientId).toBe('PAT-007');
  });
});

describe('deleteVital controller', () => {
  it('answers 404 when the record does not exist', async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    const res = resMock();
    await vitalsController.deleteVital({ params: { id: '999' }, query: {} } as any, res);
    expect(res.statusCode).toBe(404);
  });

  it('answers 200 when the record was removed', async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = resMock();
    await vitalsController.deleteVital({ params: { id: '42' }, query: {} } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
  });
});

describe('getVitalsSummary controller', () => {
  it('returns the server computed summary', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.includes('FROM vitals v')) {
        return [[vitalsRow({ systolic_bp: 146, diastolic_bp: 92, status: 'high' })], []];
      }
      return [[], []];
    });

    const res = resMock();
    await vitalsController.getVitalsSummary(
      { params: { patientId: 'PAT-007' }, query: {} } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.summary.bpStatus).toBe('Stage 2');
    expect(res.payload.patientId).toBe('PAT-007');
  });
});

/**
 * End to end over HTTP: the express-validator chains only reject a request
 * when the `validate` middleware runs, so the route has to be exercised as a
 * route, not as a controller function.
 */
describe('vitals HTTP surface', () => {
  const secret = process.env.JWT_SECRET || 'dev-only-jwt-secret';
  const token = jwt.sign(
    { id: '1', email: 'doctor@smarthealth.com', role: 'Doctor', hospital_id: 'HOSP-001' },
    secret
  );

  const withServer = async (fn: (base: string) => Promise<void>): Promise<void> => {
    const app = express();
    app.use(express.json());
    app.use('/api/vitals', vitalsRoutes);
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = (server.address() as any).port;
    try {
      await fn(`http://127.0.0.1:${port}`);
    } finally {
      server.close();
    }
  };

  beforeEach(() => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('password_must_change')) {
        return [[{ password_must_change: 0, password_postpone_count: 0 }], []];
      }
      if (sql.includes('SELECT role_id FROM users')) return [[{ role_id: 2 }], []];
      if (sql.includes("p.module = 'all'")) return [[{ allowed: 0 }], []];
      if (sql.includes('FROM permissions p')) return [[{ allowed: 1 }], []];
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.startsWith('INSERT INTO vitals')) return [{ insertId: 42 }, []];
      if (sql.includes('FROM vitals v')) {
        return [[vitalsRow({ systolic_bp: 185, diastolic_bp: 121, status: 'critical' })], []];
      }
      return [[], []];
    });
  });

  it('rejects a reading that is missing a measurement', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: 'PAT-007', diastolicBp: 80, heartRate: 72, temperature: 36.8 }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(Array.isArray(body.errors)).toBe(true);
    });
  });

  it('rejects an out of range measurement', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId: 'PAT-007',
          systolicBp: 900,
          diastolicBp: 80,
          heartRate: 72,
          temperature: 36.8,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  it('records a reading and stores the derived status', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId: 'PAT-007',
          recordedAt: '2025-01-10 09:15',
          systolicBp: 185,
          diastolicBp: 121,
          heartRate: 72,
          temperature: 36.6,
          status: 'normal',
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.vital.status).toBe('critical');
      expect(body.vital.patientId).toBe('PAT-007');
    });
  });

  it('refuses an unauthenticated read', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/vitals?patientId=PAT-007`);
      expect(response.status).toBe(401);
    });
  });
});
