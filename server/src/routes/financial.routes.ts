import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
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
router.get('/accounts/:id', requirePermission('financial', 'view'), [param('id').isInt(), validate], getAccountById);
router.post('/accounts', requirePermission('financial', 'add'), [
  body('accountName').notEmpty().withMessage('Account name is required'),
  body('accountType').isIn(['asset', 'liability', 'income', 'expense']).withMessage('Valid account type is required'),
  body('parentAccountId').optional().isInt().withMessage('Parent account ID must be an integer'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
  validate,
], createAccount);
router.put('/accounts/:id', requirePermission('financial', 'edit'), [
  param('id').isInt().withMessage('Invalid account ID'),
  body('name').optional().notEmpty().withMessage('Account name cannot be empty'),
  body('type').optional().isIn(['asset', 'liability', 'income', 'expense']).withMessage('Valid account type is required'),
  body('parent_id').optional().isInt().withMessage('Parent account ID must be an integer'),
  body('level').optional().isInt({ min: 0 }).withMessage('Level must be a non-negative integer'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
  validate,
], updateAccount);
router.delete('/accounts/:id', requirePermission('financial', 'delete'), [param('id').isInt(), validate], deleteAccount);
router.get('/transactions', requirePermission('financial', 'view'), getTransactions);
router.get('/transactions/:id', requirePermission('financial', 'view'), [param('id').isInt(), validate], getTransactionById);
router.post('/transactions', requirePermission('financial', 'add'), [
  body('accountId').isInt().withMessage('Account ID is required'),
  body('transactionDate').isDate().withMessage('Valid date is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('debit').optional().isNumeric().withMessage('Debit must be a number'),
  body('credit').optional().isNumeric().withMessage('Credit must be a number'),
  body('reference').optional().isString().withMessage('Reference must be a string'),
  validate,
], createTransaction);
router.put('/transactions/:id', requirePermission('financial', 'edit'), [
  param('id').isInt().withMessage('Invalid transaction ID'),
  body('date').optional().isDate().withMessage('Valid date is required'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('debit').optional().isNumeric().withMessage('Debit must be a number'),
  body('credit').optional().isNumeric().withMessage('Credit must be a number'),
  body('reference').optional().isString().withMessage('Reference must be a string'),
  validate,
], updateTransaction);
router.delete('/transactions/:id', requirePermission('financial', 'delete'), [param('id').isInt(), validate], deleteTransaction);
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