import type { Response } from 'express';

import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { patientBelongsToTenant } from '../middleware/tenant.js';

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { getStorageProvider } from '../services/storage.service.js';
import {
  normalizeCategory,
  isDocumentStorageProvider,
  allowedDocumentExtension,
  documentMimeType,
  declaredMimeAllowed,
} from '../utils/documents.js';
import { safeFileName } from '../utils/files.js';

/**
 * The columns a client may change through PUT /api/documents/:id.
 *
 * The patient a document belongs to and the type it is served as are the
 * server's business: the first decides whose record it appears in, and the
 * second decides how the browser treats the bytes. A client that could set
 * either could re-point a document at another patient, or have a file
 * declared as something the browser will run.
 */
const ALLOWED_UPDATE_FIELDS = ['name', 'category', 'notes'];

export const getDocuments = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patientId, category, storageLocation } = req.query;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let query = `
      SELECT d.*, p.first_name as patient_first_name, p.last_name as patient_last_name
      FROM documents d
      LEFT JOIN patients p ON d.patient_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // The documents are the patients', and the patients belong to a
    // hospital. The list is confined to the caller's own hospital.
    const scope = req.tenant;
    if (!scope?.platformWide) {
      query += ' AND p.hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }

    if (patientId) {
      query += ' AND d.patient_id = ?';
      params.push(patientId);
    }

    if (category) {
      query += ' AND d.category = ?';
      params.push(normalizeCategory(category as string));
    }

    if (storageLocation) {
      // Map expected query to schema storage_type
      query += ' AND d.storage_type = ?';
      params.push(storageLocation);
    }

    if (req.query.tags) {
      // The list of tags is bounded, so the statement cannot be made to grow
      // without limit.
      const tags = (req.query.tags as string).split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
      if (tags.length > 0) {
        query += `
          AND d.id IN (
            SELECT dt.document_id
            FROM document_tags dt
            JOIN tags t ON dt.tag_id = t.id
            WHERE t.name IN (?)
          )
        `;
        params.push(tags);
      }
    }

    // The list is paged: the documents are a table of everybody's records.
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query += ' ORDER BY d.uploaded_at DESC, d.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [documents] = await pool.query(query, params);
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

export const getDocumentById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [documents] = await pool.query(
      `SELECT d.*, p.first_name as patient_first_name, p.last_name as patient_last_name
       FROM documents d
       LEFT JOIN patients p ON d.patient_id = p.id
       WHERE d.document_id = ?`,
      [id]
    );
    const document = (documents as any[])[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // The document belongs to a patient, and the patient belongs to a
    // hospital. The check used to compare the document's patient against the
    // caller's account number, which are two different things: the account
    // and the patient record are not the same row, and the comparison
    // resolved to whichever patient happened to carry that number.
    if (!(await patientBelongsToTenant(document.patient_id, req.tenant))) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const createDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  // Everything that can be refused is refused before the transaction opens.
  // A request that returns while a transaction is open hands the connection
  // back to the pool with the transaction still running, and the next request
  // that borrows it commits or discards the abandoned work along with its
  // own.
  const { patientId, category, notes, tags, storageLocation = 'local' } = req.body;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  if (!req.user || !req.user.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Refuse everything that can be refused before the transaction opens.

  if (!allowedDocumentExtension(file.originalname)) {
    res.status(400).json({ error: 'File type not allowed' });
    return;
  }
  if (file.mimetype && !declaredMimeAllowed(file.mimetype)) {
    res.status(400).json({ error: 'File type not allowed' });
    return;
  }

  const normalizedCategory = normalizeCategory(category);
  if (category !== undefined && category !== null && String(category).trim() !== '' && !normalizedCategory) {
    res.status(400).json({ error: 'Invalid document category' });
    return;
  }

  if (!isDocumentStorageProvider(storageLocation)) {
    res.status(400).json({ error: 'Invalid storage location' });
    return;
  }

  if (storageLocation !== 'local') {
    const column = storageLocation === 'googledrive' ? 'googledrive_access_token' : 'onedrive_access_token';
    const [tokenRows] = await pool.query(`SELECT ${column} FROM users WHERE id = ?`, [req.user.id]);
    const token = (tokenRows as any[])[0]?.[column];
    if (!token) {
      res.status(409).json({ error: 'Storage provider not connected' });
      return;
    }
  }

  if (notes !== undefined && notes !== null && String(notes).length > 2000) {
    res.status(400).json({ error: 'Notes too long' });
    return;
  }

  const tagList = tags
    ? String(tags).split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 20)
    : [];
  if (tags && String(tags).split(',').map((t: string) => t.trim()).filter(Boolean).length > 20) {
    res.status(400).json({ error: 'Too many tags' });
    return;
  }

  if (patientId !== undefined && patientId !== null && String(patientId).trim() !== '') {
    const belongs = await patientBelongsToTenant(Number(patientId), req.tenant);
    if (!belongs) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }
  }

  const safeName = safeFileName(file.originalname, 'document');

  const connection = await pool.getConnection();
  let writtenFilePath: string | null = null;
  try {
    await connection.beginTransaction();

    const currentStorageProvider = getStorageProvider(storageLocation, Number(req.user.id));

    const { size } = file;
    const now = new Date();

    try {
      const storageResult = await currentStorageProvider.upload(file, patientId, category);
      writtenFilePath = storageResult.filePath;
      const { filePath: finalPath, storageType, documentId: documentIdStr } = storageResult;

      const [result] = await connection.query(
        `INSERT INTO documents (patient_id, document_id, name, file_type, file_size, category, file_path, storage_type, uploaded_by, uploaded_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId || null, documentIdStr, safeName, documentMimeType(file.originalname), size, normalizedCategory, finalPath, storageType, req.user.id, now, notes || null]
      );
      const documentId = (result as any).insertId;

      if (tagList.length > 0) {
        for (const tagName of tagList) {
          const [tagResult] = await connection.query(
            'INSERT INTO tags (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
            [tagName]
          );
          const tagId = (tagResult as any).insertId;
          await connection.query('INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)', [documentId, tagId]);
        }
      }

      await connection.commit();
      res.status(201).json({ message: 'Document uploaded successfully', id: documentIdStr });
    } catch (storageError) {
      if ((storageError as any).message === 'Storage quota exceeded') {
        await connection.rollback();
        res.status(413).json({ error: (storageError as any).message });
        return;
      }
      throw storageError;
    }
  } catch (error) {
    await connection.rollback();
    // Remove the file written to disk if the DB transaction failed.
    if (writtenFilePath && fs.existsSync(writtenFilePath)) {
      const versionDir = path.dirname(writtenFilePath);
      const docDir = path.dirname(versionDir);
      fs.rmSync(docDir, { recursive: true, force: true });
    }
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  } finally {
    connection.release();
  }
};

export const updateDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // The document must belong to the caller's hospital before it can be
    // changed. A document in another hospital is not found.
    const [rows] = await pool.query('SELECT patient_id FROM documents WHERE document_id = ?', [id]);
    const doc = (rows as any[])[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!(await patientBelongsToTenant(doc.patient_id, req.tenant))) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // A category change must land on a value the schema accepts.
    if (updates && updates.category !== undefined) {
      const normalized = normalizeCategory(updates.category);
      if (updates.category !== null && String(updates.category).trim() !== '' && !normalized) {
        return res.status(400).json({ error: 'Invalid document category' });
      }
      updates.category = normalized;
    }

    const allowedFields = ALLOWED_UPDATE_FIELDS.filter((field) => field in (updates || {}));
    if (allowedFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = allowedFields.map((field) => `${field} = ?`).join(', ');
    const values = allowedFields.map((field) => {
      const value = (updates as any)[field];
      return field === 'category' ? normalizeCategory(value) : value;
    });

    await pool.query(`UPDATE documents SET ${fields} WHERE document_id = ?`, [...values, id]);
    res.json({ message: 'Document updated successfully' });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query('SELECT storage_type, patient_id FROM documents WHERE document_id = ?', [id]);
    const doc = (rows as any[])[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // A document in another hospital is not found rather than forbidden.
    if (!(await patientBelongsToTenant(doc.patient_id, req.tenant))) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentStorageProvider = getStorageProvider(doc.storage_type, Number(req.user.id));
    await currentStorageProvider.delete(id as string);
    await pool.query('DELETE FROM documents WHERE document_id = ?', [id]);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

export const downloadDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      'SELECT storage_type, file_type, name, patient_id FROM documents WHERE document_id = ?',
      [id]
    );
    const doc = (rows as any[])[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // The document belongs to a patient, and the patient belongs to a
    // hospital. A document that belongs to another hospital is not found.
    if (!(await patientBelongsToTenant(doc.patient_id, req.tenant))) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentStorageProvider = getStorageProvider(doc.storage_type, Number(req.user.id));
    const { filePath, fileName } = await currentStorageProvider.download(id as string);
    if (!fs.existsSync(filePath)) {
      return res.status(410).json({ error: 'File missing' });
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, fileName);
  } catch (error) {
    if ((error as any).message === 'Document not found') {
      return res.status(404).json({ error: (error as any).message });
    }
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
};

/**
 * The content type a stored document is served as.
 *
 * The type recorded at upload was declared by the client, and a client can
 * declare anything. A document declared as `text/html` and served as such
 * runs its own script in the application's own origin the moment somebody
 * opens it, which is the patient's record running code in the ward's
 * browser.
 *
 * So the type is decided by the file's name, and only the types that cannot
 * carry a script are served inline. Everything else is served as a download,
 * with the browser told not to guess.
 */
const INLINE_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

const contentTypeFor = (fileName: string): { type: string; inline: boolean } => {
  const extension = path.extname(String(fileName ?? '')).toLowerCase();
  const type = INLINE_CONTENT_TYPES[extension];
  if (type) return { type, inline: true };
  return { type: 'application/octet-stream', inline: false };
};

export const previewDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      'SELECT storage_type, file_type, name, patient_id FROM documents WHERE document_id = ?',
      [id]
    );
    const doc = (rows as any[])[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // The document belongs to a patient, and the patient belongs to a
    // hospital. A document that belongs to another hospital is not found.
    if (!(await patientBelongsToTenant(doc.patient_id, req.tenant))) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentStorageProvider = getStorageProvider(doc.storage_type, Number(req.user.id));
    const { filePath, fileName } = await currentStorageProvider.preview(id as string);
    if (!fs.existsSync(filePath)) {
      return res.status(410).json({ error: 'File missing' });
    }

    const { type, inline } = contentTypeFor(fileName || doc.name);
    res.setHeader('Content-Type', type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self' data:; object-src 'none'; sandbox"
    );
    if (!inline) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if ((error as any).message === 'Document not found') {
      return res.status(404).json({ error: (error as any).message });
    }
    console.error('Preview document error:', error);
    res.status(500).json({ error: 'Failed to preview document' });
  }
};

export const initiateOneDriveOAuth = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const client_id = process.env.ONEDRIVE_CLIENT_ID;
  const redirect_uri = process.env.ONEDRIVE_REDIRECT_URI;
  if (!client_id || !redirect_uri) {
    return res.status(503).json({ error: 'OneDrive is not configured' });
  }

  // A single-use, expiring authorization transaction. The state is the CSRF
  // token for the callback; the PKCE verifier is the proof that the initiator
  // and the callback are the same client.
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    'INSERT INTO oauth_authorization_requests (state, user_id, provider, code_verifier, expires_at) VALUES (?, ?, ?, ?, ?)',
    [state, req.user!.id, 'onedrive', codeVerifier, expiresAt]
  );

  const scope = 'Files.ReadWrite.All User.Read';
  const authorizeUrl =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(client_id)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;
  res.redirect(authorizeUrl);
};

export const initiateGoogleDriveOAuth = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const redirect_uri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if (!client_id || !redirect_uri) {
    return res.status(503).json({ error: 'Google Drive is not configured' });
  }

  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    'INSERT INTO oauth_authorization_requests (state, user_id, provider, code_verifier, expires_at) VALUES (?, ?, ?, ?, ?)',
    [state, req.user!.id, 'googledrive', codeVerifier, expiresAt]
  );

  const scope = 'https://www.googleapis.com/auth/drive.file';
  const authorizeUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(client_id)}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;
  res.redirect(authorizeUrl);
};

export const handleOneDriveCallback = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const code = req.query.code;
  const state = req.query.state;
  if (!code || !state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Authorization code or state not provided' });
  }

  // Consume the state: single-use, must not have been used, must not have
  // expired. The update is the check, so two concurrent callbacks cannot both
  // succeed.
  const [upd] = await pool.query(
    'UPDATE oauth_authorization_requests SET consumed_at = NOW() WHERE state = ? AND consumed_at IS NULL AND expires_at > NOW()',
    [state]
  );
  if ((upd as any).affectedRows === 0) {
    return res.status(400).json({ error: 'Invalid or expired authorization state' });
  }

  const [rows] = await pool.query(
    'SELECT user_id, provider, code_verifier FROM oauth_authorization_requests WHERE state = ?',
    [state]
  );
  const record = (rows as any[])[0];
  if (!record || record.provider !== 'onedrive') {
    return res.status(400).json({ error: 'Invalid authorization state' });
  }

  try {
    const client_id = process.env.ONEDRIVE_CLIENT_ID;
    const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;
    const redirect_uri = process.env.ONEDRIVE_REDIRECT_URI;

    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: client_id as string,
        client_secret: client_secret as string,
        scope: 'Files.ReadWrite.All User.Read',
        code: code as string,
        redirect_uri: redirect_uri as string,
        grant_type: 'authorization_code',
        code_verifier: record.code_verifier,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;
    await pool.query(
      'UPDATE users SET onedrive_access_token = ?, onedrive_refresh_token = ? WHERE id = ?',
      [access_token, refresh_token, record.user_id]
    );

    res.redirect('/');
  } catch (error) {
    console.error('OneDrive OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to authenticate with OneDrive' });
  }
};

export const handleGoogleDriveCallback = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const code = req.query.code;
  const state = req.query.state;
  if (!code || !state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Authorization code or state not provided' });
  }

  const [upd] = await pool.query(
    'UPDATE oauth_authorization_requests SET consumed_at = NOW() WHERE state = ? AND consumed_at IS NULL AND expires_at > NOW()',
    [state]
  );
  if ((upd as any).affectedRows === 0) {
    return res.status(400).json({ error: 'Invalid or expired authorization state' });
  }

  const [rows] = await pool.query(
    'SELECT user_id, provider, code_verifier FROM oauth_authorization_requests WHERE state = ?',
    [state]
  );
  const record = (rows as any[])[0];
  if (!record || record.provider !== 'googledrive') {
    return res.status(400).json({ error: 'Invalid authorization state' });
  }

  try {
    const client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const redirect_uri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: client_id as string,
        client_secret: client_secret as string,
        code: code as string,
        redirect_uri: redirect_uri as string,
        grant_type: 'authorization_code',
        code_verifier: record.code_verifier,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;
    await pool.query(
      'UPDATE users SET googledrive_access_token = ?, googledrive_refresh_token = ? WHERE id = ?',
      [access_token, refresh_token, record.user_id]
    );

    res.redirect('/');
  } catch (error) {
    console.error('Google Drive OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google Drive' });
  }
};

