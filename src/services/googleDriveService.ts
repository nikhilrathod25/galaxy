import { GoogleAuthService } from './googleAuthService';
import { CloudDatabase } from '../types/cloud';

const DEFAULT_DATABASE_FILE_NAME = 'staffpay-database.json';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFileInfo {
  id: string;
  name: string;
  version?: string;
  modifiedTime: string;
  size?: string;
}

export class GoogleDriveService {
  static getFileName(accountId?: string): string {
    if (accountId && accountId.trim().length > 0) {
      return `staffpay-database-${accountId.trim()}.json`;
    }
    return DEFAULT_DATABASE_FILE_NAME;
  }

  /**
   * Helper to perform authenticated Google Drive fetch calls
   */
  private static async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await GoogleAuthService.ensureValidToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Token might be expired, try refreshing once
      const refreshedToken = await GoogleAuthService.ensureValidToken();
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      return fetch(url, {
        ...options,
        headers,
      });
    }

    return res;
  }

  /**
   * Finds the StaffPay database file in the user's Google Drive appDataFolder
   */
  static async findDatabaseFile(accountId?: string): Promise<DriveFileInfo | null> {
    const fileName = this.getFileName(accountId);
    const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
    const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=${query}&fields=files(id,name,version,modifiedTime,size)&pageSize=1`;

    const res = await this.fetchWithAuth(url);
    if (!res.ok) {
      throw new Error(`Google Drive search failed (${res.status} ${res.statusText})`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0] as DriveFileInfo;
    }

    // Fallback: If searching by accountId and not found, check if generic file exists
    if (accountId) {
      const fallbackQuery = encodeURIComponent(`name = '${DEFAULT_DATABASE_FILE_NAME}' and trashed = false`);
      const fallbackUrl = `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=${fallbackQuery}&fields=files(id,name,version,modifiedTime,size)&pageSize=1`;
      const fallbackRes = await this.fetchWithAuth(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (fallbackData.files && fallbackData.files.length > 0) {
          return fallbackData.files[0] as DriveFileInfo;
        }
      }
    }

    return null;
  }

  /**
   * Downloads and parses the database JSON file from Google Drive
   */
  static async downloadDatabase(fileId: string): Promise<CloudDatabase> {
    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      throw new Error(`Failed to download database from Google Drive (${res.status} ${res.statusText})`);
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text) as CloudDatabase;
      return data;
    } catch (e: any) {
      throw new Error(`Cloud database file contains invalid JSON: ${e.message}`);
    }
  }

  /**
   * Creates a new database file in appDataFolder with multipart upload
   */
  static async createDatabase(data: CloudDatabase, accountId?: string): Promise<DriveFileInfo> {
    const fileName = this.getFileName(accountId || data.accountId);
    const metadata = {
      name: fileName,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(data, null, 2) +
      closeDelimiter;

    const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,version,modifiedTime,size`;
    const res = await this.fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create database in Google Drive: ${errText}`);
    }

    const created = await res.json();
    return created as DriveFileInfo;
  }

  /**
   * Updates existing database file in appDataFolder with atomic upload
   */
  static async updateDatabase(fileId: string, data: CloudDatabase, accountId?: string): Promise<DriveFileInfo> {
    const fileName = this.getFileName(accountId || data.accountId);
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(data, null, 2) +
      closeDelimiter;

    const url = `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=multipart&fields=id,name,version,modifiedTime,size`;
    const res = await this.fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update database in Google Drive: ${errText}`);
    }

    const updated = await res.json();
    return updated as DriveFileInfo;
  }
}
