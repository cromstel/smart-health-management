import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

// Get all purchase orders
export const getPurchaseOrders = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [orders] = await pool.query('SELECT * FROM purchase_orders');
    res.json(orders);
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
};

// Get purchase order by ID
export const getPurchaseOrderById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [orders] = await pool.query('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    const order = (orders as any[])[0];

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const [items] = await pool.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
    order.items = items;

    res.json(order);
  } catch (error) {
    console.error('Get purchase order by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
};

// Create a new purchase order
export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { supplier_id, order_date, expected_delivery_date, items } = req.body;
    const id = uuidv4();
    const hospital_id = req.user?.hospital_id;
    const status = 'Pending';

    await connection.query(
      'INSERT INTO purchase_orders (id, hospital_id, supplier_id, order_date, expected_delivery_date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, hospital_id, supplier_id, order_date, expected_delivery_date, status]
    );

    if (items && items.length > 0) {
      const itemPromises = items.map((item: any) => {
        const item_id = uuidv4();
        return connection.query(
          'INSERT INTO purchase_order_items (id, purchase_order_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
          [item_id, id, item.medicine_id, item.quantity, item.unit_price]
        );
      });
      await Promise.all(itemPromises);
    }

    await connection.commit();
    res.status(201).json({ message: 'Purchase order created successfully', id });
  } catch (error) {
    await connection.rollback();
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    connection.release();
  }
};

// Update a purchase order
const normalizeStatus = (s: string): string => {
    const val = String(s || '').toLowerCase()
    // Map new workflow to existing DB enum
    if (val === 'draft') return 'pending'
    if (val === 'submitted') return 'ordered'
    if (val === 'approved') return 'shipped'
    if (val === 'fulfilled' || val === 'completed') return 'delivered'
    return s
}

const allowedTransitions: Record<string, string[]> = {
    pending: ['ordered'],
    ordered: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
}

export const updatePurchaseOrder = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        let status = req.body.status;
        const updates = { ...req.body };
        delete updates.status;
        const items = req.body.items;
        if (status) status = normalizeStatus(status);

        if (Object.keys(updates).length > 0) {
            const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(updates), id];
            await connection.query(`UPDATE purchase_orders SET ${fields} WHERE id = ?`, values);
        }

        if (status) {
            // Validate transition
            const [orders] = await connection.query('SELECT status FROM purchase_orders WHERE id = ?', [id]);
            const current = ((orders as any[])[0]?.status || '').toLowerCase();
            const next = String(status).toLowerCase();
            const ok = allowedTransitions[current]?.includes(next);
            if (!ok) {
                await connection.rollback();
                res.status(400).json({ error: `Invalid transition from ${current} to ${next}` });
                return;
            }
            await connection.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, id]);
            if (next === 'delivered') {
                // When purchase order is completed, update the inventory
                const [orderItems] = await connection.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [id]);

                const inventoryUpdates = (orderItems as any[]).map(item => {
                    return connection.query(
                        'UPDATE medicines_inventory SET stock_level = stock_level + ? WHERE id = ?',
                        [item.quantity, item.medicine_id]
                    );
                });
                await Promise.all(inventoryUpdates);
            }
        }
        
        if (items) {
            // For simplicity, we'll delete existing items and add new ones.
            // A more robust implementation would diff the changes.
            await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
            const itemPromises = items.map((item: any) => {
                const item_id = uuidv4();
                return connection.query(
                  'INSERT INTO purchase_order_items (id, purchase_order_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                  [item_id, id, item.medicine_id, item.quantity, item.unit_price]
                );
            });
            await Promise.all(itemPromises);
        }

        await connection.commit();
        res.json({ message: 'Purchase order updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Update purchase order error:', error);
        res.status(500).json({ error: 'Failed to update purchase order' });
    } finally {
        connection.release();
    }
};


// Delete a purchase order
export const deletePurchaseOrder = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        await connection.query('DELETE FROM purchase_orders WHERE id = ?', [id]);
        await connection.commit();
        res.json({ message: 'Purchase order deleted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Delete purchase order error:', error);
        res.status(500).json({ error: 'Failed to delete purchase order' });
    } finally {
        connection.release();
    }
};