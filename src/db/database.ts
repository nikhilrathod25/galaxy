import Dexie, { Table } from 'dexie';
import {
  Employee,
  AttendanceRecord,
  LeaveType,
  LeaveRecord,
  Holiday,
  FinalizedSalaryRecord,
  AppSettingEntry,
} from '../types';

export class StaffPayDatabase extends Dexie {
  employees!: Table<Employee, number>;
  attendance!: Table<AttendanceRecord, string>;
  leave_types!: Table<LeaveType, number>;
  leaves!: Table<LeaveRecord, number>;
  holidays!: Table<Holiday, number>;
  salary_records!: Table<FinalizedSalaryRecord, string>;
  settings!: Table<AppSettingEntry, string>;

  constructor() {
    super('StaffPayDB');

    // Schema version 1
    this.version(1).stores({
      employees: '++id, &employeeId, fullName, status, designation, joiningDate, endDate, createdAt, updatedAt',
      attendance: 'id, employeeId, date, status, updatedAt',
      leave_types: '++id, &name, isPaid',
      leaves: '++id, employeeId, startDate, endDate, leaveTypeId',
      holidays: '++id, &date, year',
      salary_records: 'id, employeeId, year, month, [employeeId+year+month]',
      settings: '&key, updatedAt',
    });

    // Populate initial default configurations on first database creation
    this.on('populate', async () => {
      // Default Leave Types
      await this.leave_types.bulkAdd([
        { name: 'Paid Leave', isPaid: true, description: 'Standard paid leave', isDefault: true },
        { name: 'Casual Leave', isPaid: true, description: 'Casual / Sick Leave', isDefault: true },
        { name: 'Unpaid Leave', isPaid: false, description: 'Leave without pay / Loss of Pay', isDefault: true },
      ]);

      // Default Settings
      await this.settings.bulkAdd([
        {
          key: 'company_info',
          value: {
            companyName: 'My Business',
            tagline: 'Employee Attendance & Salary Management',
            address: 'Main Road, Business Park, City',
            phone: '+91 98765 43210',
            email: 'admin@mybusiness.com',
            authorizedSignatory: 'Authorized Signatory',
          },
          updatedAt: new Date().toISOString(),
        },
        {
          key: 'salary_settings',
          value: {
            defaultCalculationMode: 'working_days', // 'working_days' | 'calendar_days'
            workingDaysPerWeek: 6, // Mon to Sat
            excludeSundays: true,
            excludeHolidays: true,
          },
          updatedAt: new Date().toISOString(),
        },
        {
          key: 'app_preferences',
          value: {
            theme: 'light',
            currencySymbol: '₹',
            currencyCode: 'INR',
            dateFormat: 'dd/MM/yyyy',
          },
          updatedAt: new Date().toISOString(),
        },
        {
          key: 'auth_settings',
          value: {
            pinEnabled: false,
            pinHash: '', // empty means no PIN set yet
          },
          updatedAt: new Date().toISOString(),
        },
        {
          key: 'backup_meta',
          value: {
            lastBackupAt: null,
            lastImportAt: null,
            exportCount: 0,
          },
          updatedAt: new Date().toISOString(),
        },
      ]);
    });
  }
}

export const db = new StaffPayDatabase();
