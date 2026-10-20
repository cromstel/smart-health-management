import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args: unknown[]) => queryMock(...args),
  },
}));

import {
  buildInventoryForecast,
  parseDosageQuantity,
} from '../services/pharmacyForecast.service.js';

interface StubOptions {
  medicines?: unknown[];
  dispensing?: unknown[];
  administrations?: unknown[];
  today?: string;
}

const stubQueries = (options: StubOptions = {}): void => {
  const medicines = options.medicines ?? [];
  const dispensing = options.dispensing ?? [];
  const administrations = options.administrations ?? [];
  const today = options.today ?? '2026-10-20';

  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM medicines_inventory')) return [medicines];
    if (sql.includes('DATE_FORMAT(CURDATE()')) return [[{ today }]];
    if (sql.includes('FROM dispensing_events')) return [dispensing];
    if (sql.includes('FROM medication_administrations')) return [administrations];
    if (sql.includes('FROM suppliers')) return [[]];
    return [[]];
  });
};

const MEDICINE = {
  id: 'MED-1',
  medicine_name: 'Amoxicillin 500mg',
  category: 'Antibiotics',
  supplier: 'Ghana Pharma Corp',
  supplier_id: 4,
  stock_level: 100,
  low_stock_threshold: 40,
  unit_price: 1.25,
};

beforeEach(() => {
  queryMock.mockReset();
});

describe('pharmacy forecast service', () => {
  describe('parseDosageQuantity', () => {
    it('reads the leading unit count', () => {
      expect(parseDosageQuantity('2 Tablets')).toBe(2);
      expect(parseDosageQuantity('PRN')).toBe(1);
    });
  });

  describe('buildInventoryForecast', () => {
    it('derives the burn rate from the real dispensing movement', async () => {
      stubQueries({
        medicines: [MEDICINE],
        // 300 units over a 30 day window
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-20', qty: 300 }],
      });

      const { items, meta } = await buildInventoryForecast({ lookbackDays: 30 });

      expect(meta.lookbackDays).toBe(30);
      expect(meta.withUsageHistory).toBe(1);
      expect(meta.withoutUsageHistory).toBe(0);

      const item = items[0];
      expect(item.dailyBurnRate).toBe(10); // 300 / 30 days
      expect(item.daysOfSupply).toBe(10); // 100 / 10
      expect(item.riskLevel).toBe('HEALTHY'); // more than 7 days of supply
      expect(item.dataStatus).toBe('ok');
      expect(item.historicalTrend).toHaveLength(30);
      expect(item.historicalTrend[29].day).toBe('Today');
      expect(item.historicalTrend[29].usage).toBe(300);
      expect(item.historicalTrend[29].projectedStock).toBe(100);
      expect(item.supplier).toBe('Ghana Pharma Corp');
      expect(item.supplierId).toBe(4);
      expect(item.unitPrice).toBe(1.25);
    });

    it('classifies a medicine at or below three days of supply as CRITICAL', async () => {
      stubQueries({
        medicines: [MEDICINE],
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-10', qty: 1000 }],
      });

      const { items } = await buildInventoryForecast({ lookbackDays: 30 });

      expect(items[0].daysOfSupply).toBe(3);
      expect(items[0].riskLevel).toBe('CRITICAL');
    });

    it('classifies a medicine at or below seven days of supply as HIGH', async () => {
      stubQueries({
        medicines: [MEDICINE],
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-10', qty: 600 }],
      });

      const { items } = await buildInventoryForecast({ lookbackDays: 30 });

      expect(items[0].daysOfSupply).toBe(5);
      expect(items[0].riskLevel).toBe('HIGH');
    });

    it('marks a medicine CRITICAL when the stock is already under the reorder point', async () => {
      stubQueries({
        medicines: [{ ...MEDICINE, stock_level: 10, low_stock_threshold: 40 }],
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-10', qty: 30 }],
      });

      const { items } = await buildInventoryForecast({ lookbackDays: 30 });

      expect(items[0].riskLevel).toBe('CRITICAL');
    });

    it('calls a medicine without movement history UNKNOWN instead of inventing a burn rate', async () => {
      stubQueries({ medicines: [MEDICINE], dispensing: [] });

      const { items, meta } = await buildInventoryForecast({ lookbackDays: 30 });

      expect(items[0].dailyBurnRate).toBe(0);
      expect(items[0].daysOfSupply).toBeNull();
      expect(items[0].riskLevel).toBe('UNKNOWN');
      expect(items[0].suggestedReorderQty).toBe(0);
      expect(items[0].predictedDepletionDate).toBe('Insufficient usage history');
      expect(items[0].dataStatus).toBe('insufficient_history');
      expect(meta.withoutUsageHistory).toBe(1);
      expect(meta.criticalCount).toBe(0);
      expect(meta.highCount).toBe(0);
    });

    it('scales the burn rate with the surge multiplier', async () => {
      stubQueries({
        medicines: [MEDICINE],
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-10', qty: 300 }],
      });

      const { items, meta } = await buildInventoryForecast({ surgeMultiplier: 2 });

      expect(meta.surgeMultiplier).toBe(2);
      expect(items[0].dailyBurnRate).toBe(20);
      expect(items[0].daysOfSupply).toBe(5);
    });

    it('suggests enough stock for the target cover and never less than the min stock shortfall', async () => {
      stubQueries({
        medicines: [MEDICINE],
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-10', qty: 300 }],
      });

      const { items } = await buildInventoryForecast({ lookbackDays: 30, targetCoverDays: 30 });

      // 10 units/day * 30 day cover = 300 units, 100 on hand -> 200 to order.
      expect(items[0].suggestedReorderQty).toBe(200);
    });

    it('adds the administered doses to the dispensing movement', async () => {
      stubQueries({
        medicines: [MEDICINE],
        dispensing: [{ medicineId: 'MED-1', day: '2026-10-10', qty: 300 }],
        administrations: [{ medicineId: 'MED-1', day: '2026-10-11', dosage: '5 Tablets' }],
      });

      const { items } = await buildInventoryForecast({ lookbackDays: 30 });

      // 300 dispensed + 5 administered = 305 over 30 days.
      expect(items[0].dailyBurnRate).toBe(10.17);
      const trend = items[0].historicalTrend;
      expect(trend.reduce((sum, point) => sum + point.usage, 0)).toBe(305);
      expect(trend.filter((point) => point.usage === 5)).toHaveLength(1);
      expect(trend.filter((point) => point.usage === 300)).toHaveLength(1);
    });

    it('orders the items by risk so the critical ones come first', async () => {
      stubQueries({
        medicines: [
          MEDICINE,
          { ...MEDICINE, id: 'MED-2', medicine_name: 'Salbutamol', stock_level: 500 },
          { ...MEDICINE, id: 'MED-3', medicine_name: 'Unknown Med' },
        ],
        dispensing: [
          { medicineId: 'MED-1', day: '2026-10-10', qty: 1000 },
          { medicineId: 'MED-2', day: '2026-10-10', qty: 10 },
        ],
      });

      const { items } = await buildInventoryForecast({ lookbackDays: 30 });

      expect(items.map((i) => i.riskLevel)).toEqual(['CRITICAL', 'UNKNOWN', 'HEALTHY']);
    });
  });
});
