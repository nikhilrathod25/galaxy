import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { SalaryRepository } from '../repositories/salaryRepository';
import { HolidayRepository } from '../repositories/holidayRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { calculateMonthlySalary } from './salaryEngine';

export const GOOGLE_DRIVE_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbw3d0CrrsQ-mTM_hvB1LwqkvjjOQixYHKTqotbE3PRKdkppxp0exRgLkc_PmT_70fND/exec';

let syncTimer: any = null;
let isSyncing = false;

export class GoogleDriveSyncService {
  /**
   * Migrate and upload all current system data directly to Google Drive / Sheets
   */
  static async syncAllToGoogleDrive(): Promise<{ success: boolean; message?: string }> {
    if (isSyncing) return { success: true };
    isSyncing = true;

    try {
      const [employees, allAttendance, allSalaries, holidays, companySettings, salarySettings] =
        await Promise.all([
          EmployeeRepository.getAll(),
          AttendanceRepository.getAll(),
          SalaryRepository.getAll(),
          HolidayRepository.getAll(),
          SettingsRepository.getCompanySettings(),
          SettingsRepository.getSalarySettings(),
        ]);

      // Format employees cleanly for Google Sheet
      const employeesSheet = employees.map((e: any) => ({
        id: e.id,
        employee_id: e.employeeId,
        full_name: e.fullName,
        designation: e.designation,
        phone: e.phone || '',
        email: e.email || '',
        address: e.address || '',
        joining_date: e.joiningDate || '',
        end_date: e.endDate || '',
        monthly_salary: e.monthlySalary || 0,
        overtime_rate: e.overtimeRate || '',
        status: e.status,
        notes: e.notes || '',
        created_at: e.createdAt || '',
        updated_at: e.updatedAt || '',
      }));

      // Format attendance
      const attendanceSheet = allAttendance.map((a: any) => ({
        id: a.id,
        employee_id: a.employeeId,
        date: a.date,
        status: a.status,
        overtime_hours: a.overtimeHours || 0,
        note: a.note || '',
        updated_at: a.updatedAt || '',
      }));

      // Calculate live salaries for all employees for current month and any month with attendance
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Group attendance by employee and year_month
      const finalizedMap = new Map<string, any>();
      allSalaries.forEach((s: any) => {
        finalizedMap.set(`${s.employeeId}_${s.year}_${s.month}`, s);
      });

      // Find all unique year-months from attendance or current month
      const monthYearSet = new Set<string>();
      monthYearSet.add(`${currentYear}-${currentMonth}`);
      allAttendance.forEach((a: any) => {
        if (a.date) {
          const parts = a.date.split('-');
          if (parts.length >= 2) {
            monthYearSet.add(`${parseInt(parts[0], 10)}-${parseInt(parts[1], 10)}`);
          }
        }
      });

      const salariesSheet: any[] = [];

      monthYearSet.forEach((ymStr) => {
        const [yStr, mStr] = ymStr.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);

        employees.forEach((emp: any) => {
          const key = `${emp.employeeId}_${y}_${m}`;
          const existingFinalized = finalizedMap.get(key);

          if (existingFinalized) {
            salariesSheet.push({
              id: existingFinalized.id,
              employee_id: existingFinalized.employeeId,
              employee_name: existingFinalized.employeeName,
              designation: existingFinalized.designation || '',
              year: existingFinalized.year,
              month: existingFinalized.month,
              monthly_salary: existingFinalized.monthlySalary,
              present_days: existingFinalized.presentDays,
              absent_days: existingFinalized.absentDays,
              half_days: existingFinalized.halfDays,
              paid_leave_days: existingFinalized.paidLeaveDays,
              unpaid_leave_days: existingFinalized.unpaidLeaveDays,
              overtime_hours: existingFinalized.totalOvertimeHours || 0,
              overtime_earnings: existingFinalized.overtimeEarnings || 0,
              absent_deduction: existingFinalized.absentDeduction,
              half_day_deduction: existingFinalized.halfDayDeduction,
              unpaid_leave_deduction: existingFinalized.unpaidLeaveDeduction,
              custom_deduction: existingFinalized.customDeduction || 0,
              total_deductions: existingFinalized.totalDeductions,
              final_salary: existingFinalized.finalSalary,
              status: existingFinalized.isFinalized ? 'Finalized' : 'Draft',
              finalized_at: existingFinalized.finalizedAt || '',
              notes: existingFinalized.notes || '',
              updated_at: existingFinalized.updatedAt || '',
            });
          } else {
            // Compute live draft breakdown
            const mStr2 = String(m).padStart(2, '0');
            const empAtt = allAttendance.filter(
              (a: any) => a.employeeId === emp.employeeId && a.date && a.date.startsWith(`${y}-${mStr2}`)
            );
            const calculated = calculateMonthlySalary({
              employee: emp,
              year: y,
              month: m,
              attendance: empAtt,
              holidays,
              calculationMode: salarySettings.defaultCalculationMode,
            });

            salariesSheet.push({
              id: `${emp.employeeId}_${y}_${mStr2}`,
              employee_id: emp.employeeId,
              employee_name: emp.fullName,
              designation: emp.designation || '',
              year: y,
              month: m,
              monthly_salary: emp.monthlySalary,
              present_days: calculated.presentDays,
              absent_days: calculated.absentDays,
              half_days: calculated.halfDays,
              paid_leave_days: calculated.paidLeaveDays,
              unpaid_leave_days: calculated.unpaidLeaveDays,
              overtime_hours: calculated.totalOvertimeHours || 0,
              overtime_earnings: calculated.overtimeEarnings || 0,
              absent_deduction: calculated.absentDeduction,
              half_day_deduction: calculated.halfDayDeduction,
              unpaid_leave_deduction: calculated.unpaidLeaveDeduction,
              custom_deduction: 0,
              total_deductions: calculated.totalDeductions,
              final_salary: calculated.finalSalary,
              status: 'Draft',
              finalized_at: '',
              notes: 'Live calculation',
              updated_at: new Date().toISOString(),
            });
          }
        });
      });

      // Format holidays
      const holidaysSheet = holidays.map((h: any) => ({
        id: h.id,
        year: h.year,
        date: h.date,
        name: h.name,
        description: h.description || '',
      }));

      // Format settings
      const settingsSheet = [
        {
          company_name: companySettings.companyName,
          tagline: companySettings.tagline || '',
          address: companySettings.address || '',
          phone: companySettings.phone || '',
          email: companySettings.email || '',
          authorized_signatory: companySettings.authorizedSignatory || '',
          default_calculation_mode: salarySettings.defaultCalculationMode,
          last_synced_at: new Date().toISOString(),
        },
      ];

      const payload = {
        Employees: employeesSheet,
        Attendance: attendanceSheet,
        Salaries: salariesSheet,
        Holidays: holidaysSheet,
        CompanySettings: settingsSheet,
      };

      // Send to Google Apps Script Webhook (handles CORS / redirect safely)
      await fetch(GOOGLE_DRIVE_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', // standard for Google Apps Script Web App endpoints
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      console.log('Successfully synced all data to Google Drive / Sheets!');
      return { success: true };
    } catch (err: any) {
      console.error('Google Drive Sync error:', err);
      return { success: false, message: err.message };
    } finally {
      isSyncing = false;
    }
  }

  /**
   * Schedule silent background auto-sync (debounced by 3 seconds)
   */
  static triggerBackgroundSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      this.syncAllToGoogleDrive().catch(console.error);
    }, 3000);
  }
}
