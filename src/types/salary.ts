import { Employee } from './employee';
import { AttendanceRecord } from './attendance';
import { Holiday } from './holiday';

export type SalaryCalculationMode = 'working_days' | 'calendar_days';

export interface SalaryCalculationInput {
  employee: Employee;
  year: number;
  month: number; // 1 to 12
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  calculationMode: SalaryCalculationMode;
  todayDateStr?: string; // e.g. "2026-09-09" - to differentiate past unmarked vs future unmarked
}

export interface MonthlySalaryBreakdown {
  employeeId: string;
  employeeName: string;
  designation: string;
  month: number;
  year: number;
  monthlySalary: number;
  calculationMode: SalaryCalculationMode;
  
  // Day counts
  calendarDays: number;
  totalWorkingDaysInMonth: number; // Total working days in calendar month
  effectiveWorkingDays: number; // Working days within employee's tenure (joined after start or left before end)
  
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  notMarkedDays: number; // Future or unrecorded days (no deduction)
  holidayDays: number; // Configured holidays within tenure
  weekendDays: number; // Sundays (or non-working days)
  
  // Financials
  dailySalary: number;
  hourlyOvertimeRate: number; // Rate per hour used for overtime calculation
  totalOvertimeHours: number; // Sum of extra hours worked in month
  overtimeEarnings: number; // totalOvertimeHours * hourlyOvertimeRate
  absentDeduction: number;
  halfDayDeduction: number;
  unpaidLeaveDeduction: number;
  totalDeductions: number;
  finalSalary: number;
  
  isFinalized: boolean;
  finalizedAt?: string;
  notes?: string;
}

export interface FinalizedSalaryRecord {
  id: string; // Composite key: `${employeeId}_${year}_${String(month).padStart(2, '0')}` (e.g. "EMP001_2026_09")
  employeeId: string;
  employeeName: string;
  designation: string;
  year: number;
  month: number;
  monthlySalary: number;
  calculationMode: SalaryCalculationMode;
  
  calendarDays: number;
  effectiveWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  notMarkedDays: number;
  totalOvertimeHours?: number;
  overtimeEarnings?: number;
  hourlyOvertimeRate?: number;
  
  dailySalary: number;
  absentDeduction: number;
  halfDayDeduction: number;
  unpaidLeaveDeduction: number;
  totalDeductions: number;
  finalSalary: number;
  
  isFinalized: boolean;
  finalizedAt: string;
  notes?: string;
  updatedAt: string;
}
