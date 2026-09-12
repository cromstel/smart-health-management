import pool from '../config/database.js';
import { OneDriveStorageProvider } from './onedrive.storage.service.js';
import { GoogleDriveStorageProvider } from './googledrive.storage.service.js';

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import checkDiskSpace from 'check-disk-space';

export interface IStorageProvider {
  upload(file: Express.Multer.File, patientId: string | null, category: string | null): Promise<{ filePath: string; storageType: string; documentId: string }>;
  download(documentId: string): Promise<{ filePath: string; fileName: string }>;
  preview(documentId: string): Promise<{ filePath: string; fileName: string }>;
  getMetadata(documentId: string): Promise<any>;
  delete(documentId: string): Promise<void>;
  getSignedUrl?(documentId: string, action: 'read' | 'write'): Promise<string>;
}

/**
 * Inbuilt local filesystem storage provider.
 *
 * Documents are stored under `server/uploads/{patientId|unassigned}/{category|uncategorized}/{documentId}/version-1/{filename}`.
 * The provider works with `multer.memoryStorage()` (writes `file.buffer` to disk).
 * External providers (Google Drive, OneDrive) are available via `getStorageProvider`.
 */
export class LocalStorageProvider implements IStorageProvider {
  private getUploadsDir(): string {
    return path.join(__dirname, '../../uploads');
  }

  public calculateDirectorySize(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      total += entry.isDirectory() ? this.calculateDirectorySize(full) : fs.statSync(full).size;
    }
    return total;
  }

  async upload(file: Express.Multer.File, patientId: string | null, category: string | null): Promise<{ filePath: string; storageType: string; documentId: string }> {
    const { originalname, size, buffer } = file;
    const documentIdStr = uuidv4();
    const baseUploads = this.getUploadsDir();
    const patientSegment = patientId ? String(patientId) : 'unassigned';
    const categorySegment = category ? String(category).toLowerCase().replace(/\s+/g, '_') : 'uncategorized';
    const docDir = path.join(baseUploads, patientSegment, categorySegment, documentIdStr, 'version-1');

    fs.mkdirSync(docDir, { recursive: true });

    const quotaBytes = Number(process.env.LOCAL_STORAGE_QUOTA_BYTES || 0);
    if (quotaBytes > 0) {
      const currentUsage = this.calculateDirectorySize(baseUploads);
      if (currentUsage + size > quotaBytes) {
        throw new Error('Storage quota exceeded');
      }
    }

    const finalPath = path.join(docDir, originalname);
    fs.writeFileSync(finalPath, buffer);

    return { filePath: finalPath, storageType: 'local', documentId: documentIdStr };
  }

  async download(documentId: string): Promise<{ filePath: string; fileName: string }> {
    const [rows] = await pool.query('SELECT file_path, name FROM documents WHERE document_id = ?', [documentId]);
    const doc = (rows as any[])[0];
    if (!doc) {
      throw new Error('Document not found');
    }
    return { filePath: doc.file_path as string, fileName: doc.name as string };
  }

  async preview(documentId: string): Promise<{ filePath: string; fileName: string }> {
    const [rows] = await pool.query('SELECT file_path, name FROM documents WHERE document_id = ?', [documentId]);
    const doc = (rows as any[])[0];
    if (!doc) {
      throw new Error('Document not found');
    }
    return { filePath: doc.file_path as string, fileName: doc.name as string };
  }

  async getMetadata(documentId: string): Promise<any> {
    const [rows] = await pool.query('SELECT * FROM documents WHERE document_id = ?', [documentId]);
    return (rows as any[])[0] || null;
  }

  async delete(documentId: string): Promise<void> {
    const [rows] = await pool.query('SELECT file_path FROM documents WHERE document_id = ?', [documentId]);
    const doc = (rows as any[])[0];
    if (doc?.file_path && fs.existsSync(doc.file_path)) {
      // Remove the version directory and its parent document directory
      const versionDir = path.dirname(doc.file_path);
      const docDir = path.dirname(versionDir);
      fs.rmSync(docDir, { recursive: true, force: true });
    }
  }
}

export const getStorageProvider = (storageType: string, userId: number): IStorageProvider => {
  switch (storageType) {
    case 'local':
      return new LocalStorageProvider();
    case 'onedrive':
      return new OneDriveStorageProvider(userId);
    case 'googledrive':
      return new GoogleDriveStorageProvider(userId);
    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
};

export const getStorageUsage = async (): Promise<any> => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const usedBytes = new LocalStorageProvider().calculateDirectorySize(uploadsDir);
  const diskPath = path.parse(uploadsDir).root;
  const diskInfo = await checkDiskSpace(diskPath);
  const quotaBytes = Number(process.env.LOCAL_STORAGE_QUOTA_BYTES || 0) || null;
  const remainingQuota = quotaBytes ? Math.max(quotaBytes - usedBytes, 0) : null;

  return {
    uploadsDir,
    usedBytes,
    diskTotal: diskInfo.size,
    diskFree: diskInfo.free,
    quotaBytes,
    remainingQuota,
  };
};