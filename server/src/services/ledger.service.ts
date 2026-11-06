import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../config/database.js';
import { randomUUID } from 'crypto';

/**
 * The ledger.
 *
 * An account's balance is the sum of its transactions, and every path that
 * writes a transaction moves the balance by the same rule. The paths did not
 * agree with each other: one added the debit and subtracted the credit, one
 * subtracted zero, and one added the credit to an account whose balance was
 * measured the other way round. The stored balance therefore drifted away
 * from the transactions behind it, and the reports -- which sum the
 * transactions -- disagreed with the dashboard, which sums the balances.
 *
 * The rule depends on the kind of account, because the kinds are measured
 * differently: an asset and an expense are measured by their debits, and a
 * liability and an income by their credits. A revenue account that shows a
 * balance of minus five hundred is a balance nobody can read.
 */

/** The kinds of account that are measured by their credits. */
const CREDIT_POSITIVE_TYPES = new Set(['income', 'liability']);

/**
 * The amount a transaction moves the balance by.
 *
 * The sign is the amount to add to the stored balance.
 */
export const balanceDelta = (
  accountType: string,
  debit: number,
  credit: number
): number => {
  const type = String(accountType ?? '').toLowerCase();
  return CREDIT_POSITIVE_TYPES.has(type) ? credit - debit : debit - credit;
};

/** A transaction to post. */
export interface PostedTransaction {
  accountId: number;
  date: string;
  description: string;
  debit?: number;
  credit?: number;
  reference?: string | null;
  createdBy?: number | null;
  /** The account the transaction is posted to. Used to place the money. */
  counterpartAccountId?: number | null;
  description2?: string;
}

/** The kind of account an id names. */
const accountTypeOf = async (
  executor: Pick<PoolConnection, 'query'>,
  accountId: number
): Promise<string> => {
  const [rows] = await executor.query<RowDataPacket[]>(
    'SELECT type FROM accounts WHERE id = ? LIMIT 1',
    [accountId]
  );
  return String((rows as any[])[0]?.type ?? 'asset');
};

/**
 * Posts a transaction and moves the balance with it.
 *
 * The two happen together or not at all: a transaction without its balance
 * is a ledger that does not add up, and a balance without its transaction is
 * a number nobody can explain.
 */
export const postTransaction = async (
  executor: Pick<PoolConnection, 'query'>,
  transaction: PostedTransaction
): Promise<string> => {
  const transactionId = `TRN-${randomUUID().slice(0, 8)}`;
  const debit = Number(transaction.debit ?? 0);
  const credit = Number(transaction.credit ?? 0);

  await executor.query(
    `INSERT INTO transactions (transaction_id, account_id, date, description, debit, credit, reference, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transactionId,
      transaction.accountId,
      transaction.date,
      transaction.description,
      debit,
      credit,
      transaction.reference ?? null,
      transaction.createdBy ?? null,
    ]
  );

  const accountType = await accountTypeOf(executor, transaction.accountId);
  const delta = balanceDelta(accountType, debit, credit);
  if (delta !== 0) {
    await executor.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [
      delta,
      transaction.accountId,
    ]);
  }

  return transactionId;
};

/**
 * Reverses a transaction, and moves the balance back with it.
 *
 * Used when a transaction is changed or removed: the balance has to go back
 * to where it was, or it is the sum of a ledger that no longer exists.
 */
export const reverseTransaction = async (
  executor: Pick<PoolConnection, 'query'>,
  transactionId: number
): Promise<void> => {
  const [rows] = await executor.query<RowDataPacket[]>(
    'SELECT account_id, debit, credit FROM transactions WHERE id = ? LIMIT 1',
    [transactionId]
  );
  const transaction = (rows as any[])[0];
  if (!transaction) return;

  const accountType = await accountTypeOf(executor, transaction.account_id);
  const delta = balanceDelta(accountType, Number(transaction.debit || 0), Number(transaction.credit || 0));
  if (delta !== 0) {
    await executor.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [
      delta,
      transaction.account_id,
    ]);
  }
};

/**
 * Runs a piece of work in one transaction.
 *
 * The work is handed a connection that is already inside a transaction, so
 * that everything it writes either happens or does not.
 */
export const inTransaction = async <T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // The transaction is already gone. The failure that brought us here is
      // the one worth reporting.
    }
    throw error;
  } finally {
    connection.release();
  }
};
