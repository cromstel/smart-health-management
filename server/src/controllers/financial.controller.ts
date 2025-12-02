import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import {
  createStripeCustomer,
  createStripeCharge,
  createPaymentIntent,
  confirmPaymentIntent,
  createSetupIntent,
  attachPaymentMethodToCustomer,
  listCustomerPaymentMethods,
  detachPaymentMethod,
  createRefund,
  retrievePaymentIntent,
  retrieveCustomer
} from '../services/stripe.service.js';

const logAudit = async (userId: any, action: string, module: string, recordId: any, newValue?: any, oldValue?: any) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId || null, action, module, recordId || null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, null, null]
    );
  } catch (_error) { /* Audit logging errors are intentionally ignored */ }
};
import type { AuthRequest } from '../middleware/auth.js';

// Chart of Accounts
export const getAccounts = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [accounts] = await pool.query('SELECT * FROM accounts ORDER BY account_code');
    res.json(accounts);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

export const getAccountById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [accounts] = await pool.query('SELECT * FROM accounts WHERE id = ?', [id]);
    const account = (accounts as any[])[0];
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { accountName, accountType, parentAccountId, balance } = req.body;
    let level = 0;
    if (parentAccountId) {
      const [rows] = await pool.query('SELECT level FROM accounts WHERE id = ?', [parentAccountId]);
      const parent = (rows as any[])[0];
      level = parent ? (parent.level || 0) + 1 : 0;
    }
    const accountCode = `ACC-${uuidv4().slice(0, 8)}`;
  await pool.query(
      'INSERT INTO accounts (account_code, name, type, parent_id, level, balance) VALUES (?, ?, ?, ?, ?, ?)',
      [accountCode, accountName, accountType, parentAccountId || null, level, balance ?? 0]
    );
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', accountCode, { accountName, accountType, parentAccountId, balance });
    res.status(201).json({ message: 'Account created successfully', account_code: accountCode });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to create account' });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];
  await pool.query(`UPDATE accounts SET ${fields} WHERE id = ?`, values);
    await logAudit((req.user as any)?.id, 'UPDATE', 'financial', id, updates);
    res.json({ message: 'Account updated successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to update account' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
  await pool.query('DELETE FROM accounts WHERE id = ?', [id]);
    await logAudit((req.user as any)?.id, 'DELETE', 'financial', id);
    res.json({ message: 'Account deleted successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

// Transactions
export const getTransactions = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { accountId, startDate, endDate } = req.query as any;
    let query = `
      SELECT t.*, a.name AS account_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (accountId) {
      query += ' AND t.account_id = ?';
      params.push(accountId);
    }
    if (startDate) {
      query += ' AND t.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND t.date <= ?';
      params.push(endDate);
    }
    const [transactions] = await pool.query(query, params);
    res.json(transactions);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const getTransactionById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [transactions] = await pool.query(
      `SELECT t.*, a.name AS account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.id = ?`,
      [id]
    );
    const transaction = (transactions as any[])[0];
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
};

export const createTransaction = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { accountId, transactionDate, description, debit, credit, reference } = req.body;
    const transactionId = `TRN-${uuidv4().slice(0, 8)}`;
  await pool.query(
      'INSERT INTO transactions (transaction_id, account_id, date, description, debit, credit, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [transactionId, accountId, transactionDate, description, debit ?? 0, credit ?? 0, reference || null, (req.user as any)?.id || null]
    );
    // Update running balance for account
    await pool.query(
      'UPDATE accounts SET balance = balance + ? - ? WHERE id = ?',
      [debit ?? 0, credit ?? 0, accountId]
    );
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', transactionId, { accountId, transactionDate, description, debit, credit, reference });
    res.status(201).json({ message: 'Transaction created successfully', transaction_id: transactionId });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

export const updateTransaction = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];
    await pool.query(`UPDATE transactions SET ${fields} WHERE id = ?`, values);
    res.json({ message: 'Transaction updated successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
};

export const deleteTransaction = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM transactions WHERE id = ?', [id]);
    res.json({ message: 'Transaction deleted successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};

// Financial Reports
export const generateReport = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { reportType, startDate, endDate } = req.query as any;
    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Report type, start date, and end date are required' });
    }
    switch (reportType) {
      case 'income_statement': {
        const [incomeRows] = await pool.query(
          'SELECT name, SUM(credit - debit) AS amount FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.type = "income" AND t.date BETWEEN ? AND ? GROUP BY a.id, a.name',
          [startDate, endDate]
        );
        const [expenseRows] = await pool.query(
          'SELECT name, SUM(debit - credit) AS amount FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.type = "expense" AND t.date BETWEEN ? AND ? GROUP BY a.id, a.name',
          [startDate, endDate]
        );
        const totalIncome = (incomeRows as any[]).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const totalExpenses = (expenseRows as any[]).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const netProfit = totalIncome - totalExpenses;
        return res.json({ title: 'Income Statement', period: { startDate, endDate }, income: incomeRows, expenses: expenseRows, totals: { totalIncome, totalExpenses, netProfit } });
      }
      case 'balance_sheet': {
        const [assetRows] = await pool.query('SELECT name, balance FROM accounts WHERE type = "asset"');
        const [liabilityRows] = await pool.query('SELECT name, balance FROM accounts WHERE type = "liability"');
        const totalAssets = (assetRows as any[]).reduce((s, r) => s + (Number(r.balance) || 0), 0);
        const totalLiabilities = (liabilityRows as any[]).reduce((s, r) => s + (Number(r.balance) || 0), 0);
        return res.json({ title: 'Balance Sheet', totals: { totalAssets, totalLiabilities }, assets: assetRows, liabilities: liabilityRows });
      }
      case 'cash_flow': {
        const [rows] = await pool.query(
          'SELECT date, SUM(credit - debit) AS net_flow FROM transactions WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date',
          [startDate, endDate]
        );
        return res.json({ title: 'Cash Flow', period: { startDate, endDate }, daily: rows });
      }
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
  } catch (_error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// Billing & Invoices
export const createInvoice = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patientId, items, dueDate } = req.body;
    const invoiceId = `INV-${uuidv4().slice(0, 8)}`;
    const [result] = await pool.query(
      'INSERT INTO invoices (invoice_id, patient_id, date, due_date, status, total_amount, created_by) VALUES (?, ?, CURDATE(), ?, "draft", 0, ?)',
      [invoiceId, patientId || null, dueDate || null, (req.user as any)?.id || null]
    );
    const insertId = (result as any).insertId;
    let total = 0;
    for (const item of items || []) {
      const lineTotal = Number(item.qty) * Number(item.unitPrice);
      total += lineTotal;
      await pool.query(
        'INSERT INTO invoice_items (invoice_id, description, qty, unit_price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?)',
        [insertId, item.description, item.qty, item.unitPrice, item.taxRate ?? 0, lineTotal]
      );
    }
    await pool.query('UPDATE invoices SET total_amount = ? WHERE id = ?', [total, insertId]);
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', insertId, { invoiceId, patientId, items });
    res.status(201).json({ message: 'Invoice created', invoice_id: invoiceId, id: insertId });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const finalizeInvoice = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
  await pool.query('UPDATE invoices SET status = "finalized" WHERE id = ?', [id]);
    const [[invoice]]: any = await pool.query('SELECT total_amount FROM invoices WHERE id = ?', [id]);
    const amount = Number(invoice?.total_amount || 0);
    if (amount > 0) {
      const [[incomeAccount]]: any = await pool.query('SELECT id FROM accounts WHERE type = "income" LIMIT 1');
      const accountId = incomeAccount?.id;
      if (accountId) {
        const trnId = `TRN-${uuidv4().slice(0, 8)}`;
        await pool.query(
          'INSERT INTO transactions (transaction_id, account_id, date, description, debit, credit, reference, created_by) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)',
          [trnId, accountId, 'Invoice finalized', 0, amount, `INV:${id}`, (req.user as any)?.id || null]
        );
        await pool.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [0, accountId]);
      }
    }
    res.json({ message: 'Invoice finalized' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to finalize invoice' });
  }
};

// Payments
export const recordPayment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { invoiceId, amount, method, reference } = req.body;
    const paymentId = `PAY-${uuidv4().slice(0, 8)}`;
  await pool.query(
      'INSERT INTO payments (payment_id, invoice_id, amount, method, date, reference, created_by) VALUES (?, ?, ?, ?, CURDATE(), ?, ?)',
      [paymentId, invoiceId, amount, method || 'other', reference || null, (req.user as any)?.id || null]
    );
    await pool.query('UPDATE invoices SET status = "paid" WHERE id = ?', [invoiceId]);
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', paymentId, { invoiceId, amount, method });
    const [[incomeAccount]]: any = await pool.query('SELECT id FROM accounts WHERE type = "income" LIMIT 1');
    const accountId = incomeAccount?.id;
    if (accountId) {
      const trnId = `TRN-${uuidv4().slice(0, 8)}`;
      await pool.query(
        'INSERT INTO transactions (transaction_id, account_id, date, description, debit, credit, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [trnId, accountId, 'Payment received', 0, amount, `PAY:${paymentId}`, (req.user as any)?.id || null]
      );
      await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, accountId]);
    }
    res.status(201).json({ message: 'Payment recorded', payment_id: paymentId });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

// Expenses
export const createExpense = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { category, vendor, date, amount, description } = req.body;
    const expenseId = `EXP-${uuidv4().slice(0, 8)}`;
  await pool.query(
      'INSERT INTO expenses (expense_id, category, vendor, date, amount, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [expenseId, category, vendor || null, date, amount, description || null, (req.user as any)?.id || null]
    );
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', expenseId, { category, vendor, date, amount });
    const [[expenseAccount]]: any = await pool.query('SELECT id FROM accounts WHERE type = "expense" LIMIT 1');
    const accountId = expenseAccount?.id;
    if (accountId) {
      const trnId = `TRN-${uuidv4().slice(0, 8)}`;
      await pool.query(
        'INSERT INTO transactions (transaction_id, account_id, date, description, debit, credit, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [trnId, accountId, date, description || 'Expense', amount, 0, `EXP:${expenseId}`, (req.user as any)?.id || null]
      );
      await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, accountId]);
    }
    res.status(201).json({ message: 'Expense created', expense_id: expenseId });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

// Payroll
export const createPayroll = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { staffId, periodStart, periodEnd, gross, deductions } = req.body;
    const payrollId = `PAYR-${uuidv4().slice(0, 8)}`;
    const net = Number(gross) - Number(deductions || 0);
  await pool.query(
      'INSERT INTO payroll (payroll_id, staff_id, period_start, period_end, gross_amount, deductions, net_amount, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, "processed", ?)',
      [payrollId, staffId, periodStart, periodEnd, gross, deductions ?? 0, net, (req.user as any)?.id || null]
    );
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', payrollId, { staffId, periodStart, periodEnd, gross, net });
    const [[expenseAccount]]: any = await pool.query('SELECT id FROM accounts WHERE type = "expense" LIMIT 1');
    const accountId = expenseAccount?.id;
    if (accountId) {
      const trnId = `TRN-${uuidv4().slice(0, 8)}`;
      await pool.query(
        'INSERT INTO transactions (transaction_id, account_id, date, description, debit, credit, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [trnId, accountId, periodEnd, 'Payroll', net, 0, `PAYR:${payrollId}`, (req.user as any)?.id || null]
      );
      await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [net, accountId]);
    }
    res.status(201).json({ message: 'Payroll processed', payroll_id: payrollId, net_amount: net });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to process payroll' });
  }
};

// Tax
export const createTaxRule = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { name, rate, appliesTo, effectiveFrom, effectiveTo } = req.body;
  await pool.query(
      'INSERT INTO tax_rules (name, rate, applies_to, effective_from, effective_to) VALUES (?, ?, ?, ?, ?)',
      [name, rate, appliesTo, effectiveFrom, effectiveTo || null]
    );
    await logAudit((req.user as any)?.id, 'CREATE', 'financial', null, { name, rate, appliesTo });
    res.status(201).json({ message: 'Tax rule created' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to create tax rule' });
  }
};

export const calculateTax = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { amount, appliesTo, date } = req.body;
    const [rules] = await pool.query(
      'SELECT rate FROM tax_rules WHERE applies_to = ? AND (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)) ORDER BY effective_from DESC LIMIT 1',
      [appliesTo, date, date]
    );
    const rate = (rules as any[])[0]?.rate ?? 0;
    const tax = Number(amount) * Number(rate) / 100;
    res.json({ amount, rate, tax });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to calculate tax' });
  }
};

// Forecasting
export const forecast = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { metric, periods } = req.query as any;
    const count = Number(periods) || 3;
    let baseQuery = '';
    if (metric === 'income') baseQuery = 'SELECT DATE_FORMAT(date, "%Y-%m") AS period, SUM(credit - debit) AS value FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.type="income" GROUP BY period ORDER BY period DESC LIMIT 6';
    else if (metric === 'expense') baseQuery = 'SELECT DATE_FORMAT(date, "%Y-%m") AS period, SUM(debit - credit) AS value FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.type="expense" GROUP BY period ORDER BY period DESC LIMIT 6';
    else baseQuery = 'SELECT DATE_FORMAT(date, "%Y-%m") AS period, SUM(credit - debit) AS value FROM transactions GROUP BY period ORDER BY period DESC LIMIT 6';
    const [rows] = await pool.query(baseQuery);
    const values = (rows as any[]).map(r => Number(r.value) || 0).reverse();

    // Calculate simple moving average (SMA) with a window of 3
    const smaWindow = 3;
    const smaValues = values.map((value, index) => {
      if (index < smaWindow - 1) return value; // Not enough data for SMA
      let sum = 0;
      for (let i = 0; i < smaWindow; i++) {
        sum += values[index - i];
      }
      return sum / smaWindow;
    });

    const lastSma = smaValues.length > 0 ? smaValues[smaValues.length - 1] : 0;
    const predictions = Array.from({ length: count }, (_, i) => ({ periodOffset: i + 1, predicted: lastSma }));
    res.json({ metric, predictions });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to forecast' });
  }
};

export const createCustomer = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { email, name } = req.body;
    const customerId = await createStripeCustomer(email, name);
    res.status(201).json({ customerId });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
};

export const createCharge = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { customerId, amount, description } = req.body;
    const chargeId = await createStripeCharge(customerId, amount, description);
    res.status(201).json({ chargeId });
  } catch (error) {
    console.error('Error creating charge:', error);
    res.status(500).json({ error: 'Failed to create charge' });
  }
};

// Modern PaymentIntent-based endpoints
export const createPaymentIntentEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { amount, currency, customerId, metadata } = req.body;
    const paymentIntent = await createPaymentIntent(amount, currency, customerId, metadata);
    res.status(201).json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

export const confirmPaymentIntentEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;
    const paymentIntent = await confirmPaymentIntent(paymentIntentId, paymentMethodId);
    res.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    });
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    res.status(500).json({ error: 'Failed to confirm payment intent' });
  }
};

export const createSetupIntentEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { customerId, metadata } = req.body;
    const setupIntent = await createSetupIntent(customerId, metadata);
    res.status(201).json({
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
      status: setupIntent.status,
    });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
};

export const attachPaymentMethodEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { paymentMethodId, customerId } = req.body;
    const paymentMethod = await attachPaymentMethodToCustomer(paymentMethodId, customerId);
    res.json({
      paymentMethodId: paymentMethod.id,
      type: paymentMethod.type,
      card: paymentMethod.card,
    });
  } catch (error) {
    console.error('Error attaching payment method:', error);
    res.status(500).json({ error: 'Failed to attach payment method' });
  }
};

export const listPaymentMethodsEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { customerId } = req.params;
    const paymentMethods = await listCustomerPaymentMethods(customerId);
    res.json({
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card,
        created: pm.created,
      })),
    });
  } catch (error) {
    console.error('Error listing payment methods:', error);
    res.status(500).json({ error: 'Failed to list payment methods' });
  }
};

export const detachPaymentMethodEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { paymentMethodId } = req.params;
    const paymentMethod = await detachPaymentMethod(paymentMethodId);
    res.json({
      paymentMethodId: paymentMethod.id,
      detached: true,
    });
  } catch (error) {
    console.error('Error detaching payment method:', error);
    res.status(500).json({ error: 'Failed to detach payment method' });
  }
};

export const createRefundEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { paymentIntentId, amount, reason } = req.body;
    const refund = await createRefund(paymentIntentId, amount, reason);
    res.status(201).json({
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
    });
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({ error: 'Failed to create refund' });
  }
};

export const getPaymentIntentEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);
    res.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    res.status(500).json({ error: 'Failed to retrieve payment intent' });
  }
};

export const getCustomerEndpoint = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { customerId } = req.params;
    const customer = await retrieveCustomer(customerId);
    res.json({
      customerId: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
      created: customer.created,
    });
  } catch (error) {
    console.error('Error retrieving customer:', error);
    res.status(500).json({ error: 'Failed to retrieve customer' });
  }
};
