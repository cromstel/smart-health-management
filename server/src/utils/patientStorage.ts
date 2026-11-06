import { encrypt, decrypt } from './encryption.js';

/**
 * How a patient record is written and read.
 *
 * The patient controller encrypts the sensitive columns before they are stored,
 * because those columns are ciphertext everywhere else. Anything else that
 * writes a patient record — the import from another system, a repair script —
 * has to write it the same way, or the column is left holding a mixture of
 * two kinds of value and the reader shows the ciphertext to whoever opens the
 * record.
 *
 * The helpers live here rather than in the controller so that there is one
 * answer to "how is a patient stored" rather than one per writer.
 */

/** The width each encrypted column has to fit into. */
export const COLUMN_WIDTHS: Record<string, number> = {
  first_name: 100,
  last_name: 100,
  phone: 255,
  email: 255,
  address: 65535,
};

/**
 * The columns that are stored as they arrive.
 *
 * There are none: every sensitive column is encrypted at rest. The list
 * exists so that a column can be exempted deliberately, with the reason
 * written down, rather than by forgetting to encrypt it.
 */
export const PLAINTEXT_COLUMNS: string[] = [];

/** Raised when a value cannot be stored the way it has to be stored. */
export class PatientStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatientStorageError';
  }
}

/**
 * Encrypts a value for storage.
 *
 * A sensitive value is never silently downgraded to plaintext: when the
 * ciphertext does not fit its column the caller gets a clear error instead of
 * a database error.
 */
export const encryptForStorage = (value: string, column: string): string => {
  if (PLAINTEXT_COLUMNS.includes(column)) return value;
  const encrypted = encrypt(value);
  if (!encrypted) return value;
  const width = COLUMN_WIDTHS[column];
  if (width !== undefined && encrypted.length > width) {
    throw new PatientStorageError(`${column.replace('_', ' ')} is too long to store securely`);
  }
  return encrypted;
};

/**
 * Decrypts a stored value. A value that was not written as ciphertext (the
 * seeded rows hold plaintext) cannot be decrypted, so it is kept as it is
 * instead of being dropped.
 *
 * The ciphertext is hex encoded AES-256-CBC, so it is at least 32 characters
 * long (one 16 byte block) and has an even length. Checking that first keeps
 * plaintext rows from producing a decryption error for every single read.
 */
export const decryptField = (value: string): string => {
  if (!/^[0-9a-f]+$/i.test(value) || value.length < 32 || value.length % 2 !== 0) return value;
  const decrypted = decrypt(value);
  return decrypted ?? value;
};
