import type { Response } from 'express';
import path from 'path';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

import fs from 'fs';
import axios from 'axios';
import { getStorageProvider } from '../services/storage.service.js';

// Helper function to validate ID
const validateId = (id: string, res: Response): boolean => {
  if (isNaN(parseInt(id, 10))) {
    res.status(400).json({ error: 'Invalid ID format' });
    return false;
  }
  return true;
};

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

    // If the user is a patient, they can only access their own documents
    if (user.role === 'patient') {
      query += ' AND d.patient_id = ?';
      params.push(user.id);
    } else if (patientId) {
      query += ' AND d.patient_id = ?';
      params.push(patientId);
    }

    if (category) {
      query += ' AND d.category = ?';
      params.push(category);
    }

    if (storageLocation) {
      // Map expected query to schema storage_type
      query += ' AND d.storage_type = ?';
      params.push(storageLocation);
    }

    if (req.query.tags && typeof req.query.tags === 'string') {
      const tags = req.query.tags.split(',');
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
    if (!validateId(id, res)) return;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [documents] = await pool.query(
      `SELECT d.*, p.first_name as patient_first_name, p.last_name as patient_last_name
       FROM documents d
       LEFT JOIN patients p ON d.patient_id = p.id
       WHERE d.id = ?`,
      [parseInt(id, 10)]
    );
    const document = (documents as any[])[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // If the user is a patient, they can only access their own documents
    if (user.role === 'patient' && document.patient_id !== user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const createDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { patientId, category, notes, tags, storageLocation = 'local' } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const currentStorageProvider = getStorageProvider(storageLocation, Number(req.user.id));

    const { filename, mimetype, size } = file as any;
    const now = new Date();

    try {
      const storageResult = await currentStorageProvider.upload(file, patientId, category);
      const { filePath: finalPath, storageType, documentId: documentIdStr } = storageResult;

      const [result] = await connection.query(
        `INSERT INTO documents (patient_id, document_id, name, file_type, file_size, category, file_path, storage_type, uploaded_by, uploaded_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId || null, documentIdStr ? parseInt(documentIdStr, 10) : null, filename, mimetype, size, category || null, finalPath, storageType, req.user?.id || null, now, notes || null]
      );
      const documentId = (result as any).insertId;

      if (tags && typeof tags === 'string') {
        const tagList = tags.split(',').map((tag: string) => tag.trim());
        for (const tagName of tagList) {
          const [tag] = await connection.query('SELECT id FROM tags WHERE name = ?', [tagName]);
          let tagId;
          if ((tag as any).length === 0) {
            const [tagResult] = await connection.query('INSERT INTO tags (name) VALUES (?)', [tagName]);
            tagId = (tagResult as any).insertId;
          } else {
            tagId = (tag as any)[0].id;
          }
          await connection.query('INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)', [documentId, tagId]);
        }
      }

      await connection.commit();
      res.status(201).json({ message: 'Document uploaded successfully', id: documentIdStr });
    } catch (storageError) {
      if ((storageError as any).message === 'Storage quota exceeded') {
        return res.status(413).json({ error: (storageError as any).message });
      }
      throw storageError;
    }


  } catch (error) {
    await connection.rollback();
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  } finally {
    connection.release();
  }
};

export const updateDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res)) return;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), parseInt(id, 10)];

    await pool.query(
      `UPDATE documents SET ${fields} WHERE id = ?`,
      values
    );
    res.json({ message: 'Document updated successfully' });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res)) return;
    await pool.query('DELETE FROM documents WHERE id = ?', [parseInt(id, 10)]);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// Rate limiting map for expensive operations with TTL cleanup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Check rate limit for expensive operations
const checkRateLimit = (userId: string, operation: string): boolean => {
  const now = Date.now();
  const key = `${userId}:${operation}`;
  const rateData = rateLimitMap.get(key);
  
  if (!rateData || now > rateData.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (rateData.count >= 10) { // Limit to 10 operations per minute
    return false;
  }
  
  rateData.count++;
  return true;
};

export const downloadDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res)) return;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check rate limit for file downloads
    if (!checkRateLimit(req.user.id.toString(), 'download')) {
      return res.status(429).json({ error: 'Rate limit exceeded: Too many download requests' });
    }

    const [rows] = await pool.query('SELECT storage_type, patient_id FROM documents WHERE id = ?', [parseInt(id, 10)]);
    const doc = (rows as any[])[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check patient access permissions
    if (req.user.role === 'patient' && doc.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const currentStorageProvider = getStorageProvider(doc.storage_type, Number(req.user.id));
    const { filePath, fileName } = await currentStorageProvider.download(id);

    // Enhanced Path Traversal Mitigation
    let resolvedPath: string;

    if (doc.storage_type === 'local') {
      const uploadsDir = path.resolve(__dirname, '../../uploads');
      const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
      resolvedPath = path.resolve(uploadsDir, normalizedPath);

      // Strict path validation
      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(400).json({ error: 'Invalid file path: traversal detected' });
      }
    } else {
      // For external providers, validate temp directory path
      const tempDir = path.resolve(__dirname, '../../temp');
      const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
      resolvedPath = path.resolve(tempDir, normalizedPath);

      if (!resolvedPath.startsWith(tempDir)) {
        return res.status(400).json({ error: 'Invalid file path: traversal detected' });
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(410).json({ error: 'File missing' });
    }

    // Enhanced filename sanitization
    const safeFileName = path.basename(fileName || 'document')
      .replace(/[^\w\-_.]/g, '_') // Allow only alphanumeric, dash, underscore, dot
      .substring(0, 255); // Limit length

    return res.download(resolvedPath, safeFileName);
  } catch (error) {
    if ((error as any).message === 'Document not found') {
      return res.status(404).json({ error: (error as any).message });
    }
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
};

export const previewDocument = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    console.log(`DEBUG: Starting preview for document ID: ${id}`);
    if (!validateId(id, res)) return;
    if (!req.user || !req.user.id) {
      console.log(`DEBUG: Authentication failed for user: ${req.user}`);
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check rate limit for file previews
    if (!checkRateLimit(req.user.id.toString(), 'preview')) {
      return res.status(429).json({ error: 'Rate limit exceeded: Too many preview requests' });
    }

    console.log(`DEBUG: Fetching document metadata for ID: ${id}`);
    const [rows] = await pool.query('SELECT storage_type, patient_id, file_type FROM documents WHERE id = ?', [parseInt(id, 10)]);
    const doc = (rows as any[])[0];
    if (!doc) {
      console.log(`DEBUG: Document not found in database for ID: ${id}`);
      return res.status(404).json({ error: 'Document not found' });
    }
    console.log(`DEBUG: Document found - storage_type: ${doc.storage_type}, patient_id: ${doc.patient_id}, file_type: ${doc.file_type}`);

    // Check patient access permissions
    if (req.user.role === 'patient' && doc.patient_id !== req.user.id) {
      console.log(`DEBUG: Permission denied - user role: ${req.user.role}, user id: ${req.user.id}, doc patient_id: ${doc.patient_id}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    console.log(`DEBUG: Getting storage provider for storage_type: ${doc.storage_type}`);
    const currentStorageProvider = getStorageProvider(doc.storage_type, Number(req.user.id));
    const { filePath } = await currentStorageProvider.preview(id);
    console.log(`DEBUG: Storage provider returned filePath: ${filePath}`);

    // Secure Path Traversal Mitigation
    const baseDir = doc.storage_type === 'local'
      ? path.resolve(__dirname, '../../uploads')
      : path.resolve(__dirname, '../../temp');
    console.log(`DEBUG: Base directory: ${baseDir}`);

    const streamPath = path.resolve(baseDir, filePath);
    console.log(`DEBUG: Resolved streamPath: ${streamPath}`);

    // Strict path validation - prevent directory traversal
    if (!streamPath.startsWith(baseDir)) {
      console.log(`DEBUG: Path traversal detected - streamPath: ${streamPath}, baseDir: ${baseDir}`);
      return res.status(400).json({ error: 'Invalid file path: traversal detected' });
    }

    if (!fs.existsSync(streamPath)) {
      console.log(`DEBUG: File does not exist at streamPath: ${streamPath}`);
      return res.status(410).json({ error: 'File missing' });
    }
    console.log(`DEBUG: File exists at streamPath: ${streamPath}`);

    // Check file size limit for previews (10MB limit)
    const stats = fs.statSync(streamPath);
    const maxPreviewSize = 10 * 1024 * 1024; // 10MB
    if (stats.size > maxPreviewSize) {
      return res.status(413).json({ error: 'File too large for preview' });
    }

    // Validate content type to prevent malicious file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/html'
    ];

    if (!allowedTypes.includes(doc.file_type as string)) {
      console.log(`DEBUG: Unsupported file type: ${doc.file_type}`);
      return res.status(415).json({ error: 'Unsupported file type for preview' });
    }

    res.setHeader('Content-Type', doc.file_type as string);

    // Create secure read stream with error handling and timeout
    const readStream = fs.createReadStream(streamPath, {
      highWaterMark: 64 * 1024, // 64KB chunks
      timeout: 30000 // 30 second timeout
    });

    readStream.on('error', (streamError) => {
      console.error('File stream error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read file for preview' });
      }
    });

    console.log(`DEBUG: Starting file stream for preview`);
    readStream.pipe(res);
  } catch (error) {
    if ((error as any).message === 'Document not found') {
      return res.status(404).json({ error: (error as any).message });
    }
    console.error('Preview document error:', error);
    res.status(500).json({ error: 'Failed to preview document' });
  }
};

export const initiateOneDriveOAuth = (_req: AuthRequest, res: Response): void => {
  const client_id = process.env.ONEDRIVE_CLIENT_ID;
  const redirect_uri = process.env.ONEDRIVE_REDIRECT_URI;

  if (!client_id) {
    res.status(500).json({ error: 'ONEDRIVE_CLIENT_ID is not set in environment variables.' });
    return;
  }
  if (!redirect_uri) {
    res.status(500).json({ error: 'ONEDRIVE_REDIRECT_URI is not set in environment variables.' });
    return;
  }

  const scope = 'Files.ReadWrite.All User.Read'; // Adjust scopes as needed
  const response_type = 'code';
  const authorizeUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${client_id}&scope=${scope}&response_type=${response_type}&redirect_uri=${redirect_uri}`;
  res.redirect(authorizeUrl);
};

export const initiateGoogleDriveOAuth = (_req: AuthRequest, res: Response): void => {
  const client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const redirect_uri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

  if (!client_id) {
    res.status(500).json({ error: 'GOOGLE_DRIVE_CLIENT_ID is not set in environment variables.' });
    return;
  }
  if (!redirect_uri) {
    res.status(500).json({ error: 'GOOGLE_DRIVE_REDIRECT_URI is not set in environment variables.' });
    return;
  }

  const scope = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile'; // Adjust scopes as needed
  const response_type = 'code';
  const access_type = 'offline';
  const prompt = 'consent';
  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}&response_type=${response_type}&access_type=${access_type}&prompt=${prompt}`;
  res.redirect(authorizeUrl);
};

export const handleOneDriveCallback = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    const client_id = process.env.ONEDRIVE_CLIENT_ID;
    const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;
    const redirect_uri = process.env.ONEDRIVE_REDIRECT_URI;

    if (!client_id) {
      res.status(500).json({ error: 'ONEDRIVE_CLIENT_ID is not set in environment variables.' });
      return;
    }
    if (!client_secret) {
      res.status(500).json({ error: 'ONEDRIVE_CLIENT_SECRET is not set in environment variables.' });
      return;
    }
    if (!redirect_uri) {
      res.status(500).json({ error: 'ONEDRIVE_REDIRECT_URI is not set in environment variables.' });
      return;
    }

    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: client_id as string,
        scope: 'Files.ReadWrite.All User.Read',
        code: code as string,
        redirect_uri: redirect_uri as string,
        grant_type: 'authorization_code',
        client_secret: client_secret as string,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Securely store access and refresh tokens associated with the user
    if (req.user && req.user.id) {
      await pool.query(
        'UPDATE users SET onedrive_access_token = ?, onedrive_refresh_token = ? WHERE id = ?',
        [access_token, refresh_token, req.user.id]
      );
    }

    res.redirect('/'); // Redirect to a success page or dashboard
  } catch (error) {
    console.error('OneDrive OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to authenticate with OneDrive' });
  }
};

export const handleGoogleDriveCallback = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    const client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const redirect_uri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

    if (!client_id) {
      res.status(500).json({ error: 'GOOGLE_DRIVE_CLIENT_ID is not set in environment variables.' });
      return;
    }
    if (!client_secret) {
      res.status(500).json({ error: 'GOOGLE_DRIVE_CLIENT_SECRET is not set in environment variables.' });
      return;
    }
    if (!redirect_uri) {
      res.status(500).json({ error: 'GOOGLE_DRIVE_REDIRECT_URI is not set in environment variables.' });
      return;
    }

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: client_id as string,
        client_secret: client_secret as string,
        code: code as string,
        redirect_uri: redirect_uri as string,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Securely store access and refresh tokens associated with the user
    if (req.user && req.user.id) {
      await pool.query(
        'UPDATE users SET googledrive_access_token = ?, googledrive_refresh_token = ? WHERE id = ?',
        [access_token, refresh_token, req.user.id]
      );
    }

    res.redirect('/'); // Redirect to a success page or dashboard
  } catch (error) {
    console.error('Google Drive OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google Drive' });
  }
};
