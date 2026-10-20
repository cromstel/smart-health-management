import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: { query: queryMock },
}));

import * as sharedSummaryService from '../services/sharedSummary.service';
import * as sharedSummaryController from '../controllers/sharedSummary.controller';
import sharedSummaryRoutes from '../routes/sharedSummary.routes';

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

beforeEach(() => {
  queryMock.mockReset();
});

describe('createShareLink', () => {
  it('stores a URL safe, unguessable token with the patient name from the record', async () => {
    let insertParams: any[] = [];
    queryMock.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.startsWith('INSERT INTO shared_summaries')) {
        insertParams = params;
        return [{ insertId: 1 }, []];
      }
      return [[], []];
    });

    const created = await sharedSummaryService.createShareLink('PAT-007', 3);

    expect(created).not.toBeNull();
    expect(created!.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(created!.url).toBe(`/shared/patient-summary/${created!.token}`);
    expect(new Date(created!.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // The stored name comes from the patient row, never from the request body.
    expect(insertParams[2]).toBe('Ada Lovelace');
    expect(insertParams[3]).toBe(3);
  });

  it('returns null for an unknown patient', async () => {
    queryMock.mockResolvedValueOnce([[], []]);
    expect(await sharedSummaryService.createShareLink('PAT-404', 1)).toBeNull();
  });

  it('generates a different token every time', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      return [{ insertId: 1 }, []];
    });

    const first = await sharedSummaryService.createShareLink('PAT-007', 1);
    const second = await sharedSummaryService.createShareLink('PAT-007', 1);
    expect(first!.token).not.toBe(second!.token);
  });
});

describe('readSharedSummary', () => {
  it('returns the summary and counts the access', async () => {
    const statements: string[] = [];
    queryMock.mockImplementation(async (sql: string) => {
      statements.push(sql);
      if (sql.includes('FROM shared_summaries s')) {
        return [
          [
            {
              share_id: 5,
              expires_at: new Date(Date.now() + 60_000),
              patient_id: 7,
              patient_name: 'Ada Lovelace',
              patient_code: 'PAT-007',
              first_name: 'Ada',
              last_name: 'Lovelace',
            },
          ],
          [],
        ];
      }
      if (sql.includes('UPDATE shared_summaries')) return [{ affectedRows: 1 }, []];
      if (sql.includes('FROM appointments a')) {
        return [
          [
            {
              id: 3,
              appointment_id: 'APT-003',
              appointment_date: new Date(2030, 0, 5),
              appointment_time: new Date(2030, 0, 5, 9, 30, 0),
              doctor_name: 'Dr. Smith',
              department: 'Cardiology',
              type: 'Follow-up',
              status: 'scheduled',
              notes: null,
            },
          ],
          [],
        ];
      }
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.includes('FROM vitals v')) return [[], []];
      return [[], []];
    });

    const payload = await sharedSummaryService.readSharedSummary('a'.repeat(43));

    expect(payload).not.toBeNull();
    expect(payload!.patientId).toBe('PAT-007');
    expect(payload!.patientName).toBe('Ada Lovelace');
    expect(payload!.appointments).toHaveLength(1);
    expect(payload!.appointments[0].appointment_id).toBe('APT-003');
    expect(payload!.appointments[0].doctor_name).toBe('Dr. Smith');
    expect(payload!.vitals).toEqual([]);

    expect(statements.some((s) => s.includes('SET access_count = access_count + 1'))).toBe(true);
    expect(statements.some((s) => s.includes('last_accessed_at = NOW()'))).toBe(true);
  });

  it('returns null for an unknown, revoked or expired token', async () => {
    queryMock.mockResolvedValueOnce([[], []]);
    expect(await sharedSummaryService.readSharedSummary('b'.repeat(43))).toBeNull();
  });
});

describe('shared summary controller', () => {
  it('answers 404 for a token that is not valid', async () => {
    queryMock.mockResolvedValueOnce([[], []]);
    const res = resMock();
    await sharedSummaryController.getSharedSummary({ query: { token: 'c'.repeat(43) } } as any, res);
    expect(res.statusCode).toBe(404);
  });

  it('answers 201 with the token, the expiry and the link', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.startsWith('INSERT INTO shared_summaries')) return [{ insertId: 1 }, []];
      return [[], []];
    });

    const res = resMock();
    await sharedSummaryController.generateSharedSummary(
      { body: { patientId: 'PAT-007', patientName: 'Ignored Name' }, user: { id: '2' } } as any,
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.payload.token).toBeTruthy();
    expect(res.payload.expiresAt).toBeTruthy();
    expect(res.payload.url).toBe(`/shared/patient-summary/${res.payload.token}`);
  });
});

describe('shared summary routes', () => {
  it('keeps the public read unauthenticated and the generator authenticated', () => {
    const routeLayers = sharedSummaryRoutes.stack.filter((layer: any) => layer.route);
    const getLayer = routeLayers.find((layer: any) => layer.route.path === '/patient-summary');
    const postLayer = routeLayers.find(
      (layer: any) => layer.route.path === '/patient-summary/generate'
    );

    const getNames = getLayer.route.stack.map((s: any) => s.name);
    const postNames = postLayer.route.stack.map((s: any) => s.name);

    expect(getNames).not.toContain('authenticate');
    expect(postNames).toContain('authenticate');
  });
});

describe('shared summary HTTP surface', () => {
  const secret = process.env.JWT_SECRET || 'dev-only-jwt-secret';
  const token = jwt.sign(
    { id: '1', email: 'doctor@smarthealth.com', role: 'Doctor', hospital_id: 'HOSP-001' },
    secret
  );

  const withServer = async (fn: (base: string) => Promise<void>): Promise<void> => {
    const app = express();
    app.use(express.json());
    app.use('/api/shared', sharedSummaryRoutes);
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
      if (sql.includes('FROM shared_summaries s')) {
        return [
          [
            {
              share_id: 5,
              expires_at: new Date(Date.now() + 60_000),
              patient_id: 7,
              patient_name: 'Ada Lovelace',
              patient_code: 'PAT-007',
              first_name: 'Ada',
              last_name: 'Lovelace',
            },
          ],
          [],
        ];
      }
      if (sql.includes('UPDATE shared_summaries')) return [{ affectedRows: 1 }, []];
      if (sql.includes('FROM appointments a')) return [[], []];
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.startsWith('INSERT INTO shared_summaries')) return [{ insertId: 1 }, []];
      if (sql.includes('FROM vitals v')) return [[], []];
      return [[], []];
    });
  });

  it('serves the summary to an anonymous holder of the token', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/shared/patient-summary?token=${'a'.repeat(43)}`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.patientId).toBe('PAT-007');
      expect(body.patientName).toBe('Ada Lovelace');
      expect(Array.isArray(body.appointments)).toBe(true);
    });
  });

  it('rejects a request without a token', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/shared/patient-summary`);
      expect(response.status).toBe(400);
    });
  });

  it('refuses to generate a link without authentication', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/shared/patient-summary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'PAT-007' }),
      });
      expect(response.status).toBe(401);
    });
  });

  it('generates a link for an authenticated clinician', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/shared/patient-summary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: 'PAT-007' }),
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.url).toBe(`/shared/patient-summary/${body.token}`);
    });
  });
});
