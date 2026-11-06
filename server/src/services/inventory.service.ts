import pool from '../config/database.js';
import { randomBytes } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

/**
 * Inventory / purchase-order service.
 *
 * Two related responsibilities live here:
 *   1. The nightly low-stock job (`checkStockAndCreatePurchaseOrders`) that
 *      raises purchase orders for items that dropped below their reorder
 *      point.
 *   2. The purchase-order write rules (business key generation, status
 *      normalisation, line-item maths) that the HTTP controller reuses, so
 *      the controller stays a thin orchestration layer as required by the
 *      project architecture.
 */

/* ------------------------------------------------------------------ *
 * Shared purchase-order business rules
 * ------------------------------------------------------------------ */

/** Statuses accepted by the `purchase_orders.status` ENUM. */
export const PURCHASE_ORDER_STATUSES = [
  'pending',
  'ordered',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/**
 * Columns a client may write on `purchase_orders`.
 *
 * `id` (surrogate key), `order_id` (server generated business key),
 * `hospital_id` (tenant scope) and `created_by` (audit trail) are
 * deliberately NOT updatable -- they are owned by the server.
 */
export const PURCHASE_ORDER_UPDATE_FIELDS = [
  'supplier_id',
  'order_date',
  'expected_delivery_date',
  'total_amount',
] as const;

/** Workflow aliases used by the client, mapped onto the DB ENUM values. */
const STATUS_ALIASES: Record<string, PurchaseOrderStatus> = {
  draft: 'pending',
  pending: 'pending',
  submitted: 'ordered',
  ordered: 'ordered',
  approved: 'shipped',
  shipped: 'shipped',
  fulfilled: 'delivered',
  completed: 'delivered',
  delivered: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

/**
 * Maps a client supplied status onto the lowercase ENUM values stored in
 * `purchase_orders.status`. The column is an ENUM with lowercase values only,
 * so 'Pending' (as the old code wrote) was rejected by MySQL.
 */
export const normalizePurchaseOrderStatus = (value: unknown): string => {
  const key = String(value ?? '').trim().toLowerCase();
  return STATUS_ALIASES[key] ?? key;
};

export const isPurchaseOrderStatus = (value: string): value is PurchaseOrderStatus =>
  (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value);

/** Rounds to two decimals, avoiding float drift on DECIMAL money columns. */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Coerces a value that may arrive as a string (JWT claims, form posts) into a
 * positive integer id, or null when it is absent or not a usable id.
 * Never invents an id.
 */
export const toNullableId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

/**
 * `purchase_orders.order_id` is VARCHAR(20) NOT NULL UNIQUE and the column
 * has no default, so the business key has to be generated server side.
 *
 * Format: `PO-<YYYYMMDD>-<6 hex>` = 18 characters, comfortably inside the
 * column. The random suffix keeps same-day keys distinct; the UNIQUE index
 * is still the source of truth and `insertPurchaseOrder` retries on a
 * collision.
 */
export const generatePurchaseOrderId = (now: Date = new Date()): string => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `PO-${year}${month}${day}-${suffix}`;
};

/** Raised for input the database can store but the business rejects. */
export class PurchaseOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseOrderValidationError';
  }
}

export interface PurchaseOrderLineInput {
  medicine_id?: string | number | null;
  medicine_name?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
}

export interface PurchaseOrderLine {
  medicine_id: string | null;
  medicine_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

/**
 * Normalises the raw request line items: quantity is a positive integer,
 * unit price is money, and `total` is always quantity * unit price.
 */
export const normalizePurchaseOrderLines = (
  items: PurchaseOrderLineInput[]
): PurchaseOrderLine[] =>
  items.map((item) => {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity ?? 1)) || 1);
    const unitPrice = roundMoney(Number(item.unit_price ?? 0) || 0);
    return {
      medicine_id:
        item.medicine_id === null || item.medicine_id === undefined || item.medicine_id === ''
          ? null
          : String(item.medicine_id),
      medicine_name: item.medicine_name ? String(item.medicine_name).trim() : '',
      quantity,
      unit_price: unitPrice,
      total: roundMoney(quantity * unitPrice),
    };
  });

/**
 * `purchase_order_items.medicine_name` is NOT NULL, but the client only
 * sends `medicine_id`. The name is therefore resolved from
 * `medicines_inventory`, which is also the authoritative source: an unknown
 * medicine id is rejected instead of silently creating a dangling line.
 */
export const resolvePurchaseOrderLines = async (
  conn: PoolConnection,
  lines: PurchaseOrderLine[]
): Promise<PurchaseOrderLine[]> => {
  const ids = [...new Set(lines.map((line) => line.medicine_id).filter((id): id is string => !!id))];

  const names = new Map<string, string>();
  if (ids.length > 0) {
    const [rows] = await conn.query(
      'SELECT id, medicine_name FROM medicines_inventory WHERE id IN (?)',
      [ids]
    );
    for (const row of rows as RowDataPacket[]) {
      names.set(String((row as any).id), String((row as any).medicine_name));
    }
  }

  return lines.map((line) => {
    if (!line.medicine_id) {
      if (!line.medicine_name) {
        throw new PurchaseOrderValidationError(
          'Each purchase order item needs a medicine_id or a medicine_name'
        );
      }
      return line;
    }
    const name = names.get(line.medicine_id);
    if (!name) {
      throw new PurchaseOrderValidationError(`Unknown medicine_id: ${line.medicine_id}`);
    }
    return { ...line, medicine_name: name };
  });
};

/** Sum of the line totals, rounded to the money scale of the column. */
export const sumLineTotals = (lines: PurchaseOrderLine[]): number =>
  roundMoney(lines.reduce((sum, line) => sum + line.total, 0));

export interface PurchaseOrderInsertInput {
  supplier_id: number | string;
  order_date: string;
  expected_delivery_date?: string | null;
  status?: string;
  hospital_id?: number | string | null;
  created_by?: number | string | null;
  total_amount?: number;
}

/**
 * Inserts a purchase order and returns the generated surrogate key and
 * business key.
 *
 * `purchase_orders.id` is BIGINT UNSIGNED AUTO_INCREMENT, so it is never
 * written by hand -- the driver supplied `insertId` is the key. The
 * `order_id` UNIQUE index is retried on collision so a same-day key clash
 * can never fail a legitimate request.
 */
export const insertPurchaseOrder = async (
  conn: PoolConnection,
  input: PurchaseOrderInsertInput
): Promise<{ id: number; order_id: string }> => {
  const status = normalizePurchaseOrderStatus(input.status ?? 'pending');
  const totalAmount = roundMoney(Number(input.total_amount ?? 0) || 0);
  const maxAttempts = 5;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const orderId = generatePurchaseOrderId();
    try {
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO purchase_orders
           (order_id, hospital_id, supplier_id, order_date, expected_delivery_date, status, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          input.hospital_id ?? null,
          input.supplier_id,
          input.order_date,
          input.expected_delivery_date ?? null,
          status,
          totalAmount,
          input.created_by ?? null,
        ]
      );
      return { id: result.insertId, order_id: orderId };
    } catch (error) {
      lastError = error;
      // Only a duplicate business key is retryable; anything else is fatal.
      if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY') throw error;
      console.warn(
        `[purchaseOrder] Duplicate order_id ${orderId} (attempt ${attempt + 1}/${maxAttempts}), regenerating`
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate a unique purchase order id');
};

/** Writes the normalised line items of a purchase order. */
export const insertPurchaseOrderItems = async (
  conn: PoolConnection,
  purchaseOrderId: number | string,
  lines: PurchaseOrderLine[]
): Promise<void> => {
  for (const line of lines) {
    await conn.query(
      `INSERT INTO purchase_order_items
         (purchase_order_id, medicine_id, medicine_name, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        purchaseOrderId,
        line.medicine_id,
        line.medicine_name,
        line.quantity,
        line.unit_price,
        line.total,
      ]
    );
  }
};

/* ------------------------------------------------------------------ *
 * Low stock -> purchase order job
 * ------------------------------------------------------------------ */

interface LowStockItem extends RowDataPacket {
  id: string;
  medicine_name: string;
  stock_level: number;
  low_stock_threshold: number;
  unit_price: string | number | null;
  supplier_id: number | null;
}

export interface InventoryJobContext {
  /** Tenant the generated purchase orders belong to. */
  hospitalId?: number | string | null;
  /** User the generated purchase orders are attributed to. */
  createdBy?: number | string | null;
}

/**
 * How many units to reorder for a low stock item: enough to lift the stock
 * back to twice its own reorder threshold (the same rule the client uses).
 */
export const reorderQuantityFor = (stock: number, threshold: number): number =>
  Math.max(threshold * 2 - stock, 1);

/**
 * Nightly job: finds inventory that dropped to (or below) its own reorder
 * threshold and raises one purchase order per supplier.
 *
 * The job runs from a cron worker that carries no tenant context, so
 * `hospital_id` is written as NULL and the missing scope is logged instead
 * of being faked with a hard coded id.
 */
export const checkStockAndCreatePurchaseOrders = async (
  context: InventoryJobContext = {}
): Promise<void> => {
  const hospitalId = toNullableId(context.hospitalId);
  const createdBy = toNullableId(context.createdBy);

  if (hospitalId === null) {
    console.warn(
      '[inventory] Low stock job has no hospital (tenant) context; purchase orders will be created with hospital_id = NULL'
    );
  }

  console.log('[inventory] Checking for low stock items...');

  try {
    // The real columns are `medicine_name` and `stock_level`; the old query
    // selected `mi.name` / `mi.quantity`, which never existed and made every
    // run fail with ER_BAD_FIELD_ERROR.
    const [lowStockItems] = await pool.query<LowStockItem[]>(
      `SELECT mi.id, mi.medicine_name, mi.stock_level, mi.low_stock_threshold, mi.unit_price, mi.supplier_id
         FROM medicines_inventory mi
        WHERE mi.low_stock_threshold > 0
          AND mi.stock_level <= mi.low_stock_threshold`,
      []
    );

    if (lowStockItems.length === 0) {
      console.log('[inventory] No low stock items found.');
      return;
    }

    console.log(`[inventory] Found ${lowStockItems.length} low stock items.`);

    const supplierOrders: Record<string, LowStockItem[]> = {};
    for (const item of lowStockItems) {
      if (!item.supplier_id) {
        console.warn(
          `[inventory] Item ${item.medicine_name} (id ${item.id}) is low on stock but has no supplier assigned; skipping`
        );
        continue;
      }
      const key = String(item.supplier_id);
      if (!supplierOrders[key]) supplierOrders[key] = [];
      supplierOrders[key].push(item);
    }

    for (const supplierId of Object.keys(supplierOrders)) {
      const items = supplierOrders[supplierId];
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const orderDate = new Date();
        const expectedDeliveryDate = new Date();
        expectedDeliveryDate.setDate(orderDate.getDate() + 7);

        const lines = normalizePurchaseOrderLines(
          items.map((item) => ({
            medicine_id: item.id,
            medicine_name: item.medicine_name,
            quantity: reorderQuantityFor(Number(item.stock_level), Number(item.low_stock_threshold)),
            unit_price: roundMoney(Number(item.unit_price ?? 0) || 0),
          }))
        );

        const { id: purchaseOrderId, order_id: orderId } = await insertPurchaseOrder(connection, {
          supplier_id: supplierId,
          order_date: orderDate.toISOString().slice(0, 10),
          expected_delivery_date: expectedDeliveryDate.toISOString().slice(0, 10),
          status: 'pending',
          hospital_id: hospitalId,
          created_by: createdBy,
          total_amount: sumLineTotals(lines),
        });

        await insertPurchaseOrderItems(connection, purchaseOrderId, lines);

        await connection.commit();
        console.log(
          `[inventory] Created purchase order ${orderId} (id ${purchaseOrderId}) for supplier ${supplierId} with ${lines.length} item(s)`
        );
      } catch (error) {
        await connection.rollback();
        console.error(
          `[inventory] Failed to create purchase order for supplier ${supplierId}:`,
          {
            message: (error as Error)?.message,
            code: (error as { code?: string })?.code,
            itemCount: items.length,
          }
        );
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    console.error('[inventory] Error checking stock and creating purchase orders:', {
      message: (error as Error)?.message,
      code: (error as { code?: string })?.code,
    });
  }
};
