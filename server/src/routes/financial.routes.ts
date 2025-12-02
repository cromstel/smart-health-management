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
  createPaymentIntentEndpoint,
  confirmPaymentIntentEndpoint,
  createSetupIntentEndpoint,
  attachPaymentMethodEndpoint,
  listPaymentMethodsEndpoint,
  detachPaymentMethodEndpoint,
  createRefundEndpoint,
  getPaymentIntentEndpoint,
  getCustomerEndpoint,
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
// Stripe - Legacy API (deprecated)
router.post('/customers', requirePermission('financial', 'add'), createCustomer);
router.post('/charges', requirePermission('financial', 'add'), createCharge);

// Stripe - Modern PaymentIntents API
router.post('/payment-intents', requirePermission('financial', 'add'), createPaymentIntentEndpoint);
router.post('/payment-intents/confirm', requirePermission('financial', 'add'), confirmPaymentIntentEndpoint);
router.get('/payment-intents/:paymentIntentId', requirePermission('financial', 'view'), getPaymentIntentEndpoint);

// Setup Intents for saving payment methods
router.post('/setup-intents', requirePermission('financial', 'add'), createSetupIntentEndpoint);
router.post('/payment-methods/attach', requirePermission('financial', 'add'), attachPaymentMethodEndpoint);
router.get('/customers/:customerId/payment-methods', requirePermission('financial', 'view'), listPaymentMethodsEndpoint);
router.delete('/payment-methods/:paymentMethodId', requirePermission('financial', 'edit'), detachPaymentMethodEndpoint);

// Customers
router.get('/customers/:customerId', requirePermission('financial', 'view'), getCustomerEndpoint);

// Refunds
router.post('/refunds', requirePermission('financial', 'add'), createRefundEndpoint);

export default router;
