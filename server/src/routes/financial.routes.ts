import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import {
  getAccounts,
  createAccount,
  getTransactions,
  getTransactionById,
  createTransaction,
  generateReport,
  createInvoice,
  finalizeInvoice,
  recordPayment,
  createExpense,
  createPayroll,
  createTaxRule,
  calculateTax,
  forecast,
  createCustomer,
  createCharge,
} from '../controllers/financial.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/accounts', requirePermission('financial', 'view'), getAccounts);
router.post('/accounts', requirePermission('financial', 'add'), createAccount);
router.get('/transactions', requirePermission('financial', 'view'), getTransactions);
router.get('/transactions/:id', requirePermission('financial', 'view'), getTransactionById);
router.post('/transactions', requirePermission('financial', 'add'), createTransaction);
router.get('/reports', requirePermission('financial', 'view'), generateReport);
// Billing & Invoices
router.post('/invoices', requirePermission('financial', 'add'), createInvoice);
router.post('/invoices/:id/finalize', requirePermission('financial', 'edit'), finalizeInvoice);
// Payments
router.post('/payments', requirePermission('financial', 'add'), recordPayment);
// Expenses
router.post('/expenses', requirePermission('financial', 'add'), createExpense);
// Payroll
router.post('/payroll', requirePermission('financial', 'add'), createPayroll);
// Tax
router.post('/tax-rules', requirePermission('financial', 'add'), createTaxRule);
router.post('/tax/calculate', requirePermission('financial', 'view'), calculateTax);
// Forecasting
router.get('/forecast', requirePermission('financial', 'view'), forecast);
// Exports
// Stripe
router.post('/customers', requirePermission('financial', 'add'), createCustomer);
router.post('/charges', requirePermission('financial', 'add'), createCharge);

export default router;