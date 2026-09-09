import { supabase } from './supabase';
import { CompanySettings, SalarySettings, AppPreferences, AuthSettings } from '../types';

export class SettingsService {
  static async get<T>(key: string, defaultValue: T): Promise<T> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data || data.value === undefined) {
      return defaultValue;
    }
    return data.value as T;
  }

  static async set<T>(key: string, value: T): Promise<void> {
    const { error } = await supabase.from('settings').upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.error(`Error saving setting "${key}" to Supabase:`, error);
      throw new Error(error.message || 'Failed to save setting to cloud.');
    }
  }

  static async getCompanySettings(): Promise<CompanySettings> {
    return this.get<CompanySettings>('company_info', {
      companyName: 'StaffPay Business',
      tagline: 'Employee Attendance & Salary Management',
      address: 'Main Road, Business Hub',
      phone: '+91 98765 43210',
      email: 'admin@staffpay.app',
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

  static async updateBackupMeta(
    meta: Partial<{
      lastBackupAt: string | null;
      lastImportAt: string | null;
      exportCount: number;
    }>
  ): Promise<void> {
    const current = await this.getBackupMeta();
    await this.set('backup_meta', { ...current, ...meta });
  }
}
