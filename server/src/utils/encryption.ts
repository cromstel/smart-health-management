import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes (256 bits)
const ENCRYPTION_IV = process.env.ENCRYPTION_IV;   // Must be 16 bytes (128 bits)

if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY and ENCRYPTION_IV are required in production (32-byte and 16-byte hex values).');
  }
  console.warn('Encryption key or IV not set. Data encryption will not be active (development only).');
}

export function encrypt(text: string): string | null {
  if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
    return text; // Return original text if encryption is not configured
  }
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ENCRYPTION_IV, 'hex'));
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

export function decrypt(encryptedText: string): string | null {
  if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
    return encryptedText; // Return original text if encryption is not configured
  }
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ENCRYPTION_IV, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}