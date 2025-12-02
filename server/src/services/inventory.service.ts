import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';

const REORDER_THRESHOLD = 10; // Reorder when stock falls below 10 units

interface LowStockItem extends RowDataPacket {
    id: string;
    name: string;
    quantity: number;
    supplier_id: string;
}

export const checkStockAndCreatePurchaseOrders = async (): Promise<void> => {
    console.log('Checking for low stock items...');
    try {
        const [lowStockItems] = await pool.query<LowStockItem[]>(
            `SELECT mi.id, mi.name, mi.quantity, mi.supplier_id 
             FROM medicines_inventory mi
             WHERE mi.quantity < ?`,
            [REORDER_THRESHOLD]
        );

        if (lowStockItems.length === 0) {
            console.log('No low stock items found.');
            return;
        }

        console.log(`Found ${lowStockItems.length} low stock items.`);

        // Group items by supplier
        const supplierOrders: { [key: string]: LowStockItem[] } = {};
        for (const item of lowStockItems) {
            if (!item.supplier_id) {
                console.warn(`Item ${item.name} (ID: ${item.id}) is low on stock but has no supplier assigned.`);
                continue;
            }
            if (!supplierOrders[item.supplier_id]) {
                supplierOrders[item.supplier_id] = [];
            }
            supplierOrders[item.supplier_id].push(item);
        }

        // Create purchase orders for each supplier
        for (const supplierId in supplierOrders) {
            const items = supplierOrders[supplierId];
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const poId = uuidv4();
                const order_date = new Date();
                const expected_delivery_date = new Date();
                expected_delivery_date.setDate(order_date.getDate() + 7); // Assume 7 days for delivery

                // Assuming hospital_id is 1 for now, this should be dynamic in a multi-tenant app
                const hospital_id = 'your-hospital-id'; 

                await connection.query(
                    'INSERT INTO purchase_orders (id, hospital_id, supplier_id, order_date, expected_delivery_date, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [poId, hospital_id, supplierId, order_date, expected_delivery_date, 'Pending']
                );

                const orderItems = items.map(item => {
                    const poItemId = uuidv4();
                    const quantityToOrder = 50; // Default reorder quantity
                    const unitPrice = 10; // This should come from a price list or the item itself
                    return connection.query(
                        'INSERT INTO purchase_order_items (id, purchase_order_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                        [poItemId, poId, item.id, quantityToOrder, unitPrice]
                    );
                });

                await Promise.all(orderItems);
                await connection.commit();
                console.log(`Created purchase order ${poId} for supplier ${supplierId}`);

            } catch (error) {
                await connection.rollback();
                console.error(`Failed to create purchase order for supplier ${supplierId}:`, error);
            } finally {
                connection.release();
            }
        }
    } catch (error) {
        console.error('Error checking stock and creating purchase orders:', error);
    }
};