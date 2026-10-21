import axios from 'axios';
import { isConfigured } from '../config/env.js';

export const refreshOneDriveToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const client_id = process.env.ONEDRIVE_CLIENT_ID;
  const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;

  if (!isConfigured(client_id) || !isConfigured(client_secret)) {
    throw new Error('OneDrive is not configured: set ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET');
  }

  try {
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: client_id as string,
        client_secret: client_secret as string,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token: new_refresh_token } = tokenResponse.data;
    return { accessToken: access_token, refreshToken: new_refresh_token || refreshToken };
  } catch (error) {
    console.error('Error refreshing OneDrive token:', error);
    throw new Error('Failed to refresh OneDrive token', { cause: error });
  }
};

export const refreshGoogleDriveToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const client_id = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (!isConfigured(client_id) || !isConfigured(client_secret)) {
    throw new Error('Google Drive is not configured: set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET');
  }

  try {
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: client_id as string,
        client_secret: client_secret as string,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token: new_refresh_token } = tokenResponse.data;
    return { accessToken: access_token, refreshToken: new_refresh_token || refreshToken };
  } catch (error) {
    console.error('Error refreshing Google Drive token:', error);
    throw new Error('Failed to refresh Google Drive token', { cause: error });
  }
};