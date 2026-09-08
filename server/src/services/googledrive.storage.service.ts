import { IStorageProvider } from './storage.service.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';


import { refreshGoogleDriveToken } from './oauth.service.js';
import pool from '../config/database.js';

export class GoogleDriveStorageProvider implements IStorageProvider {
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
  }

  private async getValidAccessToken(): Promise<string> {
    const [rows] = await pool.query('SELECT googledrive_refresh_token FROM users WHERE id = ?', [this.userId]);
    const user: any = (rows as any[])[0];

    if (!user || !user.googledrive_refresh_token) {
      throw new Error('Google Drive refresh token not found for user.');
    }

    const { accessToken, refreshToken: newRefreshToken } = await refreshGoogleDriveToken(user.googledrive_refresh_token);

    if (newRefreshToken && newRefreshToken !== user.googledrive_refresh_token) {
      await pool.query('UPDATE users SET googledrive_access_token = ?, googledrive_refresh_token = ? WHERE id = ?', [accessToken, newRefreshToken, this.userId]);
    } else {
      await pool.query('UPDATE users SET googledrive_access_token = ? WHERE id = ?', [accessToken, this.userId]);
    }

    return accessToken;
  }
  async upload(file: Express.Multer.File): Promise<{ filePath: string; storageType: string; documentId: string }> {
    const accessToken = await this.getValidAccessToken();
    const documentIdStr = uuidv4();
    const fileName = file.originalname;

    try {
      const uploadResponse = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          name: `${documentIdStr}-${fileName}`,
          mimeType: file.mimetype,
          parents: ['root'], // Upload to root folder for now
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        }
      );

      const fileId = uploadResponse.data.id;

      await axios.patch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        file.buffer,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': file.mimetype,
          },
        }
      );

      const filePath = `googledrive://${fileId}`;
      return { filePath, storageType: 'googledrive', documentId: documentIdStr };
    } catch (error) {
      console.error('Google Drive upload error:', error);
      throw new Error('Failed to upload file to Google Drive', { cause: error });
    }
  }

  async download(documentId: string): Promise<{ filePath: string; fileName: string }> {
    const accessToken = await this.getValidAccessToken();
    const fileId = documentId.replace('googledrive://', '');

    try {
      const metadataResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            fields: 'name,mimeType',
          },
        }
      );

      const fileName = metadataResponse.data.name;

      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          responseType: 'stream',
        }
      );

      const tempFilePath = path.join(process.cwd(), 'uploads', fileName);
      const writer = fs.createWriteStream(tempFilePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ filePath: tempFilePath, fileName }));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('Google Drive download error:', error);
      throw new Error('Failed to download file from Google Drive', { cause: error });
    }
  }

  async preview(documentId: string): Promise<{ filePath: string; fileName: string }> {
    // For preview, we can leverage the download functionality to get a local file path
    // Alternatively, we could try to get a web-view link if Google Drive provides one
    // For now, we'll download the file for preview.
    return this.download(documentId);
  }

  async getMetadata(documentId: string): Promise<any> {
    const accessToken = await this.getValidAccessToken();
    const fileId = documentId.replace('googledrive://', '');

    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            fields: 'id,name,mimeType,size,createdTime,modifiedTime,webContentLink,webViewLink',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Google Drive getMetadata error:', error);
      throw new Error('Failed to get metadata from Google Drive', { cause: error });
    }
  }

  async delete(documentId: string): Promise<void> {
    const accessToken = await this.getValidAccessToken();
    const fileId = documentId.replace('googledrive://', '');

    try {
      await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
    } catch (error) {
      console.error('Google Drive delete error:', error);
      throw new Error('Failed to delete file from Google Drive', { cause: error });
    }
  }

  async getSignedUrl?(documentId: string, action: 'read' | 'write'): Promise<string> {
    const accessToken = await this.getValidAccessToken();
    const fileId = documentId.replace('googledrive://', '');

    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            fields: 'webContentLink,webViewLink',
          },
        }
      );

      if (action === 'read') {
        if (response.data.webContentLink) {
          return response.data.webContentLink;
        } else if (response.data.webViewLink) {
          return response.data.webViewLink;
        } else {
          throw new Error('No direct content or view link available for read action.');
        }
      } else if (action === 'write') {
        throw new Error('Google Drive does not support signed URLs for write actions directly.');
      } else {
        throw new Error('Invalid action for getSignedUrl.');
      }
    } catch (error) {
      console.error('Google Drive getSignedUrl error:', error);
      throw new Error('Failed to get signed URL from Google Drive', { cause: error });
    }
  }
}