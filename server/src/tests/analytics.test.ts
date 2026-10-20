import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: { query: queryMock },
}));

import * as analyticsController from '../controllers/analytics.controller';
import analyticsRoutes from '../routes/analytics.routes';

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
});

describe('analytics event controller', () => {
  it('persists the event and reports it as synced', async () => {
    const insertParams: any[] = [];
    queryMock.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.startsWith('INSERT INTO analytics_events')) {
        insertParams.push(...params);
        return [{ insertId: 11 }, []];
      }
      return [[], []];
    });

    const req: any = {
      body: {
        id: 'evt-1',
        type: 'page_view',
        payload: { page: '/patients' },
        timestamp: 1737000000000,
        sessionId: 'sess-1',
        pageUrl: '/patients',
      },
      headers: {},
    };
    const res = resMock();

    await analyticsController.recordEvent(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.payload.status).toBe('success');
    expect(res.payload.synced).toBe(true);
    expect(res.payload.eventId).toBe(11);

    expect(insertParams[0]).toBe('page_view');
    expect(insertParams[2]).toBeNull(); // no authenticated user on an anonymous beacon
    expect(insertParams[3]).toBe('sess-1');
    expect(insertParams[4]).toBe('/patients');
    expect(insertParams[5]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    const eventData = JSON.parse(insertParams[1]);
    expect(eventData.page).toBe('/patients');
    expect(eventData.clientEventId).toBe('evt-1');
  });

  it('answers with a non-success status when the event cannot be stored', async () => {
    queryMock.mockRejectedValue(new Error('database is down'));

    const req: any = {
      body: { id: 'evt-2', type: 'click', payload: {}, timestamp: 1737000000000 },
      headers: {},
    };
    const res = resMock();

    await analyticsController.recordEvent(req, res);

    // The event was not stored, so the client must keep it in its queue.
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('error');
    expect(res.payload.synced).toBe(false);
  });

  it('rejects an event without a type', async () => {
    const req: any = { body: { id: 'evt-3', payload: {} }, headers: {} };
    const res = resMock();
    await analyticsController.recordEvent(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload.synced).toBe(false);
  });
});

describe('analytics routes', () => {
  it('keeps the beacon on the CSRF exemption path', () => {
    const layer = analyticsRoutes.stack.find((l: any) => l.route?.path === '/event');
    expect(layer).toBeDefined();
    expect(layer.route.methods.post).toBe(true);
  });
});

describe('analytics HTTP surface', () => {
  const withServer = async (fn: (base: string) => Promise<void>): Promise<void> => {
    const app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = (server.address() as any).port;
    try {
      await fn(`http://127.0.0.1:${port}`);
    } finally {
      server.close();
    }
  };

  it('stores an anonymous event and reports it as synced', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT INTO analytics_events')) return [{ insertId: 3 }, []];
      return [[], []];
    });

    await withServer(async (base) => {
      const response = await fetch(`${base}/api/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'evt-1',
          type: 'page_view',
          payload: { page: '/patients' },
          timestamp: 1737000000000,
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.status).toBe('success');
      expect(body.synced).toBe(true);
    });
  });

  it('rejects an event without a type', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'evt-2', payload: {} }),
      });

      expect(response.status).toBe(400);
    });
  });
});
