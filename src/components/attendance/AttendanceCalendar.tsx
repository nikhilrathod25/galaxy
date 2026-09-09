import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
} from 'lucide-react';
import {
  Employee,
  AttendanceRecord,
  Holiday,
  AttendanceStatus,
} from '../../types';
import {
  formatMonthYear,
  getDatesInMonth,
  isSunday,
  isSaturday,
  getDayName,
  getDayNumber,
  getTodayDateString,
  isDateStrictlyBefore,
  isDateStrictlyAfter,
} from '../../utils/dateUtils';
import { AttendanceStatusSelector } from './AttendanceStatusSelector';

interface AttendanceCalendarProps {
  year: number;
  month: number;
  selectedEmployeeId: string;
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  holidays: Holiday[];
  onMonthChange: (year: number, month: number) => void;
  onEmployeeSelect: (employeeId: string) => void;
  onStatusChange: (employeeId: string, date: string, status: AttendanceStatus) => Promise<void>;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  year,
  month,
  selectedEmployeeId,
  employees,
  attendanceRecords,
  holidays,
  onMonthChange,
  onEmployeeSelect,
  onStatusChange,
}) => {
  const todayStr = getTodayDateString();
  const datesInMonth = useMemo(() => getDatesInMonth(year, month), [year, month]);

  // Selected employee object
  const currentEmployee = useMemo(() => {
    return employees.find(e => e.employeeId === selectedEmployeeId) || employees[0];
  }, [employees, selectedEmployeeId]);

  // Holiday map
  const holidayMap = useMemo(() => {
    return new Map(holidays.map(h => [h.date, h]));
  }, [holidays]);

  // Attendance lookup for current employee: Map<date, AttendanceRecord>
  const empAttendanceMap = useMemo(() => {
    if (!currentEmployee) return new Map<string, AttendanceRecord>();
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach(r => {
      if (r.employeeId === currentEmployee.employeeId) {
        map.set(r.date, r);
      }
    });
    return map;
  }, [attendanceRecords, currentEmployee]);

  // Weekday column headers starting on MONDAY (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculate day offset for 1st of month relative to Monday
  const startDayOfWeek = useMemo(() => {
    const firstDate = new Date(year, month - 1, 1);
    const day = firstDate.getDay();
    return day === 0 ? 6 : day - 1;
  }, [year, month]);

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        {/* Employee Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-slate-400">Employee:</label>
          <select
            value={currentEmployee?.employeeId || ''}
            onChange={e => onEmployeeSelect(e.target.value)}
            className="text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {employees.map(emp => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.fullName} ({emp.employeeId})
              </option>
            ))}
          </select>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
            {formatMonthYear(year, month)}
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-4 sm:p-6 overflow-hidden">
        {/* Weekday Header (Mon - Sun) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {weekDays.map((day, idx) => (
            <div
              key={day}
              className={`text-center py-2 text-xs font-bold uppercase tracking-wider ${
                idx === 6 ? 'text-orange-500' : idx === 5 ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Matrix */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Empty offset days */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`offset-${i}`} className="min-h-[90px] rounded-2xl bg-slate-50/40 p-2" />
          ))}

          {/* Actual days */}
          {datesInMonth.map(dateStr => {
            const dayNum = getDayNumber(dateStr);
            const isToday = dateStr === todayStr;
            const isSun = isSunday(dateStr);
            const holiday = holidayMap.get(dateStr);
            const record = empAttendanceMap.get(dateStr);
            const status: AttendanceStatus = record ? record.status : 'Not Marked';

            const isBeforeJoin = currentEmployee?.joiningDate
              ? isDateStrictlyBefore(dateStr, currentEmployee.joiningDate)
              : false;
            const isAfterExit = currentEmployee?.endDate
              ? isDateStrictlyAfter(dateStr, currentEmployee.endDate)
              : false;
            const isOutOfTenure = isBeforeJoin || isAfterExit;

            const getDayBg = () => {
              if (isOutOfTenure) return 'bg-slate-100/50 text-slate-300';
              if (holiday) return 'bg-orange-50/70 border-orange-200';
              if (isSun) return 'bg-slate-50 border-slate-200';
              switch (status) {
                case 'Present':
                  return 'bg-blue-50/70 border-blue-200';
                case 'Absent':
                  return 'bg-rose-50/70 border-rose-200';
                case 'Half Day':
                  return 'bg-orange-50/70 border-orange-200';
                case 'Paid Leave':
                  return 'bg-sky-50/70 border-sky-200';
                case 'Unpaid Leave':
                  return 'bg-amber-50/70 border-amber-200';
                default:
                  return 'bg-white border-slate-100';
              }
            };

            return (
              <div
                key={dateStr}
                className={`min-h-[95px] p-2 sm:p-2.5 rounded-2xl border flex flex-col justify-between transition-all ${getDayBg()} ${
                  isToday ? 'ring-2 ring-blue-500 shadow-sm' : ''
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center'
                        : isSun
                        ? 'text-orange-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {holiday && (
                    <span
                      title={holiday.name}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 truncate max-w-[60px] sm:max-w-[80px]"
                    >
                      {holiday.name}
                    </span>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="my-1">
                  {isOutOfTenure ? (
                    <span className="text-[10px] text-slate-400 italic">Tenure inactive</span>
                  ) : holiday ? (
                    <span className="text-[11px] font-bold text-orange-700">Holiday</span>
                  ) : isSun ? (
                    <span className="text-[11px] font-medium text-slate-500">Sunday</span>
                  ) : (
                    <span
                      className={`text-[11px] font-bold ${
                        status === 'Present'
                          ? 'text-blue-700'
                          : status === 'Absent'
                          ? 'text-rose-700'
                          : status === 'Half Day'
                          ? 'text-orange-600'
                          : status === 'Paid Leave'
                          ? 'text-sky-700'
                          : status === 'Unpaid Leave'
                          ? 'text-amber-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {status}
                    </span>
                  )}
                </div>

                {/* Quick Status Dropdown */}
                {!isOutOfTenure && !holiday && !isSun && currentEmployee && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <select
                      value={status}
                      onChange={e => {
                        onStatusChange(
                          currentEmployee.employeeId,
                          dateStr,
                          e.target.value as AttendanceStatus
                        );
                      }}
                      className="w-full text-[10px] font-semibold bg-white/80 border border-slate-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Not Marked">Not Marked</option>
                      <option value="Present">Present (P)</option>
                      <option value="Absent">Absent (A)</option>
                      <option value="Half Day">Half Day (HD)</option>
                      <option value="Paid Leave">Paid Leave (PL)</option>
                      <option value="Unpaid Leave">Unpaid Leave (UL)</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
