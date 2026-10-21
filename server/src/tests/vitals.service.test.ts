import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: { query: queryMock },
}));

import {
  computeVitalStatus,
  computeVitalsSummary,
  extractRecordAlerts,
  formatLocalIso,
  toMysqlDateTime,
  resolvePatient,
  createVital,
  listVitals,
  deleteVital,
} from '../services/vitals.service';
import type { VitalsRecord } from '../services/vitals.service';

const patientRow = { id: 7, patient_id: 'PAT-007', first_name: 'Ada', last_name: 'Lovelace', hospital_id: 1 };

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
    notes: 'Routine checkup',
    status: 'normal',
    patient_code: 'PAT-007',
    first_name: 'Ada',
    last_name: 'Lovelace',
    ...overrides,
  };
}

const record: VitalsRecord = {
  id: '42',
  patientId: 'PAT-007',
  patientName: 'Ada Lovelace',
  recordedAt: '2025-01-10T09:15:00',
  recordedBy: 'Dr. Smith',
  systolicBp: 118,
  diastolicBp: 78,
  heartRate: 72,
  temperature: 36.6,
  respiratoryRate: 16,
  oxygenSaturation: 98,
  notes: 'Routine checkup',
  status: 'normal',
};

beforeEach(() => {
  queryMock.mockReset();
});

describe('computeVitalStatus', () => {
  it('classifies a normal reading', () => {
    expect(computeVitalStatus(118, 78, 72, 36.6)).toBe('normal');
  });

  it('classifies an elevated reading', () => {
    expect(computeVitalStatus(128, 84, 80, 37.1)).toBe('elevated');
  });

  it('classifies a high reading', () => {
    expect(computeVitalStatus(146, 92, 90, 37.4)).toBe('high');
  });

  it('classifies a critical reading', () => {
    expect(computeVitalStatus(185, 78, 72, 36.6)).toBe('critical');
    expect(computeVitalStatus(118, 78, 72, 39.6)).toBe('critical');
    expect(computeVitalStatus(118, 78, 131, 36.6)).toBe('critical');
  });

  it('classifies bradycardia as high', () => {
    expect(computeVitalStatus(118, 78, 45, 36.6)).toBe('high');
  });
});

describe('extractRecordAlerts', () => {
  it('returns no alert for a normal reading', () => {
    expect(extractRecordAlerts(record)).toEqual([]);
  });

  it('raises a critical blood pressure alert', () => {
    const alerts = extractRecordAlerts({ ...record, systolicBp: 185, diastolicBp: 121 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].category).toBe('blood_pressure');
    expect(alerts[0].recordId).toBe('42');
  });

  it('raises a hypotension alert', () => {
    const alerts = extractRecordAlerts({ ...record, systolicBp: 85, diastolicBp: 55 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('Hypotension Warning (Low BP)');
  });

  it('raises a critical hypoxemia alert', () => {
    const alerts = extractRecordAlerts({ ...record, oxygenSaturation: 88 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].category).toBe('oxygen');
    expect(alerts[0].severity).toBe('critical');
  });
});

describe('computeVitalsSummary', () => {
  it('returns null for an empty set', () => {
    expect(computeVitalsSummary([])).toBeNull();
  });

  it('summarises the latest reading', () => {
    const summary = computeVitalsSummary([
      { ...record, recordedAt: '2025-01-01T09:00:00', systolicBp: 120, diastolicBp: 80 },
      { ...record, recordedAt: '2025-01-10T09:15:00', systolicBp: 146, diastolicBp: 92, heartRate: 110, temperature: 38.4 },
    ]);
    expect(summary).not.toBeNull();
    expect(summary?.latestSystolic).toBe(146);
    expect(summary?.bpStatus).toBe('Stage 2');
    expect(summary?.hrStatus).toBe('Tachycardia');
    expect(summary?.tempStatus).toBe('Fever');
    expect(summary?.lastRecordedAt).toBe('2025-01-10T09:15:00');
  });
});

describe('timestamp helpers', () => {
  it('keeps a wall clock timestamp verbatim', () => {
    expect(toMysqlDateTime('2025-01-10 09:15')).toBe('2025-01-10 09:15:00');
    expect(toMysqlDateTime('2025-01-10T09:15:30')).toBe('2025-01-10 09:15:30');
  });

  it('rejects an unparseable timestamp', () => {
    expect(() => toMysqlDateTime('not-a-date')).toThrow();
  });

  it('formats a date as a local ISO string', () => {
    expect(formatLocalIso(new Date(2025, 0, 10, 9, 15, 0))).toBe('2025-01-10T09:15:00');
  });
});

describe('resolvePatient', () => {
  it('resolves the human readable patient id', async () => {
    queryMock.mockResolvedValueOnce([[patientRow], []]);
    const patient = await resolvePatient('PAT-007');
    expect(patient).toEqual({ id: 7, patientId: 'PAT-007', patientName: 'Ada Lovelace', hospitalId: 1 });
  });

  it('falls back to the numeric id', async () => {
    queryMock
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ ...patientRow, id: 9, patient_id: 'PAT-009' }], []]);
    const patient = await resolvePatient('9');
    expect(patient?.id).toBe(9);
  });

  it('returns null for an unknown patient', async () => {
    queryMock.mockResolvedValueOnce([[], []]);
    expect(await resolvePatient('PAT-404')).toBeNull();
  });
});

describe('createVital', () => {
  it('derives and stores the status server side', async () => {
    const calls: any[] = [];
    queryMock.mockImplementation(async (sql: string, params: any[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM patients WHERE patient_id')) return [[patientRow], []];
      if (sql.startsWith('INSERT INTO vitals')) return [{ insertId: 42 }, []];
      if (sql.includes('FROM vitals v')) return [[vitalsRow({ systolic_bp: 185, status: 'critical' })], []];
      return [[], []];
    });

    const vital = await createVital({
      patientId: 'PAT-007',
      recordedAt: '2025-01-10 09:15',
      systolicBp: 185,
      diastolicBp: 121,
      heartRate: 72,
      temperature: 36.6,
    });

    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO vitals'));
    expect(insert).toBeDefined();
    // The status stored is the derived one, not anything the client claimed.
    expect(insert.params[insert.params.length - 1]).toBe('critical');
    expect(vital?.status).toBe('critical');
    expect(vital?.patientId).toBe('PAT-007');
  });

  it('returns null when the patient does not exist', async () => {
    queryMock.mockResolvedValueOnce([[], []]);
    const vital = await createVital({
      patientId: 'PAT-404',
      systolicBp: 120,
      diastolicBp: 80,
      heartRate: 72,
      temperature: 36.8,
    });
    expect(vital).toBeNull();
  });
});

describe('listVitals', () => {
  it('orders by recorded_at descending and caps the result', async () => {
    queryMock
      .mockResolvedValueOnce([[patientRow], []])
      .mockResolvedValueOnce([[vitalsRow()], []]);

    const records = await listVitals({ patientRef: 'PAT-007', limit: 10 });
    expect(records).toHaveLength(1);
    expect(records[0].patientId).toBe('PAT-007');
    expect(records[0].recordedAt).toBe('2025-01-10T09:15:00');

    const listCall = queryMock.mock.calls[1];
    expect(listCall[0]).toContain('ORDER BY v.recorded_at DESC');
    expect(listCall[1]).toContain(10);
  });
});

describe('deleteVital', () => {
  it('reports a missing record', async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    expect(await deleteVital('999')).toBe(false);
  });

  it('reports a deleted record', async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    expect(await deleteVital('42')).toBe(true);
  });
});
