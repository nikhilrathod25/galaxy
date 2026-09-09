import { Employee } from './employee';
import { AttendanceRecord } from './attendance';
import { LeaveType, LeaveRecord } from './leave';
import { Holiday } from './holiday';
import { FinalizedSalaryRecord } from './salary';
import { AppSettingEntry } from './settings';

export interface BackupData {
  backupVersion: string; // e.g. "1.0"
  appVersion: string; // e.g. "1.0.0"
  databaseVersion: number; // e.g. 1
  exportedAt: string; // ISO string
  appName: 'StaffPay';
  
  // Database stores
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaveTypes: LeaveType[];
  leaves: LeaveRecord[];
  holidays: Holiday[];
  salaryRecords: FinalizedSalaryRecord[];
  settings: AppSettingEntry[];
}

export type ImportMode = 'merge' | 'replace';

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary?: {
    backupVersion: string;
    exportedAt: string;
    employeeCount: number;
    attendanceCount: number;
    leaveTypeCount: number;
    leaveCount: number;
    holidayCount: number;
    salaryRecordCount: number;
    settingsCount: number;
  };
}

export interface ImportResult {
  success: boolean;
  mode: ImportMode;
  importedCounts: {
    employees: number;
    attendance: number;
    leaveTypes: number;
    leaves: number;
    holidays: number;
    salaryRecords: number;
    settings: number;
  };
  skippedCounts: {
    employees: number;
    attendance: number;
    leaveTypes: number;
    leaves: number;
    holidays: number;
    salaryRecords: number;
  };
  message: string;
}
