import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The service talks to MySQL through the shared pool. The pool is replaced
 * with a scripted double so the tests can assert on the SQL that is issued
 * and on the transaction behaviour of the sign-off.
 */
const { queryMock, connectionMock } = vi.hoisted(() => {
  const connection = {
    query: vi.fn(),
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
  };
  return {
    queryMock: vi.fn(),
    connectionMock: connection,
  };
});

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args: unknown[]) => queryMock(...args),
    getConnection: async () => connectionMock,
  },
}));

import {
  MedicationAdministrationError,
  createMedicationAdministration,
  deleteMedicationAdministration,
  getMedicationAdministrationOptions,
  listMedicationAdministrations,
  markOverdueAdministrations,
  parseDosageQuantity,
  signOffMedicationAdministration,
  updateMedicationAdministration,
} from '../services/medicationAdministration.service.js';

const RECORD_ROW = {
  id: 7,
  patientId: 1,
  patientCode: 'PAT-001',
  patientName: 'John Doe',
  medicineId: 'MED-1',
  medicineName: 'Paracetamol 500mg',
  dosage: '2 Tablets',
  scheduledTime: '2026-10-20 08:00:00',
  status: 'pending',
  assignedStaffId: 1,
  assignedStaff: 'John Smith',
  criticalNotes: 'With breakfast',
  administeredAt: null,
};

const resetMocks = (): void => {
  queryMock.mockReset();
  connectionMock.query.mockReset();
  connectionMock.beginTransaction.mockClear();
  connectionMock.commit.mockClear();
  connectionMock.rollback.mockClear();
  connectionMock.release.mockClear();
};

describe('medication administration service', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('parseDosageQuantity', () => {
    it('reads the leading unit count out of the dosage text', () => {
      expect(parseDosageQuantity('2 Tablets')).toBe(2);
      expect(parseDosageQuantity('10 Units')).toBe(10);
      expect(parseDosageQuantity('1 tablet')).toBe(1);
    });

    it('falls back to a single unit when the dosage carries no number', () => {
      expect(parseDosageQuantity('As needed')).toBe(1);
      expect(parseDosageQuantity(null)).toBe(1);
      expect(parseDosageQuantity('')).toBe(1);
    });
  });

  describe('listMedicationAdministrations', () => {
    it('marks overdue doses before reading them', async () => {
      queryMock
        .mockResolvedValueOnce([{ affectedRows: 2 }])
        .mockResolvedValueOnce([[RECORD_ROW]]);

      const records = await listMedicationAdministrations({});

      expect(queryMock.mock.calls[0][0]).toContain('UPDATE medication_administrations');
      expect(queryMock.mock.calls[0][0]).toContain("status = 'overdue'");
      expect(records).toHaveLength(1);
      expect(records[0].patientName).toBe('John Doe');
    });

    it('filters by patient, status and staff through parameters', async () => {
      queryMock
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([[RECORD_ROW]]);

      await listMedicationAdministrations({
        patientId: 1,
        status: 'overdue',
        assignedStaffId: 3,
        date: '2026-10-20',
        limit: 50,
      });

      const [sql, params] = queryMock.mock.calls[1];
      expect(sql).toContain('ma.patient_id = ?');
      expect(sql).toContain('ma.assigned_staff_id = ?');
      expect(sql).toContain('DATE_ADD(?, INTERVAL 1 DAY)');
      expect(params).toContain(1);
      expect(params).toContain('overdue');
      expect(params).toContain(3);
      expect(params).toContain('2026-10-20 00:00:00');
      expect(params[params.length - 1]).toBe(50);
    });
  });

  describe('getMedicationAdministrationOptions', () => {
    it('returns the active patients and the active staff', async () => {
      queryMock
        .mockResolvedValueOnce([[{ patientId: 1, patientCode: 'PAT-001', patientName: 'John Doe' }]])
        .mockResolvedValueOnce([[{ staffId: 1, staffCode: 'STAFF-001', staffName: 'John Smith' }]]);

      const options = await getMedicationAdministrationOptions();

      expect(options.patients).toHaveLength(1);
      expect(options.staff).toHaveLength(1);
      expect(queryMock.mock.calls[0][0]).toContain('FROM patients');
      expect(queryMock.mock.calls[1][0]).toContain('FROM staff');
    });
  });

  describe('createMedicationAdministration', () => {
    it('resolves the medicine name from the inventory and inserts the record', async () => {
      queryMock
        // patient lookup
        .mockResolvedValueOnce([[{ id: 1, patient_id: 'PAT-001', first_name: 'John', last_name: 'Doe' }]])
        // medicine lookup
        .mockResolvedValueOnce([[{ id: 'MED-1', medicine_name: 'Paracetamol 500mg', stock_level: 40 }]])
        // staff lookup
        .mockResolvedValueOnce([[{ id: 3, first_name: 'Ada', last_name: 'Lovelace' }]])
        // insert
        .mockResolvedValueOnce([{ insertId: 42 }])
        // read back
        .mockResolvedValueOnce([[{ ...RECORD_ROW, id: 42 }]]);

      const record = await createMedicationAdministration({
        patientId: 1,
        medicineId: 'MED-1',
        dosage: '2 Tablets',
        scheduledTime: '2026-10-21T08:00',
        assignedStaffId: 3,
        criticalNotes: 'With breakfast',
      });

      const insertSql = queryMock.mock.calls[3][0];
      const insertParams = queryMock.mock.calls[3][1];
      expect(insertSql).toContain('INSERT INTO medication_administrations');
      expect(insertParams).toContain('Paracetamol 500mg');
      expect(insertParams).toContain('2026-10-21 08:00:00');
      expect(insertParams).toContain('Ada Lovelace');
      expect(record.id).toBe(42);
    });

    it('rejects a patient that does not exist', async () => {
      queryMock.mockResolvedValueOnce([[]]);

      await expect(
        createMedicationAdministration({
          patientId: 999,
          medicineId: 'MED-1',
          dosage: '1 Tablet',
          scheduledTime: '2026-10-21T08:00',
        })
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects a medicine that does not exist', async () => {
      queryMock
        .mockResolvedValueOnce([[{ id: 1, patient_id: 'PAT-001', first_name: 'John', last_name: 'Doe' }]])
        .mockResolvedValueOnce([[]]);

      await expect(
        createMedicationAdministration({
          patientId: 1,
          medicineId: 'MISSING',
          dosage: '1 Tablet',
          scheduledTime: '2026-10-21T08:00',
        })
      ).rejects.toBeInstanceOf(MedicationAdministrationError);
    });
  });

  describe('updateMedicationAdministration', () => {
    it('refuses to set the administered status outside the sign-off path', async () => {
      queryMock.mockResolvedValueOnce([[RECORD_ROW]]);

      await expect(
        updateMedicationAdministration(7, { status: 'administered' })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('updates the notes and the assignment', async () => {      queryMock
        .mockResolvedValueOnce([[RECORD_ROW]]) // read
        .mockResolvedValueOnce([[{ id: 3, first_name: 'Ada', last_name: 'Lovelace' }]]) // staff lookup
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
        .mockResolvedValueOnce([[{ ...RECORD_ROW, criticalNotes: 'Updated' }]]); // read back

      await updateMedicationAdministration(7, {
        criticalNotes: 'Updated',
        assignedStaffId: 3,
      });

      const [sql, params] = queryMock.mock.calls[2];
      expect(sql).toContain('critical_notes = ?');
      expect(sql).toContain('assigned_staff_id = ?');
      expect(params).toContain('Ada Lovelace');
    });

    it('refuses to reopen an administered dose so the stock cannot move twice', async () => {
      queryMock.mockResolvedValueOnce([[{ ...RECORD_ROW, status: 'administered' }]]);

      await expect(
        updateMedicationAdministration(7, { status: 'pending' })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('deleteMedicationAdministration', () => {
    it('reports a missing record', async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      await expect(deleteMedicationAdministration(7)).rejects.toMatchObject({ status: 404 });
    });

    it('deletes an existing record', async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      await expect(deleteMedicationAdministration(7)).resolves.toBeUndefined();
    });
  });

  describe('signOffMedicationAdministration', () => {
    it('marks the dose administered and decrements the stock in one transaction', async () => {
      connectionMock.query
        .mockResolvedValueOnce([
          [{ id: 7, patient_id: 1, medicine_id: 'MED-1', medicine_name: 'Paracetamol 500mg', dosage: '2 Tablets', status: 'pending', scheduled_time: '2026-10-20 08:00:00' }],
        ])
        .mockResolvedValueOnce([[{ id: 'MED-1', stock_level: 40 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      queryMock.mockResolvedValueOnce([[{ ...RECORD_ROW, status: 'administered' }]]);

      const result = await signOffMedicationAdministration(7, 3);

      expect(connectionMock.beginTransaction).toHaveBeenCalled();
      expect(connectionMock.commit).toHaveBeenCalled();
      expect(connectionMock.rollback).not.toHaveBeenCalled();

      const [stockSql, stockParams] = connectionMock.query.mock.calls[1];
      expect(stockSql).toContain('SELECT id, stock_level FROM medicines_inventory');
      expect(stockParams).toEqual(['MED-1']);

      const [decrementSql, decrementParams] = connectionMock.query.mock.calls[2];
      expect(decrementSql).toContain('UPDATE medicines_inventory SET stock_level = stock_level - ?');
      expect(decrementParams).toEqual([2, 'MED-1']);

      const [updateSql, updateParams] = connectionMock.query.mock.calls[3];
      expect(updateSql).toContain("status = 'administered'");
      expect(updateParams).toEqual([3, 7]);

      expect(result.quantity).toBe(2);
      expect(result.stockAfter).toBe(38);
    });

    it('refuses to sign off when the stock is short and rolls the transaction back', async () => {
      connectionMock.query
        .mockResolvedValueOnce([
          [{ id: 7, patient_id: 1, medicine_id: 'MED-1', medicine_name: 'Paracetamol 500mg', dosage: '5 Tablets', status: 'pending', scheduled_time: '2026-10-20 08:00:00' }],
        ])
        .mockResolvedValueOnce([[{ id: 'MED-1', stock_level: 2 }]]);

      await expect(signOffMedicationAdministration(7, 3)).rejects.toMatchObject({ status: 409 });

      expect(connectionMock.rollback).toHaveBeenCalled();
      expect(connectionMock.commit).not.toHaveBeenCalled();
      expect(connectionMock.query).toHaveBeenCalledTimes(2);
    });

    it('refuses a second sign-off so the stock cannot be decremented twice', async () => {
      connectionMock.query.mockResolvedValueOnce([
        [{ id: 7, patient_id: 1, medicine_id: 'MED-1', medicine_name: 'Paracetamol 500mg', dosage: '1 Tablet', status: 'administered', scheduled_time: '2026-10-20 08:00:00' }],
      ]);

      await expect(signOffMedicationAdministration(7, 3)).rejects.toMatchObject({ status: 409 });
      expect(connectionMock.rollback).toHaveBeenCalled();
      expect(connectionMock.query).toHaveBeenCalledTimes(1);
    });

    it('uses an explicit quantity when the client sends one', async () => {
      connectionMock.query
        .mockResolvedValueOnce([
          [{ id: 7, patient_id: 1, medicine_id: 'MED-1', medicine_name: 'Paracetamol 500mg', dosage: '2 Tablets', status: 'pending', scheduled_time: '2026-10-20 08:00:00' }],
        ])
        .mockResolvedValueOnce([[{ id: 'MED-1', stock_level: 40 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      queryMock.mockResolvedValueOnce([[{ ...RECORD_ROW, status: 'administered' }]]);

      const result = await signOffMedicationAdministration(7, 3, 4);

      expect(connectionMock.query.mock.calls[2][1]).toEqual([4, 'MED-1']);
      expect(result.quantity).toBe(4);
      expect(result.stockAfter).toBe(36);
    });
  });

  describe('markOverdueAdministrations', () => {
    it('only moves pending doses that are past their scheduled time', async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 3 }]);

      const affected = await markOverdueAdministrations();

      expect(affected).toBe(3);
      const sql = queryMock.mock.calls[0][0];
      expect(sql).toContain("WHERE status = 'pending' AND scheduled_time < NOW()");
    });
  });
});
