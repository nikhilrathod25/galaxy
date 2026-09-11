import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Search,
  CheckCheck,
  Calendar as CalendarIcon,
  Sparkles,
  AlertCircle,
  Clock,
  Eye,
  Users,
  CalendarDays,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { HolidayRepository } from '../repositories/holidayRepository';
import { EmployeeMonthCalendarModal } from '../components/attendance/EmployeeMonthCalendarModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Employee, AttendanceRecord, Holiday, AttendanceStatus } from '../types';
import {
  getISTDateString,
  formatDisplayDate,
  formatMonthYear,
  formatIndianDate,
  isThursday,
} from '../utils/dateUtils';
import { parseISO, format } from 'date-fns';

export const AttendancePage: React.FC = () => {
  // IST Date handling
  const todayIST = getISTDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);

  // Month navigation for overview/calendar
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceRecord[]>([]);
  const [monthAttendance, setMonthAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal for individual employee's full month sheet
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);

  // Mark all dialog
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Base Data
  const loadBaseData = async () => {
    setIsLoading(true);
    try {
      const emps = await EmployeeRepository.getAll();
      setEmployees(emps);
      const hols = await HolidayRepository.getAll();
      setHolidays(hols);
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
    const handleUpdate = () => {
      loadBaseData();
    };
    window.addEventListener('staffpay_database_updated', handleUpdate);
    return () => window.removeEventListener('staffpay_database_updated', handleUpdate);
  }, []);

  // Load Daily Attendance
  useEffect(() => {
    const loadDaily = async () => {
      const records = await AttendanceRepository.getByDate(selectedDate);
      setDailyAttendance(records);
    };
    loadDaily();
  }, [selectedDate]);

  // Load Month Attendance
  useEffect(() => {
    const loadMonth = async () => {
      const records = await AttendanceRepository.getMonthAttendance(selectedYear, selectedMonth);
      setMonthAttendance(records);
    };
    loadMonth();
  }, [selectedYear, selectedMonth]);

  // Instant Single Employee Status Change
  const handleStatusChange = async (employeeId: string, status: AttendanceStatus, overtimeHours?: number) => {
    const existing = dailyRecordMap.get(employeeId);
    const ot = overtimeHours !== undefined ? overtimeHours : existing?.overtimeHours;
    await AttendanceRepository.setStatus(employeeId, selectedDate, status, undefined, ot);
    const updatedDaily = await AttendanceRepository.getByDate(selectedDate);
    setDailyAttendance(updatedDaily);

    const sMonth = parseInt(selectedDate.split('-')[1], 10);
    const sYear = parseInt(selectedDate.split('-')[0], 10);
    if (sMonth === selectedMonth && sYear === selectedYear) {
      const updatedMonth = await AttendanceRepository.getMonthAttendance(selectedYear, selectedMonth);
      setMonthAttendance(updatedMonth);
    }
  };

  // Modal Month Change
  const handleModalStatusChange = async (
    employeeId: string,
    dateStr: string,
    status: AttendanceStatus,
    overtimeHours?: number
  ) => {
    await AttendanceRepository.setStatus(employeeId, dateStr, status, undefined, overtimeHours);
    const updatedMonth = await AttendanceRepository.getMonthAttendance(selectedYear, selectedMonth);
    setMonthAttendance(updatedMonth);

    if (dateStr === selectedDate) {
      const updatedDaily = await AttendanceRepository.getByDate(selectedDate);
      setDailyAttendance(updatedDaily);
    }
  };

  // Mark All Present
  const handleMarkAllConfirm = async () => {
    setIsMarkingAll(true);
    try {
      const activeEmpIds = employees.filter(e => e.status === 'Active').map(e => e.employeeId);
      await AttendanceRepository.markAllPresentForDate(selectedDate, activeEmpIds, true);
      const updatedDaily = await AttendanceRepository.getByDate(selectedDate);
      setDailyAttendance(updatedDaily);

      const sMonth = parseInt(selectedDate.split('-')[1], 10);
      const sYear = parseInt(selectedDate.split('-')[0], 10);
      if (sMonth === selectedMonth && sYear === selectedYear) {
        const updatedMonth = await AttendanceRepository.getMonthAttendance(selectedYear, selectedMonth);
        setMonthAttendance(updatedMonth);
      }
    } finally {
      setIsMarkingAll(false);
      setConfirmMarkAllOpen(false);
    }
  };

  // Maps
  const dailyRecordMap = useMemo(() => {
    return new Map(dailyAttendance.map(r => [r.employeeId, r]));
  }, [dailyAttendance]);

  // Monthly stats per employee
  const employeeStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { present: number; absent: number; halfDay: number; paidLeave: number; unpaidLeave: number; overtimeHours: number }
    >();
    employees.forEach(e => {
      map.set(e.employeeId, { present: 0, absent: 0, halfDay: 0, paidLeave: 0, unpaidLeave: 0, overtimeHours: 0 });
    });

    monthAttendance.forEach(rec => {
      const st = map.get(rec.employeeId);
      if (st) {
        if (rec.status === 'Present') st.present++;
        else if (rec.status === 'Absent') st.absent++;
        else if (rec.status === 'Half Day') st.halfDay++;
        else if (rec.status === 'Paid Leave') st.paidLeave++;
        else if (rec.status === 'Unpaid Leave') st.unpaidLeave++;

        if (rec.overtimeHours && rec.overtimeHours > 0) {
          st.overtimeHours += Number(rec.overtimeHours);
        }
      }
    });

    return map;
  }, [employees, monthAttendance]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(emp => {
      const rec = dailyRecordMap.get(emp.employeeId);
      const status = rec ? rec.status : 'Not Marked';

      const matchesSearch =
        !q ||
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'NOT_MARKED') return status === 'Not Marked';
      return status === statusFilter;
    });
  }, [employees, searchQuery, statusFilter, dailyRecordMap]);

  // Day stats
  const dayStats = useMemo(() => {
    let p = 0;
    let a = 0;
    let hl = 0;
    let pl = 0;
    let pending = 0;

    employees.forEach(emp => {
      const rec = dailyRecordMap.get(emp.employeeId);
      const s = rec ? rec.status : 'Not Marked';
      if (s === 'Present') p++;
      else if (s === 'Absent') a++;
      else if (s === 'Half Day') hl++;
      else if (s === 'Paid Leave') pl++;
      else pending++;
    });

    const total = employees.length;
    const presentRate = total > 0 ? Math.round((p / total) * 100) : 0;

    return { p, a, hl, pl, pending, total, presentRate };
  }, [employees, dailyRecordMap]);

  const currentHoliday = holidays.find(h => h.date === selectedDate);
  const isThu = isThursday(selectedDate);

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
    <div className="space-y-4 w-full pb-10">
      {/* 1. Top Header with Clean Single Date Picker & Actions */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
            <CalendarDays className="w-5 h-5 text-orange-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Attendance Hub</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live IST
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Daily presence tracking and monthly calendar sheet
            </p>
          </div>
        </div>

        {/* Date Selector & Bulk Mark All Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* Single Clean Interactive Date Picker */}
          <div className="relative">
            <label className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-500 text-slate-800 font-black text-xs shadow-2xs transition cursor-pointer active:scale-95">
              <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-blue-950 font-black tracking-tight text-xs sm:text-sm">
                {formatIndianDate(selectedDate)} ({formatDisplayDate(selectedDate, 'EEE')})
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    const pMonth = parseInt(e.target.value.split('-')[1], 10);
                    const pYear = parseInt(e.target.value.split('-')[0], 10);
                    setSelectedMonth(pMonth);
                    setSelectedYear(pYear);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Click to pick any date from calendar"
              />
            </label>
          </div>

          {/* Mark All Present Button */}
          <button
            type="button"
            disabled={Boolean(isThu || currentHoliday)}
            onClick={() => setConfirmMarkAllOpen(true)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-md shrink-0 ${
              isThu || currentHoliday
                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-95 cursor-pointer'
            }`}
            title={isThu ? 'Thursday is Weekly Off (No attendance required)' : currentHoliday ? 'Official Paid Holiday' : 'Mark all active staff present'}
          >
            <CheckCheck className="w-4 h-4 text-orange-300" />
            <span>{isThu ? 'Thursday (Weekly Off)' : currentHoliday ? 'Holiday (Paid Off)' : 'Mark All Present'}</span>
          </button>
        </div>
      </div>

      {/* Holiday / Thursday Weekly Off Notice */}
      {currentHoliday && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-center gap-3 text-xs font-medium shadow-2xs">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Official Holiday: {currentHoliday.name}</strong> — Automatically counted as paid non-working day.
          </span>
        </div>
      )}

      {isThu && !currentHoliday && (
        <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-2.5 text-xs font-medium shadow-2xs">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Thursday (Weekly Off) — Official weekly off day for staff.</span>
        </div>
      )}

      {/* 2. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Staff</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">{dayStats.total}</div>
          <span className="text-[11px] text-slate-400 font-medium">Registered Active</span>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 p-3.5 sm:p-4 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">Present (Today)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1.5">{dayStats.p}</div>
          <span className="text-[11px] text-emerald-600 font-bold">{dayStats.presentRate}% Rate</span>
        </div>

        <div className="bg-white rounded-2xl border border-rose-200/80 p-3.5 sm:p-4 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700">Absent (Today)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
              ✕
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1.5">{dayStats.a}</div>
          <span className="text-[11px] text-rose-600 font-medium">Deducted Pay</span>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-3.5 sm:p-4 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Half Day / Pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
              ½
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1.5">
            {dayStats.hl} <span className="text-xs text-slate-400 font-semibold">({dayStats.pending} pending)</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium">50% pay rate</span>
        </div>
      </div>

      {/* 3. Main Attendance Table (Full Responsive Table with whitespace-nowrap) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Quick Filter Tabs (Scrollable on small screens, no wrap) */}
          <div className="flex items-center gap-1.5 text-xs font-bold overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({dayStats.total})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Present')}
              className={`px-3 py-1.5 rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'Present'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Present ({dayStats.p})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Absent')}
              className={`px-3 py-1.5 rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'Absent'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              Absent ({dayStats.a})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Half Day')}
              className={`px-3 py-1.5 rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'Half Day'
                  ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                  : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              }`}
            >
              Half Day ({dayStats.hl})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('NOT_MARKED')}
              className={`px-3 py-1.5 rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'NOT_MARKED'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Pending ({dayStats.pending})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] max-w-sm shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 shadow-2xs"
            />
          </div>
        </div>

        {/* --- Unified Table View for all screen sizes (Horizontal scroll with whitespace-nowrap) --- */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-100/90 text-[11px] uppercase tracking-wider text-slate-600 font-black border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 min-w-[240px] whitespace-nowrap">Employee</th>
                <th className="px-4 py-3.5 min-w-[200px] whitespace-nowrap">
                  Month Sheet ({formatMonthYear(selectedYear, selectedMonth)})
                </th>
                <th className="px-4 py-3.5 min-w-[130px] whitespace-nowrap">Date Status</th>
                <th className="px-4 py-3.5 min-w-[200px] whitespace-nowrap">Quick Mark ({formatDisplayDate(selectedDate, 'dd MMM')})</th>
                <th className="px-5 py-3.5 min-w-[120px] text-right whitespace-nowrap">Calendar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium whitespace-nowrap">
                    No employees found matching the filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const dailyRec = dailyRecordMap.get(emp.employeeId);
                  const currentStatus: AttendanceStatus = dailyRec ? dailyRec.status : 'Not Marked';
                  const mStats = employeeStatsMap.get(emp.employeeId) || {
                    present: 0,
                    absent: 0,
                    halfDay: 0,
                    paidLeave: 0,
                    unpaidLeave: 0,
                    overtimeHours: 0,
                  };

                  const statusTheme =
                    currentStatus === 'Present'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                      : currentStatus === 'Absent'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                      : currentStatus === 'Half Day'
                      ? 'bg-orange-50 text-orange-700 border-orange-300 font-bold'
                      : currentStatus === 'Paid Leave'
                      ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold'
                      : 'bg-slate-100 text-slate-500 border-slate-200';

                  return (
                    <tr
                      key={emp.employeeId}
                      className="hover:bg-blue-50/40 transition-colors group"
                    >
                      {/* Col 1: Employee */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {emp.photoUrl ? (
                            <img
                              src={emp.photoUrl}
                              alt={emp.fullName}
                              className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-base border border-blue-200 shadow-2xs shrink-0">
                              {emp.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm whitespace-nowrap">{emp.fullName}</span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0 whitespace-nowrap">
                                {emp.employeeId}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium whitespace-nowrap">{emp.designation}</p>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Month Totals */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-[11px] whitespace-nowrap">
                          <span
                            className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap shrink-0"
                            title="Present Days"
                          >
                            P: {mStats.present}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 whitespace-nowrap shrink-0"
                            title="Absent Days"
                          >
                            A: {mStats.absent}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 whitespace-nowrap shrink-0"
                            title="Half Days"
                          >
                            HL: {mStats.halfDay}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 whitespace-nowrap shrink-0"
                            title="Paid Leaves"
                          >
                            PL: {mStats.paidLeave}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border font-bold whitespace-nowrap shrink-0 ${
                              mStats.overtimeHours > 0
                                ? 'bg-amber-100 border-amber-300 text-amber-900 font-black'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                            title={`Total Overtime in ${formatMonthYear(selectedYear, selectedMonth)}: ${mStats.overtimeHours} hours`}
                          >
                            OT: {mStats.overtimeHours}h
                          </span>
                        </div>
                      </td>

                      {/* Col 3: Selected Date Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {currentHoliday && currentStatus === 'Not Marked' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                              Holiday ({currentHoliday.name})
                            </span>
                          ) : isThu && currentStatus === 'Not Marked' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                              Thursday Off
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs border whitespace-nowrap ${statusTheme}`}>
                              {currentStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 4: Quick Mark Segmented Buttons */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center p-0.5 rounded-2xl bg-slate-100 border border-slate-200 shadow-2xs whitespace-nowrap shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.employeeId, 'Present')}
                            className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${
                              currentStatus === 'Present'
                                ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                : 'text-emerald-700 hover:bg-white'
                            }`}
                            title="Mark Present (P)"
                          >
                            P
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.employeeId, 'Absent')}
                            className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${
                              currentStatus === 'Absent'
                                ? 'bg-rose-600 text-white shadow-xs scale-105'
                                : 'text-rose-700 hover:bg-white'
                            }`}
                            title="Mark Absent (A)"
                          >
                            A
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.employeeId, 'Half Day')}
                            className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${
                              currentStatus === 'Half Day'
                                ? 'bg-orange-500 text-white shadow-xs scale-105'
                                : 'text-orange-700 hover:bg-white'
                            }`}
                            title="Mark Half Day (HL)"
                          >
                            HL
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.employeeId, 'Paid Leave')}
                            className={`px-3 py-1 text-xs font-black rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${
                              currentStatus === 'Paid Leave'
                                ? 'bg-sky-600 text-white shadow-xs scale-105'
                                : 'text-sky-700 hover:bg-white'
                            }`}
                            title="Mark Paid Leave (PL)"
                          >
                            PL
                          </button>
                        </div>
                      </td>

                      {/* Col 5: Calendar Matrix Modal Trigger */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setModalEmployee(emp);
                            setIsCalendarModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-xs font-bold text-blue-700 transition cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap shrink-0 group/btn"
                          title="Open Full Month Calendar Grid"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600 group-hover/btn:text-white shrink-0" />
                          <span className="whitespace-nowrap">View Sheet</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Full Month Calendar Modal */}
      {isCalendarModalOpen && modalEmployee && (
        <EmployeeMonthCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => {
            setIsCalendarModalOpen(false);
            setModalEmployee(null);
          }}
          employee={modalEmployee}
          year={selectedYear}
          month={selectedMonth}
          attendanceRecords={monthAttendance}
          holidays={holidays}
          onMonthChange={(y, m) => {
            setSelectedYear(y);
            setSelectedMonth(m);
          }}
          onStatusChange={handleModalStatusChange}
        />
      )}

      {/* Mark All Present Confirmation */}
      <ConfirmDialog
        isOpen={confirmMarkAllOpen}
        onClose={() => setConfirmMarkAllOpen(false)}
        onConfirm={handleMarkAllConfirm}
        title="Mark All Present (P)"
        message={`Do you want to mark all active staff members as Present (P) for ${formatIndianDate(selectedDate)}?`}
        confirmLabel="Mark All Present"
        variant="info"
        isLoading={isMarkingAll}
      />
    </div>
  );
};
