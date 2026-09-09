import { db } from '../db/database';
import {
  CompanySettings,
  SalarySettings,
  AppPreferences,
  AuthSettings,
} from '../types';
import { FirebaseSyncService } from '../services/firebaseSyncService';

export class SettingsRepository {
  static async get<T>(key: string, defaultValue: T): Promise<T> {
    const entry = await db.settings.get(key);
    if (!entry || entry.value === undefined) {
      return defaultValue;
    }
    return entry.value as T;
  }

  static async set<T>(key: string, value: T): Promise<void> {
    await db.settings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
    FirebaseSyncService.notifyMutation();
  }

  static async getCompanySettings(): Promise<CompanySettings> {
    return this.get<CompanySettings>('company_info', {
      companyName: 'StaffPay Business',
      tagline: 'Employee Attendance & Salary Management',
      address: 'Main Road, Business Hub',
      phone: '+91 98765 43210',
      email: 'admin@staffpay.local',
      authorizedSignatory: 'Authorized Signatory',
    });
  }

  static async saveCompanySettings(settings: CompanySettings): Promise<void> {
    await this.set('company_info', settings);
  }

  static async getSalarySettings(): Promise<SalarySettings> {
    return this.get<SalarySettings>('salary_settings', {
      defaultCalculationMode: 'working_days',
      workingDaysPerWeek: 6,
      excludeSundays: true,
      excludeHolidays: true,
    });
  }

  static async saveSalarySettings(settings: SalarySettings): Promise<void> {
    await this.set('salary_settings', settings);
  }

  static async getAppPreferences(): Promise<AppPreferences> {
    return this.get<AppPreferences>('app_preferences', {
      theme: 'light',
      currencySymbol: '₹',
      currencyCode: 'INR',
      dateFormat: 'dd/MM/yyyy',
    });
  }

  static async saveAppPreferences(preferences: AppPreferences): Promise<void> {
    await this.set('app_preferences', preferences);
  }

  static async getAuthSettings(): Promise<AuthSettings> {
    return this.get<AuthSettings>('auth_settings', {
      pinEnabled: false,
      pinHash: '',
    });
  }

  static async saveAuthSettings(settings: AuthSettings): Promise<void> {
    await this.set('auth_settings', settings);
  }

  static async getBackupMeta(): Promise<{
    lastBackupAt: string | null;
    lastImportAt: string | null;
    exportCount: number;
  }> {
    return this.get('backup_meta', {
      lastBackupAt: null,
      lastImportAt: null,
      exportCount: 0,
    });
  }

  static async updateBackupMeta(meta: Partial<{
    lastBackupAt: string | null;
    lastImportAt: string | null;
    exportCount: number;
  }>): Promise<void> {
    const current = await this.getBackupMeta();
    await this.set('backup_meta', { ...current, ...meta });
  }
}
