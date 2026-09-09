import Papa from 'papaparse';
import { Employee, AttendanceRecord, MonthlySalaryBreakdown, FinalizedSalaryRecord } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';
import { formatINR } from '../utils/currencyUtils';

export class CSVService {
  /**
   * Triggers download of CSV string
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
      'Phone': emp.phone,
      'Email': emp.email,
      'Address': emp.address,
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
   * Exports attendance records for a month to CSV
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
