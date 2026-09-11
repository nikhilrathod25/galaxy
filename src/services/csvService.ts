import Papa from 'papaparse';
import { Employee, AttendanceRecord, MonthlySalaryBreakdown, FinalizedSalaryRecord, AttendanceStatus } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';

export interface CSVImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

export class CSVService {
  /**
   * Triggers download of CSV string in browser
   */
  private static downloadCSV(csvContent: string, fileName: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports employee roster to CSV
   */
  static exportEmployees(employees: Employee[]): void {
    const data = employees.map(emp => ({
      'Employee ID': emp.employeeId,
      'Full Name': emp.fullName,
      'Designation': emp.designation,
      'Phone': emp.phone || '',
      'Email': emp.email || '',
      'Address': emp.address || '',
      'Joining Date': formatDisplayDate(emp.joiningDate, 'yyyy-MM-dd'),
      'End Date': emp.endDate ? formatDisplayDate(emp.endDate, 'yyyy-MM-dd') : '',
      'Monthly Salary (INR)': emp.monthlySalary,
      'Status': emp.status,
      'Notes': emp.notes || '',
    }));

    const csv = Papa.unparse(data);
    this.downloadCSV(csv, `staffpay-employees-${new Date().toISOString().split('T')[0]}.csv`);
  }

  /**
   * Downloads sample employee CSV template
   */
  static downloadEmployeeTemplate(): void {
    const sampleData = [
      {
        'Employee ID': 'EMP001',
        'Full Name': 'Rahul Sharma',
        'Designation': 'Software Engineer',
        'Phone': '9876543210',
        'Email': 'rahul@example.com',
        'Address': 'Mumbai, Maharashtra',
        'Joining Date': '2026-01-01',
        'End Date': '',
        'Monthly Salary (INR)': 35000,
        'Status': 'Active',
        'Notes': 'Permanent Staff',
      },
      {
        'Employee ID': 'EMP002',
        'Full Name': 'Priya Patel',
        'Designation': 'UI Designer',
        'Phone': '9876543211',
        'Email': 'priya@example.com',
        'Address': 'Ahmedabad, Gujarat',
        'Joining Date': '2026-02-01',
        'End Date': '',
        'Monthly Salary (INR)': 28000,
        'Status': 'Active',
        'Notes': '',
      },
    ];

    const csv = Papa.unparse(sampleData);
    this.downloadCSV(csv, 'staffpay-employees-template.csv');
  }

  /**
   * Imports employees from a CSV file
   */
  static async importEmployees(file: File): Promise<CSVImportResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[];
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          const existingEmps = await EmployeeRepository.getAll();
          const existingMap = new Map(existingEmps.map(e => [e.employeeId.toLowerCase(), e]));

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const lineNum = i + 2; // header is line 1

            const empId = (row['Employee ID'] || row['employee_id'] || row['EmployeeID'] || '').toString().trim();
            const fullName = (row['Full Name'] || row['full_name'] || row['Name'] || '').toString().trim();
            const designation = (row['Designation'] || row['Role'] || row['designation'] || 'Staff').toString().trim();
            const phone = (row['Phone'] || row['phone'] || row['Mobile'] || '').toString().trim();
            const email = (row['Email'] || row['email'] || '').toString().trim();
            const address = (row['Address'] || row['address'] || '').toString().trim();
            const joiningDate = (row['Joining Date'] || row['joining_date'] || '2026-01-01').toString().trim();
            const endDate = (row['End Date'] || row['end_date'] || '').toString().trim();
            const rawSalary = row['Monthly Salary (INR)'] || row['Monthly Salary'] || row['monthly_salary'] || row['Salary'] || '0';
            const monthlySalary = parseFloat(String(rawSalary).replace(/[^0-9.]/g, '')) || 0;
            const status = (row['Status'] || row['status'] || 'Active').toString().trim() === 'Inactive' ? 'Inactive' : 'Active';
            const notes = (row['Notes'] || row['notes'] || '').toString().trim();

            if (!fullName) {
              errors.push(`Row ${lineNum}: Full Name is required.`);
              errorCount++;
              continue;
            }

            try {
              let targetEmpId = empId;
              if (!targetEmpId) {
                targetEmpId = await EmployeeRepository.generateNextEmployeeId();
              }

              const existing = existingMap.get(targetEmpId.toLowerCase());
              if (existing && existing.id) {
                // Update existing
                await EmployeeRepository.update(existing.id, {
                  fullName,
                  designation,
                  phone,
                  email,
                  address,
                  joiningDate: joiningDate || existing.joiningDate,
                  endDate: endDate || undefined,
                  monthlySalary,
                  status,
                  notes: notes || undefined,
                });
              } else {
                // Create new
                await EmployeeRepository.create({
                  employeeId: targetEmpId,
                  fullName,
                  designation,
                  phone,
                  email,
                  address,
                  joiningDate: joiningDate || '2026-01-01',
                  endDate: endDate || undefined,
                  monthlySalary,
                  status,
                  notes: notes || undefined,
                });
              }
              successCount++;
            } catch (err: any) {
              errors.push(`Row ${lineNum} (${fullName}): ${err.message || 'Import failed'}`);
              errorCount++;
            }
          }

          window.dispatchEvent(new Event('staffpay_database_updated'));
          resolve({
            totalRows: rows.length,
            successCount,
            errorCount,
            errors,
          });
        },
        error: (err) => {
          resolve({
            totalRows: 0,
            successCount: 0,
            errorCount: 1,
            errors: [err.message || 'Failed to parse CSV file.'],
          });
        },
      });
    });
  }

  /**
   * Exports attendance records for a given month or all
   */
  static exportMonthlyAttendance(
    year: number,
    month: number,
    records: AttendanceRecord[],
    employees: Employee[]
  ): void {
    const empMap = new Map(employees.map(e => [e.employeeId, e]));

    const data = records.map(r => {
      const emp = empMap.get(r.employeeId);
      return {
        'Date': r.date,
        'Employee ID': r.employeeId,
        'Employee Name': emp ? emp.fullName : '',
        'Designation': emp ? emp.designation : '',
        'Status': r.status,
        'Note': r.note || '',
      };
    });

    const csv = Papa.unparse(data);
    this.downloadCSV(csv, `staffpay-attendance-${year}-${String(month).padStart(2, '0')}.csv`);
  }

  /**
   * Downloads sample attendance CSV template
   */
  static downloadAttendanceTemplate(): void {
    const sampleData = [
      {
        'Date': '2026-09-11',
        'Employee ID': 'EMP001',
        'Employee Name': 'Rahul Sharma',
        'Status': 'Present',
        'Note': '',
      },
      {
        'Date': '2026-09-11',
        'Employee ID': 'EMP002',
        'Employee Name': 'Priya Patel',
        'Status': 'Half Day',
        'Note': 'Doctor appointment',
      },
    ];

    const csv = Papa.unparse(sampleData);
    this.downloadCSV(csv, 'staffpay-attendance-template.csv');
  }

  /**
   * Imports attendance records from CSV
   */
  static async importAttendance(file: File): Promise<CSVImportResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[];
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          const batchToUpsert: Array<{ employeeId: string; date: string; status: AttendanceStatus; note?: string }> = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const lineNum = i + 2;

            const date = (row['Date'] || row['date'] || '').toString().trim();
            const employeeId = (row['Employee ID'] || row['employee_id'] || row['EmployeeID'] || '').toString().trim();
            let rawStatus = (row['Status'] || row['status'] || 'Present').toString().trim();
            const note = (row['Note'] || row['note'] || row['Remarks'] || '').toString().trim();

            if (!date || !employeeId) {
              errors.push(`Row ${lineNum}: Date and Employee ID are required.`);
              errorCount++;
              continue;
            }

            // Normalize status (P -> Present, A -> Absent, HL -> Half Day, etc.)
            let status: AttendanceStatus = 'Present';
            const upper = rawStatus.toUpperCase();
            if (upper === 'P' || upper === 'PRESENT') status = 'Present';
            else if (upper === 'A' || upper === 'ABSENT') status = 'Absent';
            else if (upper === 'HL' || upper === 'HALF DAY' || upper === 'HD' || upper === 'HALF_DAY') status = 'Half Day';
            else if (upper === 'PL' || upper === 'PAID LEAVE' || upper === 'PAID_LEAVE') status = 'Paid Leave';
            else if (upper === 'UL' || upper === 'UNPAID LEAVE' || upper === 'UNPAID_LEAVE') status = 'Unpaid Leave';
            else status = 'Present';

            batchToUpsert.push({
              employeeId,
              date,
              status,
              note: note || undefined,
            });
            successCount++;
          }

          if (batchToUpsert.length > 0) {
            try {
              await AttendanceRepository.bulkSetStatus(batchToUpsert);
            } catch (err: any) {
              errors.push(`Database error: ${err.message}`);
            }
          }

          window.dispatchEvent(new Event('staffpay_database_updated'));
          resolve({
            totalRows: rows.length,
            successCount,
            errorCount,
            errors,
          });
        },
        error: (err) => {
          resolve({
            totalRows: 0,
            successCount: 0,
            errorCount: 1,
            errors: [err.message || 'Failed to parse CSV file.'],
          });
        },
      });
    });
  }

  /**
   * Exports monthly payroll sheet to CSV
   */
  static exportSalarySheet(
    year: number,
    month: number,
    salaries: (MonthlySalaryBreakdown | FinalizedSalaryRecord)[]
  ): void {
    const data = salaries.map(s => ({
      'Employee ID': s.employeeId,
      'Employee Name': s.employeeName,
      'Designation': s.designation,
      'Year': s.year,
      'Month': s.month,
      'Monthly Salary': s.monthlySalary,
      'Calculation Mode': s.calculationMode,
      'Calendar Days': s.calendarDays,
      'Effective Working Days': (s as any).effectiveWorkingDays || 0,
      'Present Days': s.presentDays,
      'Absent Days': s.absentDays,
      'Half Days': s.halfDays,
      'Paid Leave Days': s.paidLeaveDays,
      'Unpaid Leave Days': s.unpaidLeaveDays,
      'Overtime Hours': (s as any).totalOvertimeHours || 0,
      'Hourly Overtime Rate': (s as any).hourlyOvertimeRate || 0,
      'Overtime Earnings': (s as any).overtimeEarnings || 0,
      'Daily Salary': s.dailySalary,
      'Absent Deduction': s.absentDeduction,
      'Half Day Deduction': s.halfDayDeduction,
      'Unpaid Leave Deduction': s.unpaidLeaveDeduction,
      'Total Deductions': s.totalDeductions,
      'Final Net Salary': s.finalSalary,
      'Status': s.isFinalized ? 'Finalized' : 'Calculated',
    }));

    const csv = Papa.unparse(data);
    this.downloadCSV(csv, `staffpay-salary-sheet-${year}-${String(month).padStart(2, '0')}.csv`);
  }
}
