import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  Eye,
  PlusCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { HolidayRepository } from '../repositories/holidayRepository';
import { DailyAttendanceTable } from '../components/attendance/DailyAttendanceTable';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { EmptyState } from '../components/common/EmptyState';
import { Employee, AttendanceRecord, Holiday, AttendanceStatus } from '../types';
import {
  getTodayDateString,
  formatDisplayDate,
  formatMonthYear,
  isSunday,
  getDatesInMonth,
} from '../utils/dateUtils';
import { addDays, subDays, parseISO, format } from 'date-fns';

export const AttendancePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'view' | 'mark' | 'calendar'>('view');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceRecord[]>([]);
  const [monthAttendance, setMonthAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = getTodayDateString();

  // Load employees & holidays
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const emps = await EmployeeRepository.getAll();
        setEmployees(emps);
        if (emps.length > 0) {
          setSelectedEmployeeId(emps[0].employeeId);
        }
        const hols = await HolidayRepository.getAll();
        setHolidays(hols);
      } catch (err) {
        console.error('Error loading attendance initial data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitial();
  }, []);

  // Load daily attendance whenever selectedDate changes
  useEffect(() => {
    const loadDaily = async () => {
      const records = await AttendanceRepository.getByDate(selectedDate);
      setDailyAttendance(records);
    };
    loadDaily();
  }, [selectedDate]);

  // Load monthly attendance whenever calendar month/year changes
  useEffect(() => {
    const loadMonth = async () => {
      const records = await AttendanceRepository.getMonthAttendance(
        calendarYear,
        calendarMonth
      );
      setMonthAttendance(records);
    };
    loadMonth();
  }, [calendarYear, calendarMonth]);

  const handlePrevDay = () => {
    const d = parseISO(selectedDate);
    setSelectedDate(format(subDays(d, 1), 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const d = parseISO(selectedDate);
    setSelectedDate(format(addDays(d, 1), 'yyyy-MM-dd'));
  };

  const handleGoToday = () => {
    setSelectedDate(getTodayDateString());
  };

  // Inline status change handler
  const handleDailyStatusChange = async (
    employeeId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    await AttendanceRepository.setStatus(employeeId, selectedDate, status, note);
    const updated = await AttendanceRepository.getByDate(selectedDate);
    setDailyAttendance(updated);

    const curMonth = parseInt(selectedDate.split('-')[1], 10);
    const curYear = parseInt(selectedDate.split('-')[0], 10);
    if (curYear === calendarYear && curMonth === calendarMonth) {
      const updatedMonth = await AttendanceRepository.getMonthAttendance(
        calendarYear,
        calendarMonth
      );
      setMonthAttendance(updatedMonth);
    }
  };

  const handleMarkAllPresent = async (overwriteExisting: boolean) => {
    const activeEmpIds = employees
      .filter(e => e.status === 'Active')
      .map(e => e.employeeId);

    await AttendanceRepository.markAllPresentForDate(
      selectedDate,
      activeEmpIds,
      overwriteExisting
    );
    const updated = await AttendanceRepository.getByDate(selectedDate);
    setDailyAttendance(updated);

    const curMonth = parseInt(selectedDate.split('-')[1], 10);
    const curYear = parseInt(selectedDate.split('-')[0], 10);
    if (curYear === calendarYear && curMonth === calendarMonth) {
      const updatedMonth = await AttendanceRepository.getMonthAttendance(
        calendarYear,
        calendarMonth
      );
      setMonthAttendance(updatedMonth);
    }
  };

  const handleCalendarStatusChange = async (
    employeeId: string,
    dateStr: string,
    status: AttendanceStatus
  ) => {
    await AttendanceRepository.setStatus(employeeId, dateStr, status);
    const updatedMonth = await AttendanceRepository.getMonthAttendance(
      calendarYear,
      calendarMonth
    );
    setMonthAttendance(updatedMonth);
    if (dateStr === selectedDate) {
      const updatedDaily = await AttendanceRepository.getByDate(selectedDate);
      setDailyAttendance(updatedDaily);
    }
  };

  const currentHoliday = holidays.find(h => h.date === selectedDate);

  // Compute month attendance stats for all employees in view mode
  const employeeMonthSummaries = useMemo(() => {
    const datesInMonth = getDatesInMonth(calendarYear, calendarMonth);
    const workingDaysCount = datesInMonth.filter(d => !isSunday(d)).length;

    return employees.map(emp => {
      const empRecs = monthAttendance.filter(r => r.employeeId === emp.employeeId);
      let present = 0;
      let absent = 0;
      let halfDay = 0;
      let paidLeave = 0;
      let unpaidLeave = 0;

      empRecs.forEach(r => {
        if (r.status === 'Present') present++;
        else if (r.status === 'Absent') absent++;
        else if (r.status === 'Half Day') halfDay++;
        else if (r.status === 'Paid Leave') paidLeave++;
        else if (r.status === 'Unpaid Leave') unpaidLeave++;
      });

      const effectivePresent = present + halfDay * 0.5 + paidLeave;
      const rate = workingDaysCount > 0 ? Math.min(100, Math.round((effectivePresent / workingDaysCount) * 100)) : 0;

      return {
        employee: emp,
        present,
        absent,
        halfDay,
        paidLeave,
        unpaidLeave,
        effectivePresent,
        rate,
        totalMarked: empRecs.length,
      };
    });
  }, [employees, monthAttendance, calendarYear, calendarMonth]);

  if (employees.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={Users}
        title="No employees registered yet"
        description="Please add your staff members before marking attendance."
        actionLabel="Add First Employee"
        onAction={() => (window.location.href = '#/employees/create')}
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Top Header & View/Mark Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Attendance Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            View staff presence summary or quickly mark daily attendance
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('view')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'view'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span>View Records (Overview)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('mark')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'mark'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-blue-700'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-orange-400" />
            <span>Mark / Add Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span>Calendar Matrix</span>
          </button>
        </div>
      </div>

      {/* 1. VIEW ATTENDANCE SUMMARY MODE (Overview of each employee's monthly attendance) */}
      {viewMode === 'view' && (
        <div className="space-y-4 w-full">
          {/* Month Selector Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 1) {
                    setCalendarYear(calendarYear - 1);
                    setCalendarMonth(12);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-black text-slate-800 min-w-[140px] text-center">
                {formatMonthYear(calendarYear, calendarMonth)}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 12) {
                    setCalendarYear(calendarYear + 1);
                    setCalendarMonth(1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('mark')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-xs shadow-orange-500/20 active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Mark Today's Attendance ({formatDisplayDate(todayStr, 'dd MMM')})</span>
            </button>
          </div>

          {/* Employee Attendance Summary Table & Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Monthly Attendance Overview
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Summary of total present, absent, half-days and leaves for {formatMonthYear(calendarYear, calendarMonth)}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {employeeMonthSummaries.map(({ employee: emp, present, absent, halfDay, paidLeave, unpaidLeave, rate }) => (
                <div
                  key={emp.employeeId}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-[220px]">
                    {emp.photoUrl ? (
                      <img
                        src={emp.photoUrl}
                        alt={emp.fullName}
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-base border border-blue-200 shadow-xs">
                        {emp.fullName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{emp.fullName}</h4>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {emp.employeeId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{emp.designation}</p>
                    </div>
                  </div>

                  {/* Attendance Stats Badges */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 text-center">
                    <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-[10px] uppercase font-bold text-blue-600 block">Present</span>
                      <span className="text-base font-black text-blue-700">{present}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-600 block">Absent</span>
                      <span className="text-base font-black text-rose-700">{absent}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200">
                      <span className="text-[10px] uppercase font-bold text-orange-600 block">Half Day</span>
                      <span className="text-base font-black text-orange-600">{halfDay}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200">
                      <span className="text-[10px] uppercase font-bold text-sky-600 block">Paid Lv</span>
                      <span className="text-base font-black text-sky-700">{paidLeave}</span>
                    </div>

                    <div className="hidden sm:block px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Rate</span>
                      <span className="text-base font-black text-slate-800">{rate}%</span>
                    </div>
                  </div>

                  {/* Action to View Details */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(emp.employeeId);
                        setViewMode('calendar');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                      <span>Full Calendar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. MARK / ADD ATTENDANCE MODE */}
      {viewMode === 'mark' && (
        <div className="space-y-4 w-full">
          {/* Enhanced Date Selector Header */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePrevDay}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Yesterday</span>
              </button>

              <button
                type="button"
                onClick={handleGoToday}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-all cursor-pointer shadow-xs shadow-blue-600/20 active:scale-95"
              >
                Today
              </button>

              <button
                type="button"
                onClick={handleNextDay}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>Tomorrow</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-sm font-black text-slate-900 block">
                  {formatDisplayDate(selectedDate, 'EEEE, dd MMMM yyyy')}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {isSunday(selectedDate) ? 'Weekly Sunday Off' : 'Regular Business Working Day'}
                </span>
              </div>
            </div>
          </div>

          <DailyAttendanceTable
            date={selectedDate}
            employees={employees}
            attendanceRecords={dailyAttendance}
            holiday={currentHoliday}
            onStatusChange={handleDailyStatusChange}
            onMarkAllPresent={handleMarkAllPresent}
          />
        </div>
      )}

      {/* 3. MONTHLY MATRIX CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <AttendanceCalendar
          year={calendarYear}
          month={calendarMonth}
          selectedEmployeeId={selectedEmployeeId}
          employees={employees}
          attendanceRecords={monthAttendance}
          holidays={holidays}
          onMonthChange={(y, m) => {
            setCalendarYear(y);
            setCalendarMonth(m);
          }}
          onEmployeeSelect={empId => setSelectedEmployeeId(empId)}
          onStatusChange={handleCalendarStatusChange}
        />
      )}
    </div>
  );
};
