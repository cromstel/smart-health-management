import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mintToken as mintSessionToken } from './helpers/mintToken.js';
import express from 'express';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: { query: queryMock },
}));

import {
  chat,
  clinicalInsights,
  resolveModel,
  isPhiSendingAllowed,
  buildLocalInsight,
} from '../services/gemini.service';
import * as geminiController from '../controllers/gemini.controller';
import geminiRoutes from '../routes/gemini.routes';
import type { VitalsRecord } from '../services/vitals.service';

const originalKey = process.env.GEMINI_API_KEY;
const originalPhi = process.env.GEMINI_SEND_PHI;

function vitals(overrides: Partial<VitalsRecord> = {}): VitalsRecord {
  return {
    id: '1',
    patientId: 'PAT-007',
    patientName: 'Ada Lovelace',
    recordedAt: '2025-01-10T09:15:00',
    recordedBy: 'Dr. Smith',
    systolicBp: 146,
    diastolicBp: 92,
    heartRate: 72,
    temperature: 36.6,
    oxygenSaturation: 98,
    status: 'high',
    ...overrides,
  };
}

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

beforeEach(() => {
  queryMock.mockReset();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_SEND_PHI;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalPhi === undefined) delete process.env.GEMINI_SEND_PHI;
  else process.env.GEMINI_SEND_PHI = originalPhi;
  vi.unstubAllGlobals();
});

describe('resolveModel', () => {
  it('maps the aliases the assistant offers', () => {
    expect(resolveModel('pro')).toBe('gemini-3.1-pro-preview');
    expect(resolveModel('flash')).toBe('gemini-3.8-flash');
    expect(resolveModel('lite')).toBe('gemini-3.5-flash-lite');
  });

  it('defaults an unknown value to flash', () => {
    expect(resolveModel('nonsense')).toBe('gemini-3.8-flash');
    expect(resolveModel(undefined)).toBe('gemini-3.8-flash');
  });

  it('accepts a well formed gemini model id', () => {
    expect(resolveModel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });

  it('refuses a value that could redirect the request', () => {
    expect(resolveModel('../../evil')).toBe('gemini-3.8-flash');
    expect(resolveModel('gemini/../x')).toBe('gemini-3.8-flash');
  });
});

describe('chat', () => {
  it('returns a labelled simulated answer when no API key is configured', async () => {
    const result = await chat({
      messages: [{ role: 'user', content: 'What is the blood pressure target?' }],
    });

    expect(result.simulated).toBe(true);
    expect(result.text).toMatch(/SIMULATED RESPONSE/);
    expect(result.text).toMatch(/not be read as clinical guidance/i);
    expect(result.groundingMetadata.grounded).toBe(false);
  });

  it('passes the system instruction as a system instruction and enables grounding', async () => {
    process.env.GEMINI_API_KEY = 'stub-key';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: 'Target is under 120/80.' }] },
            groundingMetadata: {
              googleSearchQueries: ['blood pressure target'],
              groundingChunks: [{ web: { title: 'AHA', uri: 'https://example.org/aha' } }],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chat({
      messages: [{ role: 'user', content: 'What is the blood pressure target?' }],
      modelType: 'pro',
      systemInstruction: 'You are a clinical assistant.',
      enableSearchGrounding: true,
    });

    expect(result.simulated).toBe(false);
    expect(result.text).toBe('Target is under 120/80.');
    expect(result.modelUsed).toBe('gemini-3.1-pro-preview');
    expect(result.groundingMetadata.grounded).toBe(true);
    expect(result.groundingMetadata.sources?.[0].uri).toBe('https://example.org/aha');

    const [, init] = fetchMock.mock.calls[0] as any;
    const body = JSON.parse(init.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'You are a clinical assistant.' }] });
    expect(body.tools).toEqual([{ googleSearch: {} }]);
    // The system instruction is not smuggled into a user turn.
    expect(body.contents[0].parts[0].text).toBe('What is the blood pressure target?');
  });

  it('falls back to a simulated answer when the upstream call fails', async () => {
    process.env.GEMINI_API_KEY = 'stub-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'upstream boom' } }),
      }))
    );

    const result = await chat({ messages: [{ role: 'user', content: 'hello' }] });
    expect(result.simulated).toBe(true);
    expect(result.text).toMatch(/SIMULATED RESPONSE/);
  });
});

describe('clinicalInsights', () => {
  it('keeps the patient data local unless PHI sending is switched on', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await clinicalInsights({
      patientId: 'PAT-007',
      patientName: 'Ada Lovelace',
      vitalsList: [vitals()],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.simulated).toBe(true);
    expect(result.modelUsed).toBe('local-clinical-rules');
    expect(result.text).toMatch(/Rule-based clinical summary \(not AI-generated\)/);
    expect(result.text).toMatch(/146\/92/);
    expect(isPhiSendingAllowed()).toBe(false);
  });

  it('sends the vitals to the model when PHI sending is enabled', async () => {
    process.env.GEMINI_SEND_PHI = 'true';
    process.env.GEMINI_API_KEY = 'stub-key';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Stage 2 pressure.' }] } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await clinicalInsights({
      patientId: 'PAT-007',
      patientName: 'Ada Lovelace',
      vitalsList: [vitals()],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as any;
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0].text).toMatch(/146\/92 mmHg/);
    expect(result.simulated).toBe(false);
  });
});

describe('buildLocalInsight', () => {
  it('lists the alerts of the latest reading', () => {
    const text = buildLocalInsight([vitals()]);
    expect(text).toMatch(/Active alerts \(1\)/);
    expect(text).toMatch(/Stage 2 Hypertension Alert/);
  });

  it('handles an empty record set', () => {
    expect(buildLocalInsight([])).toMatch(/No clinical readings available/);
  });
});

describe('gemini controller', () => {
  it('re-derives the status of an incoming reading', async () => {
    const res = resMock();
    await geminiController.insights(
      {
        body: {
          patientId: 'PAT-007',
          vitalsList: [
            {
              id: '1',
              patientId: 'PAT-007',
              patientName: 'Ada Lovelace',
              recordedAt: '2025-01-10T09:15:00',
              recordedBy: 'Dr. Smith',
              systolicBp: 185,
              diastolicBp: 121,
              heartRate: 72,
              temperature: 36.6,
              status: 'normal',
            },
          ],
        },
        user: { id: '1' },
      } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.text).toMatch(/Hypertensive Crisis/);
  });
});

describe('gemini routes', () => {
  it('exposes the chat and insights endpoints behind authentication', () => {
    const paths = geminiRoutes.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

    expect(paths).toEqual(expect.arrayContaining(['POST /chat', 'POST /insights']));
  });
});

describe('gemini HTTP surface', () => {
  const token = mintSessionToken(1, 'doctor@smarthealth.com', 'Doctor', { hospital_id: 'HOSP-001' });

  const withServer = async (fn: (base: string) => Promise<void>): Promise<void> => {
    const app = express();
    app.use(express.json());
    app.use('/api/gemini', geminiRoutes);
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
        if (sql.includes('AS platform_wide')) {
          // The account behind the token, as the authentication middleware reads it.
          return [[{ id: 1, role_id: 2, status: 'active', hospital_id: 1, token_version: 0, role_name: 'admin', hospital_code: 'HOSP-001', platform_wide: 1 }], []];
        }
      if (sql.includes('password_must_change')) {
        return [[{ password_must_change: 0, password_postpone_count: 0 }], []];
      }
      return [[], []];
    });
  });

  it('rejects a chat request whose messages are not an array', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: 'not-an-array' }),
      });

      expect(response.status).toBe(400);
    });
  });

  it('refuses an unauthenticated chat request', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      });

      expect(response.status).toBe(401);
    });
  });
});
