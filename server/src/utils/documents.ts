import path from 'node:path';

/** The ENUM values the `documents.category` column accepts. */
export const DOCUMENT_CATEGORIES = [
  'medical_record',
  'lab_report',
  'prescription',
  'administrative',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Maps the title-case values the browser sends to the schema's snake_case. */
export const CATEGORY_MAP: Record<string, DocumentCategory> = {
  'Medical Record': 'medical_record',
  'Lab Report': 'lab_report',
  'Prescription': 'prescription',
  'Administrative': 'administrative',
};

export const normalizeCategory = (category: unknown): string | null => {
  if (category === undefined || category === null) return null;
  const trimmed = String(category).trim();
  if (!trimmed) return null;
  const mapped = CATEGORY_MAP[trimmed];
  if (mapped) return mapped;
  const lower = trimmed.toLowerCase().replace(/\s+/g, '_');
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(lower) ? lower : null;
};

export const isDocumentCategory = (value: unknown): value is DocumentCategory => {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(String(value));
};

/** Storage providers the document service knows how to use. */
export const DOCUMENT_STORAGE_PROVIDERS = ['local', 'googledrive', 'onedrive'] as const;
export type DocumentStorageProvider = (typeof DOCUMENT_STORAGE_PROVIDERS)[number];

export const isDocumentStorageProvider = (value: unknown): value is DocumentStorageProvider => {
  return (DOCUMENT_STORAGE_PROVIDERS as readonly string[]).includes(String(value));
};

/** Declared MIME types the server is willing to record as a document's type. */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_MIME));

export const allowedDocumentExtension = (fileName: string): boolean => {
  const ext = path.extname(String(fileName ?? '')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
};

/**
 * The MIME type the server records for a document. It is derived from the
 * file name, not from the type the client declared, so a client that labels
 * a script as a PDF cannot have that label trusted.
 */
export const documentMimeType = (fileName: string): string => {
  const ext = path.extname(String(fileName ?? '')).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';
};

export const declaredMimeAllowed = (mimeType: unknown): boolean => {
  return typeof mimeType === 'string' && ALLOWED_MIME_TYPES.has(mimeType);
};
