import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args: unknown[]) => queryMock(...args),
  },
}));

import {
  DispensingEventError,
  createDispensingEvent,
  deleteDispensingEvent,
  listDispensingEvents,
} from '../services/dispensingEvent.service.js';

const EVENT_ROW = {
  id: 11,
  prescriptionId: 'RX-1',
  patientId: 1,
  patientCode: 'PAT-001',
  patientName: 'John Doe',
  medicineId: 'MED-1',
  medicineName: 'Paracetamol 500mg',
  quantity: 5,
  dispensedBy: 3,
  dispensedByName: 'Dr. Smith',
  dispensedAt: '2026-10-20 09:15:00',
  notes: 'Take with food',
  createdAt: '2026-10-20 09:15:00',
};

beforeEach(() => {
  queryMock.mockReset();
});

describe('dispensing event service', () => {
  describe('createDispensingEvent', () => {
    it('resolves the medicine name and records the dispensing user', async () => {
      queryMock
        .mockResolvedValueOnce([[{ id: 1 }]]) // patient
        .mockResolvedValueOnce([[{ id: 'MED-1', medicine_name: 'Paracetamol 500mg' }]]) // medicine
        .mockResolvedValueOnce([{ insertId: 11 }]) // insert
        .mockResolvedValueOnce([[EVENT_ROW]]); // read back

      const event = await createDispensingEvent({
        patientId: 1,
        medicineId: 'MED-1',
        quantity: 5,
        prescriptionId: 'RX-1',
        notes: 'Take with food',
        dispensedBy: 3,
      });

      const [insertSql, insertParams] = queryMock.mock.calls[2];
      expect(insertSql).toContain('INSERT INTO dispensing_events');
      expect(insertParams).toContain('Paracetamol 500mg');
      expect(insertParams).toContain(3);
      expect(event.id).toBe(11);
      expect(event.medicineName).toBe('Paracetamol 500mg');
    });

    it('defaults the dispense time to now', async () => {
      queryMock
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([[{ id: 'MED-1', medicine_name: 'Paracetamol 500mg' }]])
        .mockResolvedValueOnce([{ insertId: 11 }])
        .mockResolvedValueOnce([[EVENT_ROW]]);

      const before = Date.now();
      await createDispensingEvent({ patientId: 1, medicineId: 'MED-1', quantity: 1, dispensedBy: 3 });

      const stamp = String(queryMock.mock.calls[2][1][6]);
      const parsed = new Date(stamp.replace(' ', 'T')).getTime();
      expect(parsed).toBeGreaterThanOrEqual(before - 60_000);
      expect(parsed).toBeLessThanOrEqual(Date.now() + 60_000);
    });

    it('rejects a medicine that is not in the inventory', async () => {
      queryMock
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([[]]);

      await expect(
        createDispensingEvent({ patientId: 1, medicineId: 'NOPE', quantity: 1 })
      ).rejects.toBeInstanceOf(DispensingEventError);
    });

    it('rejects a patient that does not exist', async () => {
      queryMock.mockResolvedValueOnce([[]]);

      await expect(
        createDispensingEvent({ patientId: 99, medicineId: 'MED-1', quantity: 1 })
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('listDispensingEvents', () => {
    it('filters and orders newest first', async () => {
      queryMock.mockResolvedValueOnce([[EVENT_ROW]]);

      const events = await listDispensingEvents({
        patientId: 1,
        medicineId: 'MED-1',
        from: '2026-10-01',
        to: '2026-10-20',
        limit: 25,
      });

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('de.patient_id = ?');
      expect(sql).toContain('de.medicine_id = ?');
      expect(sql).toContain('ORDER BY de.dispensed_at DESC, de.id DESC');
      expect(sql).toContain('LIMIT ?');
      expect(params).toContain('2026-10-01 00:00:00');
      expect(params).toContain('2026-10-20 23:59:59');
      expect(params[params.length - 1]).toBe(25);
      expect(events).toHaveLength(1);
    });

    it('caps the limit so a client cannot ask for the whole table', async () => {
      queryMock.mockResolvedValueOnce([[]]);

      await listDispensingEvents({ limit: 100_000 });

      const params = queryMock.mock.calls[0][1] as unknown[];
      expect(params[params.length - 1]).toBe(500);
    });
  });

  describe('deleteDispensingEvent', () => {
    it('reports a missing event', async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      await expect(deleteDispensingEvent(11)).rejects.toMatchObject({ status: 404 });
    });

    it('deletes an existing event', async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      await expect(deleteDispensingEvent(11)).resolves.toBeUndefined();
    });
  });
});
