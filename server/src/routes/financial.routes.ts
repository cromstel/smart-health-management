import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
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
  exportPdf,
  exportExcel,
} from '../controllers/financial.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/accounts', requirePermission('financial', 'view'), getAccounts);
router.get('/accounts/:id', requirePermission('financial', 'view'), getAccountById);
router.post('/accounts', requirePermission('financial', 'add'), createAccount);
router.put('/accounts/:id', requirePermission('financial', 'edit'), updateAccount);
router.delete('/accounts/:id', requirePermission('financial', 'delete'), deleteAccount);
router.get('/transactions', requirePermission('financial', 'view'), getTransactions);
router.get('/transactions/:id', requirePermission('financial', 'view'), getTransactionById);
router.post('/transactions', requirePermission('financial', 'add'), createTransaction);
router.put('/transactions/:id', requirePermission('financial', 'edit'), updateTransaction);
router.delete('/transactions/:id', requirePermission('financial', 'delete'), deleteTransaction);
router.get('/reports', requirePermission('financial', 'view'), generateReport);
router.get('/reports/pdf', requirePermission('financial', 'view'), exportPdf);
router.get('/reports/excel', requirePermission('financial', 'view'), exportExcel);
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