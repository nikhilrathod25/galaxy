import { SettingsService } from '../services/settingsService';
import {
  CompanySettings,
  SalarySettings,
  AppPreferences,
  AuthSettings,
} from '../types';

export class SettingsRepository {
  static async get<T>(key: string, defaultValue: T): Promise<T> {
    return SettingsService.get<T>(key, defaultValue);
  }

  static async set<T>(key: string, value: T): Promise<void> {
    return SettingsService.set<T>(key, value);
  }

  static async getCompanySettings(): Promise<CompanySettings> {
    return SettingsService.getCompanySettings();
  }

  static async saveCompanySettings(settings: CompanySettings): Promise<void> {
    return SettingsService.saveCompanySettings(settings);
  }

  static async getSalarySettings(): Promise<SalarySettings> {
    return SettingsService.getSalarySettings();
  }

  static async saveSalarySettings(settings: SalarySettings): Promise<void> {
    return SettingsService.saveSalarySettings(settings);
  }

  static async getAppPreferences(): Promise<AppPreferences> {
    return SettingsService.getAppPreferences();
  }

  static async saveAppPreferences(preferences: AppPreferences): Promise<void> {
    return SettingsService.saveAppPreferences(preferences);
  }

  static async getAuthSettings(): Promise<AuthSettings> {
    return SettingsService.getAuthSettings();
  }

  static async saveAuthSettings(settings: AuthSettings): Promise<void> {
    return SettingsService.saveAuthSettings(settings);
  }

  static async getBackupMeta(): Promise<{
    lastBackupAt: string | null;
    lastImportAt: string | null;
    exportCount: number;
  }> {
    return SettingsService.getBackupMeta();
  }

  static async updateBackupMeta(
    meta: Partial<{
      lastBackupAt: string | null;
      lastImportAt: string | null;
      exportCount: number;
    }>
  ): Promise<void> {
    return SettingsService.updateBackupMeta(meta);
  }
}
