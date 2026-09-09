import { db } from '../db/database';
import {
  BackupData,
  BackupValidationResult,
  ImportMode,
  ImportResult,
  Employee,
  AttendanceRecord,
  LeaveType,
  LeaveRecord,
  Holiday,
  FinalizedSalaryRecord,
  AppSettingEntry,
} from '../types';
import { SettingsRepository } from '../repositories/settingsRepository';

export class BackupService {
  /**
   * Generates a complete database JSON export
   */
  static async exportFullBackup(): Promise<BackupData> {
    const employees = await db.employees.toArray();
    const attendance = await db.attendance.toArray();
    const leaveTypes = await db.leave_types.toArray();
    const leaves = await db.leaves.toArray();
    const holidays = await db.holidays.toArray();
    const salaryRecords = await db.salary_records.toArray();
    const settings = await db.settings.toArray();

    const now = new Date().toISOString();

    const backupData: BackupData = {
      appName: 'StaffPay',
      backupVersion: '1.0',
      appVersion: '1.0.0',
      databaseVersion: db.verno,
      exportedAt: now,
      employees,
      attendance,
      leaveTypes,
      leaves,
      holidays,
      salaryRecords,
      settings,
    };

    // Update backup meta timestamp
    await SettingsRepository.updateBackupMeta({
      lastBackupAt: now,
    });

    return backupData;
  }

  /**
   * Downloads the backup as a timestamped JSON file
   */
  static downloadBackupFile(backupData: BackupData): void {
    const dateStr = backupData.exportedAt.split('T')[0];
    const filename = `staffpay-backup-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Parses and validates uploaded backup JSON text
   */
  static validateBackupJSON(jsonString: string): BackupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e: any) {
      return {
        isValid: false,
        errors: [`Invalid JSON file format: ${e.message}`],
        warnings: [],
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        isValid: false,
        errors: ['The backup file does not contain a valid JSON object.'],
        warnings: [],
      };
    }

    // Version & App check
    if (parsed.appName !== 'StaffPay' && !parsed.backupVersion) {
      warnings.push('This file does not have the standard StaffPay header. Attempting to validate tables...');
    }

    // Required tables validation
    const employees = Array.isArray(parsed.employees) ? parsed.employees : null;
    const attendance = Array.isArray(parsed.attendance) ? parsed.attendance : null;
    const leaveTypes = Array.isArray(parsed.leaveTypes) ? parsed.leaveTypes : (Array.isArray(parsed.leave_types) ? parsed.leave_types : []);
    const leaves = Array.isArray(parsed.leaves) ? parsed.leaves : [];
    const holidays = Array.isArray(parsed.holidays) ? parsed.holidays : [];
    const salaryRecords = Array.isArray(parsed.salaryRecords) ? parsed.salaryRecords : (Array.isArray(parsed.salary_records) ? parsed.salary_records : []);
    const settings = Array.isArray(parsed.settings) ? parsed.settings : [];

    if (!employees) {
      errors.push('Missing or invalid "employees" array in backup.');
    } else {
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        if (!emp.employeeId || !emp.fullName) {
          errors.push(`Employee at index ${i} is missing required employeeId or fullName.`);
          break;
        }
      }
    }

    if (!attendance) {
      errors.push('Missing or invalid "attendance" array in backup.');
    } else {
      for (let i = 0; i < Math.min(attendance.length, 50); i++) {
        const att = attendance[i];
        if (!att.employeeId || !att.date) {
          errors.push(`Attendance record at index ${i} is missing employeeId or date.`);
          break;
        }
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    return {
      isValid: true,
      errors: [],
      warnings,
      summary: {
        backupVersion: parsed.backupVersion || '1.0',
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        employeeCount: employees ? employees.length : 0,
        attendanceCount: attendance ? attendance.length : 0,
        leaveTypeCount: leaveTypes ? leaveTypes.length : 0,
        leaveCount: leaves ? leaves.length : 0,
        holidayCount: holidays ? holidays.length : 0,
        salaryRecordCount: salaryRecords ? salaryRecords.length : 0,
        settingsCount: settings ? settings.length : 0,
      },
    };
  }

  /**
   * Imports validated backup data with Merge or Replace mode
   */
  static async importBackup(backupData: BackupData, mode: ImportMode): Promise<ImportResult> {
    const importedCounts = {
      employees: 0,
      attendance: 0,
      leaveTypes: 0,
      leaves: 0,
      holidays: 0,
      salaryRecords: 0,
      settings: 0,
    };

    const skippedCounts = {
      employees: 0,
      attendance: 0,
      leaveTypes: 0,
      leaves: 0,
      holidays: 0,
      salaryRecords: 0,
    };

    const employees = backupData.employees || [];
    const attendance = backupData.attendance || [];
    const leaveTypes = backupData.leaveTypes || (backupData as any).leave_types || [];
    const leaves = backupData.leaves || [];
    const holidays = backupData.holidays || [];
    const salaryRecords = backupData.salaryRecords || (backupData as any).salary_records || [];
    const settings = backupData.settings || [];

    if (mode === 'replace') {
      // Safe transactional wipe & re-populate
      await db.transaction(
        'rw',
        [
          db.employees,
          db.attendance,
          db.leave_types,
          db.leaves,
          db.holidays,
          db.salary_records,
          db.settings,
        ],
        async () => {
          await db.employees.clear();
          await db.attendance.clear();
          await db.leave_types.clear();
          await db.leaves.clear();
          await db.holidays.clear();
          await db.salary_records.clear();
          await db.settings.clear();

          if (employees.length > 0) {
            // Strip autoincrement ID if needed or preserve
            await db.employees.bulkAdd(employees);
            importedCounts.employees = employees.length;
          }
          if (attendance.length > 0) {
            // Ensure composite ID is present
            const preparedAttendance = attendance.map(a => ({
              ...a,
              id: a.id || `${a.employeeId}_${a.date}`,
            }));
            await db.attendance.bulkAdd(preparedAttendance);
            importedCounts.attendance = preparedAttendance.length;
          }
          if (leaveTypes.length > 0) {
            await db.leave_types.bulkAdd(leaveTypes);
            importedCounts.leaveTypes = leaveTypes.length;
          }
          if (leaves.length > 0) {
            await db.leaves.bulkAdd(leaves);
            importedCounts.leaves = leaves.length;
          }
          if (holidays.length > 0) {
            await db.holidays.bulkAdd(holidays);
            importedCounts.holidays = holidays.length;
          }
          if (salaryRecords.length > 0) {
            const preparedSalary = salaryRecords.map(s => ({
              ...s,
              id: s.id || `${s.employeeId}_${s.year}_${String(s.month).padStart(2, '0')}`,
            }));
            await db.salary_records.bulkAdd(preparedSalary);
            importedCounts.salaryRecords = preparedSalary.length;
          }
          if (settings.length > 0) {
            await db.settings.bulkAdd(settings);
            importedCounts.settings = settings.length;
          }
        }
      );
    } else {
      // MERGE MODE (Default) - Safe duplicate-free upsert
      await db.transaction(
        'rw',
        [
          db.employees,
          db.attendance,
          db.leave_types,
          db.leaves,
          db.holidays,
          db.salary_records,
          db.settings,
        ],
        async () => {
          // Merge Employees by employeeId
          const existingEmployees = await db.employees.toArray();
          const existingEmpMap = new Map(existingEmployees.map(e => [e.employeeId, e]));

          for (const emp of employees) {
            const existing = existingEmpMap.get(emp.employeeId);
            if (existing && existing.id) {
              await db.employees.update(existing.id, {
                fullName: emp.fullName,
                phone: emp.phone,
                email: emp.email,
                address: emp.address,
                designation: emp.designation,
                joiningDate: emp.joiningDate,
                endDate: emp.endDate,
                monthlySalary: emp.monthlySalary,
                status: emp.status,
                notes: emp.notes,
                photoUrl: emp.photoUrl || existing.photoUrl,
                updatedAt: emp.updatedAt || new Date().toISOString(),
              });
              importedCounts.employees++;
            } else {
              const { id, ...rest } = emp;
              await db.employees.add({
                ...rest,
                createdAt: emp.createdAt || new Date().toISOString(),
                updatedAt: emp.updatedAt || new Date().toISOString(),
              });
              importedCounts.employees++;
            }
          }

          // Merge Attendance by composite key `${employeeId}_${date}`
          const preparedAttendance: AttendanceRecord[] = [];
          for (const att of attendance) {
            const id = att.id || `${att.employeeId}_${att.date}`;
            preparedAttendance.push({
              ...att,
              id,
              updatedAt: att.updatedAt || new Date().toISOString(),
            });
          }
          if (preparedAttendance.length > 0) {
            await db.attendance.bulkPut(preparedAttendance);
            importedCounts.attendance = preparedAttendance.length;
          }

          // Merge Holidays by date
          const existingHolidays = await db.holidays.toArray();
          const existingHolidayDates = new Set(existingHolidays.map(h => h.date));
          const newHolidays: Holiday[] = [];
          for (const h of holidays) {
            if (existingHolidayDates.has(h.date)) {
              skippedCounts.holidays++;
            } else {
              const { id, ...rest } = h;
              newHolidays.push(rest as Holiday);
              importedCounts.holidays++;
            }
          }
          if (newHolidays.length > 0) {
            await db.holidays.bulkAdd(newHolidays);
          }

          // Merge Leave Types by name
          const existingTypes = await db.leave_types.toArray();
          const existingTypeNames = new Set(existingTypes.map(t => t.name.toLowerCase()));
          const newTypes: LeaveType[] = [];
          for (const lt of leaveTypes) {
            if (existingTypeNames.has(lt.name.toLowerCase())) {
              skippedCounts.leaveTypes++;
            } else {
              const { id, ...rest } = lt;
              newTypes.push(rest as LeaveType);
              importedCounts.leaveTypes++;
            }
          }
          if (newTypes.length > 0) {
            await db.leave_types.bulkAdd(newTypes);
          }

          // Merge Salary Records by composite key `${employeeId}_${year}_${month}`
          const preparedSalary: FinalizedSalaryRecord[] = [];
          for (const s of salaryRecords) {
            const id = s.id || `${s.employeeId}_${s.year}_${String(s.month).padStart(2, '0')}`;
            preparedSalary.push({
              ...s,
              id,
              updatedAt: s.updatedAt || new Date().toISOString(),
            });
          }
          if (preparedSalary.length > 0) {
            await db.salary_records.bulkPut(preparedSalary);
            importedCounts.salaryRecords = preparedSalary.length;
          }

          // Merge Settings
          if (settings.length > 0) {
            await db.settings.bulkPut(settings);
            importedCounts.settings = settings.length;
          }
        }
      );
    }

    // Update last import timestamp
    await SettingsRepository.updateBackupMeta({
      lastImportAt: new Date().toISOString(),
    });

    return {
      success: true,
      mode,
      importedCounts,
      skippedCounts,
      message: `Backup imported successfully (${mode === 'merge' ? 'Merged with existing data' : 'Replaced local database'}).`,
    };
  }

  /**
   * Dangerous operation: Clear all local data with safety check
   */
  static async clearAllLocalData(): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.employees,
        db.attendance,
        db.leave_types,
        db.leaves,
        db.holidays,
        db.salary_records,
      ],
      async () => {
        await db.employees.clear();
        await db.attendance.clear();
        await db.leave_types.clear();
        await db.leaves.clear();
        await db.holidays.clear();
        await db.salary_records.clear();
      }
    );
  }
}
