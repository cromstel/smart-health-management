import pool from '../config/database.js';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Pharmacy inventory forecasting.
 *
 * The forecast used to be a hardcoded array in the browser, recomputed from
 * a constant burn rate. Everything here is derived from real movement:
 *
 *  - `dispensing_events` is the primary movement log (units that left the
 *    shelf against a prescription).
 *  - `medication_administrations` with `status = 'administered'` is the
 *    second source (doses given from ward stock).
 *
 * The two sources are disjoint -- a dose signed off through the MAR is not
 * also written as a dispensing event -- so their usage can be summed without
 * double counting.
 */

export const FORECAST_THRESHOLDS = {
  /** At or below this many days of supply the medicine is CRITICAL. */
  criticalDays: 3,
  /** At or below this many days of supply the medicine is HIGH. */
  highDays: 7,
  /** How many days of cover a reorder aims for. */
  targetCoverDays: 30,
} as const;

export const FORECAST_LOOKBACK_DAYS_DEFAULT = 30;
export const FORECAST_LOOKBACK_DAYS_MIN = 7;
export const FORECAST_LOOKBACK_DAYS_MAX = 365;

export type ForecastRiskLevel = 'CRITICAL' | 'HIGH' | 'HEALTHY' | 'UNKNOWN';

export interface ForecastTrendPoint {
  /** Human readable day label, e.g. "Oct 05"; the last day is "Today". */
  day: string;
  /** Units of this medicine that moved on that day. */
  usage: number;
  /** Stock that would have been on hand at the end of that day. */
  projectedStock: number;
}

export interface ForecastItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  dailyBurnRate: number;
  daysOfSupply: number | null;
  predictedDepletionDate: string;
  riskLevel: ForecastRiskLevel;
  suggestedReorderQty: number;
  unitPrice: number;
  supplier: string;
  /** `suppliers.id` for the medicine, or null when the item has no supplier. */
  supplierId: number | null;
  historicalTrend: ForecastTrendPoint[];
  /**
   * `ok` when the burn rate is backed by movement data, `insufficient_history`
   * when the medicine did not move inside the lookback window.
   */
  dataStatus: 'ok' | 'insufficient_history';
}

export interface ForecastMeta {
  surgeMultiplier: number;
  lookbackDays: number;
  targetCoverDays: number;
  generatedAt: string;
  totalMedicines: number;
  withUsageHistory: number;
  withoutUsageHistory: number;
  criticalCount: number;
  highCount: number;
  suggestedReorderTotal: number;
  suggestedReorderCost: number;
}

export interface ForecastResult {
  items: ForecastItem[];
  meta: ForecastMeta;
}

export interface ForecastOptions {
  surgeMultiplier?: number | null;
  lookbackDays?: number | null;
  targetCoverDays?: number | null;
}

interface MedicineRow extends RowDataPacket {
  id: string;
  medicine_name: string;
  category: string | null;
  supplier: string | null;
  supplier_id: number | null;
  stock_level: number | null;
  low_stock_threshold: number | null;
  unit_price: number | string | null;
}

interface UsageRow extends RowDataPacket {
  medicineId: string;
  day: string;
  qty: number | string;
}

interface AdministrationRow extends RowDataPacket {
  medicineId: string;
  day: string;
  dosage: string | null;
}

/**
 * The number of units a recorded dose consumed.
 *
 * The dosage is free text ("2 Tablets"), so the leading number is the unit
 * count. A dose without a number counts as a single unit.
 */
export const parseDosageQuantity = (dosage: string | null | undefined): number => {
  if (!dosage) return 1;
  const match = /^\s*(\d+(?:\.\d+)?)/.exec(String(dosage));
  if (!match) return 1;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.round(parsed));
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2026-10-05" -> "Oct 05" */
const shortDayLabel = (isoDay: string): string => {
  const [year, month, day] = isoDay.split('-');
  if (!year || !month || !day) return isoDay;
  const monthIndex = Number(month) - 1;
  const monthName = MONTHS[monthIndex] ?? month;
  return `${monthName} ${day}`;
};

const RISK_ORDER: Record<ForecastRiskLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  UNKNOWN: 2,
  HEALTHY: 3,
};

/**
 * Computes the forecast for the whole inventory.
 *
 * Thresholds (see FORECAST_THRESHOLDS):
 *  - CRITICAL: days of supply <= 3, or the stock is already at/below the
 *    reorder threshold.
 *  - HIGH: days of supply <= 7.
 *  - HEALTHY: more than 7 days of supply.
 *  - UNKNOWN: the medicine did not move at all inside the lookback window,
 *    so no burn rate can be derived. Those items are excluded from the risk
 *    ranking and never get a reorder suggestion -- inventing a burn rate for
 *    them would produce a number nobody can defend.
 */
export const buildInventoryForecast = async (
  options: ForecastOptions = {}
): Promise<ForecastResult> => {
  const surgeMultiplier = clamp(
    Number(options.surgeMultiplier ?? 1) || 1,
    0.1,
    10
  );
  const lookbackDays = Math.min(
    Math.max(
      Math.trunc(Number(options.lookbackDays ?? FORECAST_LOOKBACK_DAYS_DEFAULT) || FORECAST_LOOKBACK_DAYS_DEFAULT),
      FORECAST_LOOKBACK_DAYS_MIN
    ),
    FORECAST_LOOKBACK_DAYS_MAX
  );
  const targetCoverDays = Math.min(
    Math.max(
      Math.trunc(Number(options.targetCoverDays ?? FORECAST_THRESHOLDS.targetCoverDays) || FORECAST_THRESHOLDS.targetCoverDays),
      1
    ),
    365
  );

  const [medicineRows] = await pool.query(
    `SELECT id, medicine_name, category, supplier, supplier_id, stock_level, low_stock_threshold, unit_price
     FROM medicines_inventory
     ORDER BY medicine_name`
  );
  const medicines = medicineRows as MedicineRow[];

  const [dayRows] = await pool.query(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`
  );
  const todayIso = String((dayRows as RowDataPacket[])[0]?.today ?? '');

  const [dispensingRows] = await pool.query(
    `SELECT medicine_id AS medicineId,
            DATE_FORMAT(dispensed_at, '%Y-%m-%d') AS day,
            SUM(quantity) AS qty
     FROM dispensing_events
     WHERE medicine_id IS NOT NULL
       AND dispensed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY medicine_id, DATE_FORMAT(dispensed_at, '%Y-%m-%d')`,
    [lookbackDays - 1]
  );

  const [administrationRows] = await pool.query(
    `SELECT medicine_id AS medicineId,
            DATE_FORMAT(administered_at, '%Y-%m-%d') AS day,
            dosage
     FROM medication_administrations
     WHERE status = 'administered'
       AND medicine_id IS NOT NULL
       AND administered_at IS NOT NULL
       AND administered_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [lookbackDays - 1]
  );

  const usage = new Map<string, Map<string, number>>();
  const addUsage = (medicineId: string, day: string, qty: number): void => {
    if (!medicineId || !day || !Number.isFinite(qty) || qty <= 0) return;
    let days = usage.get(medicineId);
    if (!days) {
      days = new Map<string, number>();
      usage.set(medicineId, days);
    }
    days.set(day, (days.get(day) ?? 0) + qty);
  };

  for (const row of dispensingRows as UsageRow[]) {
    addUsage(String(row.medicineId), String(row.day), Number(row.qty ?? 0));
  }
  for (const row of administrationRows as AdministrationRow[]) {
    addUsage(String(row.medicineId), String(row.day), parseDosageQuantity(row.dosage));
  }

  // The calendar window, oldest first, anchored on the database's today so
  // the day buckets line up with the buckets the queries produced.
  const windowDays: string[] = [];
  if (todayIso) {
    const anchor = new Date(`${todayIso}T00:00:00Z`);
    for (let offset = lookbackDays - 1; offset >= 0; offset -= 1) {
      windowDays.push(new Date(anchor.getTime() - offset * 86_400_000).toISOString().slice(0, 10));
    }
  }

  const supplierNames = await resolveSupplierNames(medicines);

  const items: ForecastItem[] = medicines.map((medicine) => {
    const currentStock = Number(medicine.stock_level ?? 0);
    const minStock = Number(medicine.low_stock_threshold ?? 0);
    const unitPrice = Number(medicine.unit_price ?? 0);
    const medicineUsage = usage.get(String(medicine.id));

    let totalUsage = 0;
    for (const qty of (medicineUsage?.values() ?? [])) totalUsage += qty;

    const hasHistory = totalUsage > 0;
    const baseBurnRate = hasHistory ? totalUsage / lookbackDays : 0;
    const dailyBurnRate = round2(baseBurnRate * surgeMultiplier);

    const daysOfSupply =
      hasHistory && dailyBurnRate > 0 ? round2(currentStock / dailyBurnRate) : null;

    let riskLevel: ForecastRiskLevel;
    if (!hasHistory) {
      riskLevel = 'UNKNOWN';
    } else if (currentStock <= minStock || (daysOfSupply !== null && daysOfSupply <= FORECAST_THRESHOLDS.criticalDays)) {
      riskLevel = 'CRITICAL';
    } else if (daysOfSupply !== null && daysOfSupply <= FORECAST_THRESHOLDS.highDays) {
      riskLevel = 'HIGH';
    } else {
      riskLevel = 'HEALTHY';
    }

    let suggestedReorderQty = 0;
    if (hasHistory && dailyBurnRate > 0) {
      const coverTarget = Math.ceil(targetCoverDays * dailyBurnRate);
      suggestedReorderQty = Math.max(coverTarget - currentStock, minStock - currentStock, 0);
    }

    const predictedDepletionDate =
      daysOfSupply === null
        ? 'Insufficient usage history'
        : formatDepletionDate(daysOfSupply);

    const historicalTrend = buildTrend(windowDays, medicineUsage, currentStock);

    const supplierId = medicine.supplier_id === null || medicine.supplier_id === undefined
      ? null
      : Number(medicine.supplier_id);
    const supplier =
      medicine.supplier ??
      (supplierId !== null ? supplierNames.get(supplierId) ?? '' : '');

    return {
      id: String(medicine.id),
      name: String(medicine.medicine_name),
      category: medicine.category ? String(medicine.category) : 'Uncategorised',
      currentStock,
      minStock,
      dailyBurnRate,
      daysOfSupply,
      predictedDepletionDate,
      riskLevel,
      suggestedReorderQty,
      unitPrice: round2(unitPrice),
      supplier,
      supplierId,
      historicalTrend,
      dataStatus: hasHistory ? 'ok' : 'insufficient_history',
    };
  });

  items.sort((a, b) => {
    const riskDelta = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (riskDelta !== 0) return riskDelta;
    const supplyA = a.daysOfSupply ?? Number.POSITIVE_INFINITY;
    const supplyB = b.daysOfSupply ?? Number.POSITIVE_INFINITY;
    if (supplyA !== supplyB) return supplyA - supplyB;
    return a.name.localeCompare(b.name);
  });

  const meta: ForecastMeta = {
    surgeMultiplier,
    lookbackDays,
    targetCoverDays,
    generatedAt: new Date().toISOString(),
    totalMedicines: items.length,
    withUsageHistory: items.filter((i) => i.dataStatus === 'ok').length,
    withoutUsageHistory: items.filter((i) => i.dataStatus !== 'ok').length,
    criticalCount: items.filter((i) => i.riskLevel === 'CRITICAL').length,
    highCount: items.filter((i) => i.riskLevel === 'HIGH').length,
    suggestedReorderTotal: items.reduce((sum, i) => sum + i.suggestedReorderQty, 0),
    suggestedReorderCost: round2(
      items.reduce((sum, i) => sum + i.suggestedReorderQty * i.unitPrice, 0)
    ),
  };

  return { items, meta };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Resolves supplier names for medicines that only carry the foreign key.
 * The inventory table keeps a denormalised name, but not every row has one.
 */
const resolveSupplierNames = async (medicines: MedicineRow[]): Promise<Map<number, string>> => {
  const ids = [
    ...new Set(
      medicines
        .map((m) => (m.supplier_id === null || m.supplier_id === undefined ? null : Number(m.supplier_id)))
        .filter((id): id is number => id !== null && Number.isFinite(id))
    ),
  ];
  const names = new Map<number, string>();
  if (!ids.length) return names;
  const [rows] = await pool.query('SELECT id, name FROM suppliers WHERE id IN (?)', [ids]);
  for (const row of rows as RowDataPacket[]) {
    names.set(Number(row.id), String(row.name));
  }
  return names;
};

/**
 * The daily usage and the stock trajectory.
 *
 * `projectedStock` is derived from the real current stock: the stock on hand
 * at the end of a day is the current stock plus everything that was used
 * after that day.
 */
const buildTrend = (
  windowDays: string[],
  medicineUsage: Map<string, number> | undefined,
  currentStock: number
): ForecastTrendPoint[] => {
  const points: ForecastTrendPoint[] = windowDays.map((day, index) => ({
    day: index === windowDays.length - 1 ? 'Today' : shortDayLabel(day),
    usage: round2(medicineUsage?.get(day) ?? 0),
    projectedStock: 0,
  }));

  let running = currentStock;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    points[index].projectedStock = round2(running);
    running += points[index].usage;
  }

  return points;
};

/** "2026-10-20 (In 3 Days)" */
const formatDepletionDate = (daysOfSupply: number): string => {
  const days = Math.max(0, Math.floor(daysOfSupply));
  const date = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${iso} (In ${days} Days)`;
};
