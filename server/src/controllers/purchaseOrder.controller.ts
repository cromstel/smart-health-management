import type { Response } from 'express';
import pool from '../config/database.js';
import type { PoolConnection } from 'mysql2/promise';
import type { AuthRequest } from '../middleware/auth.js';
import {
  PURCHASE_ORDER_UPDATE_FIELDS,
  PurchaseOrderValidationError,
  insertPurchaseOrder,
  insertPurchaseOrderItems,
  isPurchaseOrderStatus,
  normalizePurchaseOrderLines,
  normalizePurchaseOrderStatus,
  resolvePurchaseOrderLines,
  sumLineTotals,
  toNullableId,
} from '../services/inventory.service.js';

/**
 * Workflow transitions accepted by `purchase_orders.status`.
 * pending -> ordered -> shipped -> delivered, with cancellation allowed
 * while the order is still in flight.
 */
const allowedTransitions: Record<string, string[]> = {
  pending: ['ordered'],
  ordered: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/**
 * Rolls the transaction back without ever masking the original error: a
 * rollback on an already closed transaction must not replace the real cause.
 */
const rollbackQuietly = async (connection: PoolConnection | null): Promise<void> => {
  if (!connection) return;
  try {
    await connection.rollback();
  } catch {
    /* the transaction was already closed */
  }
};

/** Get all purchase orders */
export const getPurchaseOrders = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // The orders are a hospital's orders. The list used to answer with the
    // orders of every hospital in the installation.
    const scope = req.tenant;
    let query = 'SELECT * FROM purchase_orders WHERE 1=1';
    const params: any[] = [];
    if (!scope?.platformWide) {
      query += ' AND hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [orders] = await pool.query(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
};

/** Get purchase order by ID */
export const getPurchaseOrderById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    // An order that belongs to another hospital is not found for this
    // caller, rather than forbidden: the answer should not say that it
    // exists somewhere else.
    const scope = req.tenant;
    const params: any[] = [id];
    let predicate = '';
    if (!scope?.platformWide) {
      predicate = ' AND hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }
    const [orders] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?${predicate}`, params);
    const order = (orders as any[])[0];

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const [items] = await pool.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id ASC',
      [id]
    );
    order.items = items;

    res.json(order);
  } catch (error) {
    console.error('Get purchase order by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
};

/**
 * Create a new purchase order.
 *
 * `purchase_orders.id` is BIGINT UNSIGNED AUTO_INCREMENT, so it is never
 * written by hand -- the generated `order_id` business key is supplied
 * instead and the driver supplied `insertId` is used as the surrogate key
 * for the line items.
 */
export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  let connection: PoolConnection | null = null;
  let transactionSettled = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { supplier_id, order_date, expected_delivery_date, items } = req.body ?? {};

    // Tenant scope comes from the authenticated session, never from the body.
    const hospitalId = toNullableId(req.user?.hospital_id);
    if (hospitalId === null) {
      console.warn(
        '[purchaseOrder] Authenticated user has no hospital scope; purchase order will be created with hospital_id = NULL'
      );
    }
    const createdBy = toNullableId(req.user?.id);

    const lines = await resolvePurchaseOrderLines(
      connection,
      normalizePurchaseOrderLines(Array.isArray(items) ? items : [])
    );
    const totalAmount = sumLineTotals(lines);

    const { id, order_id } = await insertPurchaseOrder(connection, {
      supplier_id,
      order_date,
      expected_delivery_date: expected_delivery_date ?? null,
      status: 'pending',
      hospital_id: hospitalId,
      created_by: createdBy,
      total_amount: totalAmount,
    });

    await insertPurchaseOrderItems(connection, id, lines);

    await connection.commit();
    transactionSettled = true;

    res.status(201).json({
      message: 'Purchase order created successfully',
      id,
      order_id,
      total_amount: totalAmount,
      item_count: lines.length,
    });
  } catch (error) {
    if (connection && !transactionSettled) {
      await rollbackQuietly(connection);
    }
    if (error instanceof PurchaseOrderValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Create purchase order error:', {
      message: (error as Error)?.message,
      code: (error as { code?: string })?.code,
    });
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    connection?.release();
  }
};

/**
 * Update a purchase order.
 *
 * Only the columns in `PURCHASE_ORDER_UPDATE_FIELDS` may be written: the
 * request body is never used to build the SET clause directly, otherwise any
 * key a client sends becomes a column name.
 */
export const updatePurchaseOrder = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  let connection: PoolConnection | null = null;
  let transactionSettled = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { id } = req.params;
    const orderId = String(id);
    const body = (req.body ?? {}) as Record<string, any>;

    const allowedFields = PURCHASE_ORDER_UPDATE_FIELDS.filter(
      (field) => body[field] !== undefined && body[field] !== null
    );
    if (allowedFields.length > 0) {
      const fields = allowedFields.map((field) => `${field} = ?`).join(', ');
      const values = allowedFields.map((field) => body[field]);
      await connection.query(`UPDATE purchase_orders SET ${fields} WHERE id = ?`, [...values, id]);
    }

    const rawStatus = body.status;
    let status: string | null = null;
    if (rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== '') {
      status = normalizePurchaseOrderStatus(rawStatus);
      if (!isPurchaseOrderStatus(status)) {
        await rollbackQuietly(connection);
        transactionSettled = true;
        return res.status(400).json({ error: `Invalid status: ${rawStatus}` });
      }
    }

    if (status) {
      // The row is read with a lock, so that two requests cannot both read
      // the same current status and both decide the transition is allowed.
      // The order would then be delivered twice, and the stock credited
      // twice.
      const [orders] = await connection.query(
        'SELECT status FROM purchase_orders WHERE id = ? FOR UPDATE',
        [id]
      );
      const current = String((orders as any[])[0]?.status || '').toLowerCase();
      const ok = allowedTransitions[current]?.includes(status);
      if (!ok) {
        await rollbackQuietly(connection);
        transactionSettled = true;
        return res.status(400).json({ error: `Invalid transition from ${current} to ${status}` });
      }

      await connection.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, id]);

      if (status === 'delivered') {
        // Receiving the order raises the stock of every line.
        const [orderItems] = await connection.query(
          'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
          [id]
        );
        for (const item of orderItems as any[]) {
          if (!item?.medicine_id) continue;
          await connection.query(
            'UPDATE medicines_inventory SET stock_level = stock_level + ? WHERE id = ?',
            [item.quantity, item.medicine_id]
          );
        }
      }
    }

    if (Array.isArray(body.items)) {
      // For simplicity, existing items are replaced by the submitted set.
      const lines = await resolvePurchaseOrderLines(
        connection,
        normalizePurchaseOrderLines(body.items)
      );
      await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
      await insertPurchaseOrderItems(connection, orderId, lines);
      await connection.query('UPDATE purchase_orders SET total_amount = ? WHERE id = ?', [
        sumLineTotals(lines),
        id,
      ]);
    }

    await connection.commit();
    transactionSettled = true;
    res.json({ message: 'Purchase order updated successfully' });
  } catch (error) {
    if (connection && !transactionSettled) {
      await rollbackQuietly(connection);
    }
    if (error instanceof PurchaseOrderValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Update purchase order error:', {
      message: (error as Error)?.message,
      code: (error as { code?: string })?.code,
    });
    res.status(500).json({ error: 'Failed to update purchase order' });
  } finally {
    connection?.release();
  }
};

/** Delete a purchase order */
export const deletePurchaseOrder = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  let connection: PoolConnection | null = null;
  let transactionSettled = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const { id } = req.params;
    await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
    await connection.query('DELETE FROM purchase_orders WHERE id = ?', [id]);
    await connection.commit();
    transactionSettled = true;
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    if (connection && !transactionSettled) {
      await rollbackQuietly(connection);
    }
    console.error('Delete purchase order error:', {
      message: (error as Error)?.message,
      code: (error as { code?: string })?.code,
    });
    res.status(500).json({ error: 'Failed to delete purchase order' });
  } finally {
    connection?.release();
  }
};
