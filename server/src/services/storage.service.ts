import { OneDriveStorageProvider } from './onedrive.storage.service.js';
import { GoogleDriveStorageProvider } from './googledrive.storage.service.js';
import pool from '../config/database.js';

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
    const { filename, size, path: tempPath } = file;
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

    const finalPath = path.join(docDir, filename);
    fs.renameSync(tempPath, finalPath);

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

  async getMetadata(_documentId: string): Promise<any> {
    // This will require querying the database
    throw new Error('Method not implemented. Requires database access.');
  }

  async delete(_documentId: string): Promise<void> {
    // This will require querying the database to get the file_path and then deleting the file
    throw new Error('Method not implemented. Requires database access.');
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