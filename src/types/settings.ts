import { SalaryCalculationMode } from './salary';

export interface CompanySettings {
  companyName: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string; // base64
  authorizedSignatory?: string;
}

export interface SalarySettings {
  defaultCalculationMode: SalaryCalculationMode;
  workingDaysPerWeek: number; // default 6 (Mon-Sat)
  excludeSundays: boolean; // default true
  excludeHolidays: boolean; // default true
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  currencySymbol: string; // default "₹"
  currencyCode: string; // default "INR"
  dateFormat: string; // default "dd/MM/yyyy"
}

export interface AuthSettings {
  pinEnabled: boolean;
  pinHash: string; // client-side hashed or encoded PIN
  lastLoginAt?: string;
}

export interface AppSettingEntry {
  key: string; // e.g. "company_info", "salary_settings", "app_preferences", "auth_settings", "backup_meta"
  value: any;
  updatedAt: string;
}
