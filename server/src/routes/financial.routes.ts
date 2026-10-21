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
router.post('/invoices', requirePermission('financial', 'add'), [
  body('patientId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Patient ID must be an integer'),
  body('dueDate').optional({ nullable: true }).isDate().withMessage('Valid due date is required'),
  body('items').isArray({ min: 1, max: 200 }).withMessage('An invoice needs at least one line and at most 200'),
  body('items.*.description').isString().isLength({ min: 1, max: 255 }).withMessage('Each line needs a description'),
  body('items.*.qty').isFloat({ min: 0 }).withMessage('Each line needs a quantity of zero or more'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Each line needs a price of zero or more'),
  body('items.*.taxRate').optional().isFloat({ min: 0 }).withMessage('A tax rate cannot be negative'),
  validate,
], createInvoice);
router.post('/invoices/:id/finalize', requirePermission('financial', 'edit'), [
  param('id').isInt().withMessage('Invalid invoice ID'),
  validate,
], finalizeInvoice);
// Payments
router.post('/payments', requirePermission('financial', 'add'), [
  body('invoiceId').isInt({ min: 1 }).withMessage('Invoice ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be zero or more'),
  body('method').optional().isString().withMessage('Method must be a string'),
  body('reference').optional().isString().withMessage('Reference must be a string'),
  validate,
], recordPayment);
// Expenses
router.post('/expenses', requirePermission('financial', 'add'), [
  body('category').notEmpty().withMessage('Category is required'),
  body('vendor').optional({ nullable: true }).isString().withMessage('Vendor must be a string'),
  body('date').isDate().withMessage('Valid date is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be zero or more'),
  body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
  validate,
], createExpense);
// Payroll
router.post('/payroll', requirePermission('financial', 'add'), [
  body('staffId').isInt({ min: 1 }).withMessage('Staff ID is required'),
  body('periodStart').isDate().withMessage('Valid start date is required'),
  body('periodEnd').isDate().withMessage('Valid end date is required'),
  body('gross').isFloat({ min: 0 }).withMessage('Gross pay must be zero or more'),
  body('deductions').optional().isFloat({ min: 0 }).withMessage('Deductions cannot be negative'),
  validate,
], createPayroll);
// Tax
router.post('/tax-rules', requirePermission('financial', 'add'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('rate').isFloat({ min: 0 }).withMessage('Rate must be zero or more'),
  body('appliesTo').notEmpty().withMessage('Applies to is required'),
  body('effectiveFrom').isDate().withMessage('Valid effective-from date is required'),
  body('effectiveTo').optional({ nullable: true }).isDate().withMessage('Valid effective-to date is required'),
  validate,
], createTaxRule);
router.post('/tax/calculate', requirePermission('financial', 'view'), [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be zero or more'),
  validate,
], calculateTax);
// Forecasting
router.get('/forecast', requirePermission('financial', 'view'), forecast);
// Exports
// Stripe
router.post('/customers', requirePermission('financial', 'add'), [
  body('email').isEmail().withMessage('A valid email is required'),
  body('name').optional().isString().withMessage('Name must be a string'),
  validate,
], createCustomer);
router.post('/charges', requirePermission('financial', 'add'), [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be zero or more'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('customerId').optional().isString().withMessage('Customer ID must be a string'),
  validate,
], createCharge);

export default router;