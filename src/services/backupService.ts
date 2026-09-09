import { EmployeeService } from './employeeService';
import { AttendanceService } from './attendanceService';
import { LeaveService } from './leaveService';
import { HolidayService } from './holidayService';
import { SalaryService } from './salaryService';
import { SettingsService } from './settingsService';
import {
  BackupData,
  ImportResult,
  ImportMode,
  BackupValidationResult,
} from '../types/backup';

export class BackupService {
  /**
   * Validates a raw JSON backup string
   */
  static validateBackupJSON(jsonStr: string): BackupValidationResult {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') {
        return {
          isValid: false,
          errors: ['File content is not a valid JSON object.'],
          warnings: [],
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!Array.isArray(parsed.employees)) {
        errors.push('Missing "employees" array in backup file.');
      }
      if (!Array.isArray(parsed.attendance)) {
        errors.push('Missing "attendance" array in backup file.');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        summary: {
          backupVersion: parsed.backupVersion || '1.0',
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          employeeCount: Array.isArray(parsed.employees) ? parsed.employees.length : 0,
          attendanceCount: Array.isArray(parsed.attendance) ? parsed.attendance.length : 0,
          leaveTypeCount: Array.isArray(parsed.leaveTypes) ? parsed.leaveTypes.length : 0,
          leaveCount: Array.isArray(parsed.leaves) ? parsed.leaves.length : 0,
          holidayCount: Array.isArray(parsed.holidays) ? parsed.holidays.length : 0,
          salaryRecordCount: Array.isArray(parsed.salaryRecords) ? parsed.salaryRecords.length : 0,
          settingsCount: Array.isArray(parsed.settings) ? parsed.settings.length : 0,
        },
      };
    } catch (e: any) {
      return {
        isValid: false,
        errors: ['Invalid JSON syntax: ' + (e.message || 'parse error')],
        warnings: [],
      };
    }
  }

  /**
   * Exports complete database from Supabase Cloud to JSON
   */
  static async exportBackup(): Promise<BackupData> {
    const [employees, leaveTypes, leaves, holidays, salaryRecords, companySettings, salarySettings] =
      await Promise.all([
        EmployeeService.getAll(),
        LeaveService.getAllLeaveTypes(),
        LeaveService.getAllLeaves(),
        HolidayService.getAll(),
        SalaryService.getAll(),
        SettingsService.getCompanySettings(),
        SettingsService.getSalarySettings(),
      ]);

    const attendance = await AttendanceService.getByDateRange('2000-01-01', '2099-12-31');

    const backup: BackupData = {
      backupVersion: '1.0',
      appVersion: '1.0.0',
      databaseVersion: 2,
      exportedAt: new Date().toISOString(),
      appName: 'StaffPay',
      employees,
      attendance,
      leaveTypes,
      leaves,
      holidays,
      salaryRecords,
      settings: [
        { key: 'company_info', value: companySettings, updatedAt: new Date().toISOString() },
        { key: 'salary_settings', value: salarySettings, updatedAt: new Date().toISOString() },
      ],
    };

    return backup;
  }

  // Alias
  static async exportFullBackup(): Promise<BackupData> {
    return this.exportBackup();
  }

  /**
   * Imports backup data directly into Supabase Cloud
   */
  static async importBackup(backup: BackupData, mode: ImportMode = 'merge'): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      mode,
      importedCounts: {
        employees: 0,
        attendance: 0,
        leaveTypes: 0,
        leaves: 0,
        holidays: 0,
        salaryRecords: 0,
        settings: 0,
      },
      skippedCounts: {
        employees: 0,
        attendance: 0,
        leaveTypes: 0,
        leaves: 0,
        holidays: 0,
        salaryRecords: 0,
      },
      message: '',
    };

    try {
      const employees = backup.employees || [];
      const attendance = backup.attendance || [];
      const leaveTypes = backup.leaveTypes || [];
      const leaves = backup.leaves || [];
      const holidays = backup.holidays || [];
      const salaryRecords = backup.salaryRecords || [];

      // 1. Import Leave Types
      for (const lt of leaveTypes) {
        try {
          await LeaveService.createLeaveType(lt);
          result.importedCounts.leaveTypes++;
        } catch {
          result.skippedCounts.leaveTypes++;
        }
      }

      // 2. Import Employees
      for (const emp of employees) {
        try {
          await EmployeeService.create(emp);
          result.importedCounts.employees++;
        } catch {
          result.skippedCounts.employees++;
        }
      }

      // 3. Import Attendance
      if (attendance.length > 0) {
        await AttendanceService.bulkSetStatus(attendance);
        result.importedCounts.attendance = attendance.length;
      }

      // 4. Import Leaves
      for (const l of leaves) {
        try {
          await LeaveService.createLeave(l);
          result.importedCounts.leaves++;
        } catch {
          result.skippedCounts.leaves++;
        }
      }

      // 5. Import Holidays
      for (const h of holidays) {
        try {
          await HolidayService.create(h);
          result.importedCounts.holidays++;
        } catch {
          result.skippedCounts.holidays++;
        }
      }

      // 6. Import Salary Records
      for (const s of salaryRecords) {
        try {
          await SalaryService.saveFinalizedRecord(s);
          result.importedCounts.salaryRecords++;
        } catch {
          result.skippedCounts.salaryRecords++;
        }
      }

      // 7. Import Settings
      if (backup.settings && Array.isArray(backup.settings)) {
        for (const st of backup.settings) {
          if (st.key && st.value) {
            await SettingsService.set(st.key, st.value);
            result.importedCounts.settings++;
          }
        }
      }

      result.success = true;
      result.message = `Successfully imported ${result.importedCounts.employees} employees and ${result.importedCounts.attendance} attendance records.`;
      return result;
    } catch (err: any) {
      result.success = false;
      result.message = err.message || 'Import failed';
      return result;
    }
  }

  /**
   * Gets database summary counts from Supabase
   */
  static async getSummary() {
    const [employees, attendance, leaves, holidays, salaryRecords] = await Promise.all([
      EmployeeService.count(),
      AttendanceService.count(),
      LeaveService.count(),
      HolidayService.count(),
      SalaryService.count(),
    ]);

    return {
      employees,
      attendance,
      leaves,
      holidays,
      salaryRecords,
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Triggers browser download of backup JSON file
   */
  static downloadBackupFile(backup: BackupData): void {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `StaffPay_Cloud_Backup_${dateStr}.json`;
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
