import {
  Employee,
  AttendanceRecord,
  Holiday,
  SalaryCalculationInput,
  MonthlySalaryBreakdown,
  SalaryCalculationMode,
} from '../types';
import {
  getDatesInMonth,
  isSunday,
  isDateStrictlyBefore,
  isDateStrictlyAfter,
  getTodayDateString,
} from '../utils/dateUtils';
import { roundCurrency } from '../utils/currencyUtils';

/**
 * Deterministic central calculation engine for monthly salary
 */
export function calculateMonthlySalary(input: SalaryCalculationInput): MonthlySalaryBreakdown {
  const {
    employee,
    year,
    month,
    attendance,
    holidays,
    calculationMode = 'working_days',
  } = input;

  const datesInMonth = getDatesInMonth(year, month);
  const calendarDays = datesInMonth.length;

  // Build lookup maps for O(1) checks
  const holidayDateSet = new Set(holidays.map(h => h.date));
  const attendanceMap = new Map<string, AttendanceRecord>();
  attendance.forEach(rec => {
    attendanceMap.set(rec.date, rec);
  });

  const joiningDate = employee.joiningDate; // e.g. "2026-09-10"
  const endDate = employee.endDate; // e.g. "2026-09-25"

  let totalWorkingDaysInMonth = 0;
  let effectiveWorkingDays = 0;
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let notMarkedDays = 0;
  let holidayDays = 0;
  let weekendDays = 0;

  for (const dateStr of datesInMonth) {
    const isSun = isSunday(dateStr);
    const isHoliday = holidayDateSet.has(dateStr);

    // Is date within employee's active tenure?
    const isBeforeJoin = joiningDate ? isDateStrictlyBefore(dateStr, joiningDate) : false;
    const isAfterExit = endDate ? isDateStrictlyAfter(dateStr, endDate) : false;
    const isWithinTenure = !isBeforeJoin && !isAfterExit;

    // Check baseline working day for the month (standard Mon-Sat excluding holidays)
    const isGeneralWorkingDay = !isSun && !isHoliday;
    if (isGeneralWorkingDay) {
      totalWorkingDaysInMonth++;
    }

    if (!isWithinTenure) {
      // Out of tenure days do not count towards working days or attendance
      continue;
    }

    if (isSun) {
      weekendDays++;
      continue;
    }

    if (isHoliday) {
      holidayDays++;
      continue;
    }

    // This day is an effective working day for this employee
    effectiveWorkingDays++;

    // Evaluate attendance record for this working day
    const record = attendanceMap.get(dateStr);
    const status = record ? record.status : 'Not Marked';

    switch (status) {
      case 'Present':
        presentDays++;
        break;
      case 'Absent':
        absentDays++;
        break;
      case 'Half Day':
        halfDays++;
        break;
      case 'Paid Leave':
        paidLeaveDays++;
        break;
      case 'Unpaid Leave':
        unpaidLeaveDays++;
        break;
      case 'Not Marked':
      default:
        // Not Marked days NEVER count as absent and never trigger deductions!
        notMarkedDays++;
        break;
    }
  }

  // Base calculation unit
  // If working_days mode: use totalWorkingDaysInMonth (or effectiveWorkingDays if mid-month joined)
  // Standard business convention: Daily salary divisor is total working days in month (or effective working days if joined mid-month)
  const divisor =
    calculationMode === 'calendar_days'
      ? calendarDays
      : (effectiveWorkingDays > 0 ? (totalWorkingDaysInMonth > 0 ? totalWorkingDaysInMonth : effectiveWorkingDays) : 1);

  const dailySalary = divisor > 0 ? roundCurrency(employee.monthlySalary / divisor) : 0;

  // Calculate deductions
  const absentDeduction = roundCurrency(dailySalary * absentDays);
  const halfDayDeduction = roundCurrency(dailySalary * 0.5 * halfDays);
  const unpaidLeaveDeduction = roundCurrency(dailySalary * unpaidLeaveDays);

  // If employee joined mid-month in working_days mode, deduct days prior to joining
  let preJoiningDeduction = 0;
  if (calculationMode === 'working_days' && totalWorkingDaysInMonth > effectiveWorkingDays && effectiveWorkingDays > 0) {
    const preJoiningWorkingDays = totalWorkingDaysInMonth - effectiveWorkingDays;
    preJoiningDeduction = roundCurrency(dailySalary * preJoiningWorkingDays);
  }

  const totalDeductions = roundCurrency(
    absentDeduction + halfDayDeduction + unpaidLeaveDeduction + preJoiningDeduction
  );

  const finalSalary = Math.max(0, roundCurrency(employee.monthlySalary - totalDeductions));

  return {
    employeeId: employee.employeeId,
    employeeName: employee.fullName,
    designation: employee.designation,
    month,
    year,
    monthlySalary: employee.monthlySalary,
    calculationMode,

    calendarDays,
    totalWorkingDaysInMonth,
    effectiveWorkingDays,

    presentDays,
    absentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    notMarkedDays,
    holidayDays,
    weekendDays,

    dailySalary,
    absentDeduction,
    halfDayDeduction,
    unpaidLeaveDeduction,
    totalDeductions,
    finalSalary,

    isFinalized: false,
  };
}
