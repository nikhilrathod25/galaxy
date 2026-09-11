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
  isWeeklyOff,
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
    const isOff = isWeeklyOff(dateStr); // Thursday is the only weekly off day
    const isHoliday = holidayDateSet.has(dateStr);

    // Is date within employee's active tenure?
    const isBeforeJoin = joiningDate ? isDateStrictlyBefore(dateStr, joiningDate) : false;
    const isAfterExit = endDate ? isDateStrictlyAfter(dateStr, endDate) : false;
    const isWithinTenure = !isBeforeJoin && !isAfterExit;

    // Check baseline working day for the month (working days excluding Thursday and holidays)
    const isGeneralWorkingDay = !isOff && !isHoliday;
    if (isGeneralWorkingDay) {
      totalWorkingDaysInMonth++;
    }

    if (!isWithinTenure) {
      // Out of tenure days do not count towards working days or attendance
      continue;
    }

    const record = attendanceMap.get(dateStr);
    const hasExplicitStatus = record && record.status && record.status !== 'Not Marked';
    const status = hasExplicitStatus ? record.status : isOff ? 'Thursday Off' : isHoliday ? 'Holiday' : 'Not Marked';

    // Count effective working day
    if (!isOff && !isHoliday) {
      effectiveWorkingDays++;
    } else if (status === 'Present' || status === 'Half Day') {
      effectiveWorkingDays++;
    }

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
      case 'Thursday Off':
        weekendDays++;
        break;
      case 'Holiday':
        holidayDays++;
        break;
      case 'Not Marked':
      default:
        notMarkedDays++;
        break;
    }
  }

  // Base calculation unit
  // In working_days mode: divisor is total working days in month (excluding Thursdays & Holidays)
  // In calendar_days mode: divisor is calendar days in month
  const divisor =
    calculationMode === 'calendar_days'
      ? calendarDays
      : (totalWorkingDaysInMonth > 0 ? totalWorkingDaysInMonth : (effectiveWorkingDays > 0 ? effectiveWorkingDays : 1));

  const dailySalary = divisor > 0 ? roundCurrency(employee.monthlySalary / divisor) : 0;

  // Calculate deductions strictly based on marked leaves/absences
  // Not Marked / Unrecorded days NEVER cause any deductions!
  const absentDeduction = roundCurrency(dailySalary * absentDays);
  const halfDayDeduction = roundCurrency(dailySalary * 0.5 * halfDays);
  const unpaidLeaveDeduction = roundCurrency(dailySalary * unpaidLeaveDays);

  const totalDeductions = roundCurrency(
    absentDeduction + halfDayDeduction + unpaidLeaveDeduction
  );

  // Overtime Calculation (Tarika 1: Custom rate if configured, else basic salary ÷ 8 hours)
  let totalOvertimeHours = 0;
  attendance.forEach(rec => {
    if (rec.overtimeHours && rec.overtimeHours > 0) {
      totalOvertimeHours += Number(rec.overtimeHours);
    }
  });

  const hourlyOvertimeRate =
    employee.overtimeRate && employee.overtimeRate > 0
      ? employee.overtimeRate
      : (dailySalary > 0 ? roundCurrency(dailySalary / 8) : 0);

  const overtimeEarnings = roundCurrency(totalOvertimeHours * hourlyOvertimeRate);

  const finalSalary = Math.max(0, roundCurrency(employee.monthlySalary - totalDeductions + overtimeEarnings));

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
    hourlyOvertimeRate,
    totalOvertimeHours,
    overtimeEarnings,
    absentDeduction,
    halfDayDeduction,
    unpaidLeaveDeduction,
    totalDeductions,
    finalSalary,

    isFinalized: false,
  };
}
