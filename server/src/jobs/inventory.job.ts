import cron from 'node-cron';
import { checkStockAndCreatePurchaseOrders } from '../services/inventory.service.js';

// Schedule to run every day at midnight
cron.schedule('0 0 * * *', () => {
    console.log('Running daily inventory check...');
    checkStockAndCreatePurchaseOrders();
});

console.log('Inventory check job scheduled.');