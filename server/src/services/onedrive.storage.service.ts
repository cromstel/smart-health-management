import { IStorageProvider } from './storage.service.js';
import axios from 'axios';
import { refreshOneDriveToken } from './oauth.service.js';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export class OneDriveStorageProvider implements IStorageProvider {
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
  }

  private async getValidAccessToken(): Promise<string> {
    const [rows] = await pool.query('SELECT onedrive_refresh_token FROM users WHERE id = ?', [this.userId]);
    const user: any = (rows as any[])[0];

    if (!user || !user.onedrive_refresh_token) {
      throw new Error('OneDrive refresh token not found for user.');
    }

    const { accessToken, refreshToken: newRefreshToken } = await refreshOneDriveToken(user.onedrive_refresh_token);

    if (newRefreshToken && newRefreshToken !== user.onedrive_refresh_token) {
      await pool.query('UPDATE users SET onedrive_access_token = ?, onedrive_refresh_token = ? WHERE id = ?', [accessToken, newRefreshToken, this.userId]);
    } else {
      await pool.query('UPDATE users SET onedrive_access_token = ? WHERE id = ?', [accessToken, this.userId]);
    }

    return accessToken;
  }
  async upload(file: Express.Multer.File): Promise<{ filePath: string; storageType: string; documentId: string }> {
    const accessToken = await this.getValidAccessToken();
    const documentIdStr = uuidv4();
    const fileName = file.originalname;

    try {
      // Upload file to OneDrive
      const uploadResponse = await axios.put(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${documentIdStr}-${fileName}:/content`,
        file.buffer,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': file.mimetype,
            'Content-Length': file.size,
          },
        }
      );

      // OneDrive doesn't return a direct file path like local storage.
      // We'll store the item ID and a constructed path for consistency.
      const oneDriveItemId = uploadResponse.data.id;
      const filePath = `onedrive://${oneDriveItemId}`;

      return { filePath, storageType: 'onedrive', documentId: documentIdStr };
    } catch (error) {
      console.error('OneDrive upload error:', error);
      throw new Error('Failed to upload file to OneDrive');
    }
    }

  async download(documentId: string): Promise<{ filePath: string; fileName: string }> {
    const accessToken = await this.getValidAccessToken();
    try {
      // Retrieve document metadata to get the actual OneDrive item ID and file name
      const [rows] = await pool.query('SELECT file_path, name FROM documents WHERE document_id = ?', [documentId]);
      const doc = (rows as any[])[0];
      if (!doc || !doc.file_path || !doc.name) {
        throw new Error('Document not found in database.');
      }

      const oneDriveItemId = doc.file_path.replace('onedrive://', '');
      const fileName = doc.name;

      // Get download URL from OneDrive
      const downloadResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${oneDriveItemId}/content`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          responseType: 'stream',
        }
      );

      // Create a temporary file to store the downloaded content
      const tempDir = './temp'; // Or a more robust temporary directory solution
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      const tempFilePath = `${tempDir}/${fileName}`;
      const writer = fs.createWriteStream(tempFilePath);

      downloadResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ filePath: tempFilePath, fileName }));
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('OneDrive download error:', error);
      throw new Error('Failed to download file from OneDrive');
    }

    }

  async preview(documentId: string): Promise<{ filePath: string; fileName: string }> {
    const accessToken = await this.getValidAccessToken();
    try {
      const [rows] = await pool.query('SELECT file_path, name FROM documents WHERE document_id = ?', [documentId]);
      const doc = (rows as any[])[0];
      if (!doc || !doc.file_path || !doc.name) {
        throw new Error('Document not found in database.');
      }

      const oneDriveItemId = doc.file_path.replace('onedrive://', '');
      const fileName = doc.name;

      const previewResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${oneDriveItemId}/content`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          responseType: 'stream',
        }
      );

      const tempDir = './temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      const tempFilePath = `${tempDir}/${fileName}`;
      const writer = fs.createWriteStream(tempFilePath);

      previewResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ filePath: tempFilePath, fileName }));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('OneDrive preview error:', error);
      throw new Error('Failed to preview file from OneDrive');
    }

    }

  async getMetadata(documentId: string): Promise<any> {
    const accessToken = await this.getValidAccessToken();
    try {
      const [rows] = await pool.query('SELECT file_path FROM documents WHERE document_id = ?', [documentId]);
      const doc = (rows as any[])[0];
      if (!doc || !doc.file_path) {
        throw new Error('Document not found in database.');
      }

      const oneDriveItemId = doc.file_path.replace('onedrive://', '');

      const metadataResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${oneDriveItemId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      return metadataResponse.data;
    } catch (error) {
      console.error('OneDrive getMetadata error:', error);
      throw new Error('Failed to get metadata from OneDrive');
    }
  }

  async delete(documentId: string): Promise<void> {
    const accessToken = await this.getValidAccessToken();
    try {
      const [rows] = await pool.query('SELECT file_path FROM documents WHERE document_id = ?', [documentId]);
      const doc = (rows as any[])[0];
      if (!doc || !doc.file_path) {
        throw new Error('Document not found in database.');
      }

      const oneDriveItemId = doc.file_path.replace('onedrive://', '');

      await axios.delete(
        `https://graph.microsoft.com/v1.0/me/drive/items/${oneDriveItemId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
    } catch (error) {
      console.error('OneDrive delete error:', error);
      throw new Error('Failed to delete file from OneDrive');
    }
  }
}