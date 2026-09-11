import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar as CalendarIcon,
  CheckCheck,
  Clock,
  Flame,
} from 'lucide-react';
import { Employee, AttendanceRecord, AttendanceStatus, Holiday } from '../../types';
import {
  getDatesInMonth,
  formatMonthYear,
  formatDisplayDate,
  isThursday,
  getDayNumber,
  formatIndianDate,
} from '../../utils/dateUtils';
import { parseISO, getDay } from 'date-fns';

interface EmployeeMonthCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  year: number;
  month: number;
  attendanceRecords: AttendanceRecord[];
  holidays: Holiday[];
  onMonthChange: (year: number, month: number) => void;
  onStatusChange: (
    employeeId: string,
    date: string,
    status: AttendanceStatus,
    overtimeHours?: number
  ) => Promise<void>;
}

export const EmployeeMonthCalendarModal: React.FC<EmployeeMonthCalendarModalProps> = ({
  isOpen,
  onClose,
  employee,
  year,
  month,
  attendanceRecords,
  holidays,
  onMonthChange,
  onStatusChange,
}) => {
  const [updatingDate, setUpdatingDate] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [selectedTileDate, setSelectedTileDate] = useState<string>('');
  const [customOtInput, setCustomOtInput] = useState<string>('');
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  if (!isOpen || !employee) return null;

  const datesInMonth = getDatesInMonth(year, month);
  const holidayMap = new Map(holidays.map(h => [h.date, h]));
  const recordMap = new Map(
    attendanceRecords.filter(r => r.employeeId === employee.employeeId).map(r => [r.date, r])
  );

  const activeSelectedDate = selectedTileDate || datesInMonth[0] || '';

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
    setSelectedTileDate('');
    setCustomOtInput('');
    setSavedFeedback(null);
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
    setSelectedTileDate('');
    setCustomOtInput('');
    setSavedFeedback(null);
  };

  const showFeedback = (msg: string) => {
    setSavedFeedback(msg);
    setTimeout(() => {
      setSavedFeedback(prev => (prev === msg ? null : prev));
    }, 2500);
  };

  const handleStatusClick = async (dateStr: string, status: AttendanceStatus) => {
    setUpdatingDate(dateStr);
    try {
      const existing = recordMap.get(dateStr);
      const ot = existing?.overtimeHours;
      await onStatusChange(employee.employeeId, dateStr, status, ot);
      showFeedback(`${status} Marked ✓`);
    } finally {
      setUpdatingDate(null);
    }
  };

  const handleOvertimeClick = async (dateStr: string, otHours: number) => {
    setUpdatingDate(dateStr);
    try {
      const existing = recordMap.get(dateStr);
      const currentStatus = existing?.status && existing.status !== 'Not Marked' ? existing.status : 'Present';
      await onStatusChange(employee.employeeId, dateStr, currentStatus, otHours > 0 ? otHours : undefined);
      if (otHours > 0) {
        showFeedback(`+${otHours}h Overtime Saved! ✓`);
      } else {
        showFeedback(`0h Overtime Set ✓`);
      }
    } finally {
      setUpdatingDate(null);
    }
  };

  const handleMarkAllMonthPresent = async () => {
    if (
      !window.confirm(
        `Mark all standard working days in ${formatMonthYear(year, month)} as Present for ${
          employee.fullName
        }? (Thursdays will remain Weekly Off unless marked individually)`
      )
    )
      return;
    setIsMarkingAll(true);
    try {
      for (const d of datesInMonth) {
        if (!isThursday(d) && !holidayMap.has(d)) {
          const existing = recordMap.get(d);
          await onStatusChange(employee.employeeId, d, 'Present', existing?.overtimeHours);
        }
      }
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Monthly stats
  let present = 0;
  let absent = 0;
  let halfDay = 0;
  let paidLeave = 0;
  let unpaidLeave = 0;
  let totalOvertimeHours = 0;
  let workingDaysCount = 0;

  datesInMonth.forEach(d => {
    if (!isThursday(d) && !holidayMap.has(d)) {
      workingDaysCount++;
    }
  });

  recordMap.forEach(r => {
    if (r.status === 'Present') present++;
    else if (r.status === 'Absent') absent++;
    else if (r.status === 'Half Day') halfDay++;
    else if (r.status === 'Paid Leave') paidLeave++;
    else if (r.status === 'Unpaid Leave') unpaidLeave++;

    if (r.overtimeHours && r.overtimeHours > 0) {
      totalOvertimeHours += Number(r.overtimeHours);
    }
  });

  const effectivePresent = present + halfDay * 0.5 + paidLeave;
  const rate = workingDaysCount > 0 ? Math.min(100, Math.round((effectivePresent / workingDaysCount) * 100)) : 0;

  // Weekday column headers (Mon - Sun, Thursday is Off)
  const weekDays = [
    { name: 'Mon', short: 'M', isOff: false },
    { name: 'Tue', short: 'T', isOff: false },
    { name: 'Wed', short: 'W', isOff: false },
    { name: 'Thu', short: 'T', isOff: true, label: 'Weekly Off' },
    { name: 'Fri', short: 'F', isOff: false },
    { name: 'Sat', short: 'S', isOff: false },
    { name: 'Sun', short: 'S', isOff: false },
  ];

  // Calculate start padding (first day of month offset from Monday = 0)
  const firstDate = datesInMonth[0] ? parseISO(datesInMonth[0]) : new Date();
  const firstDayOfWeek = (getDay(firstDate) + 6) % 7; // Monday = 0, Sun = 6
  const leadingBlanks = Array.from({ length: firstDayOfWeek });

  const activeDateRec = recordMap.get(activeSelectedDate);
  const activeDateStatus = activeDateRec ? activeDateRec.status : 'Not Marked';
  const activeDateOT = activeDateRec?.overtimeHours || 0;
  const activeDateIsThu = isThursday(activeSelectedDate);
  const activeDateHoliday = holidayMap.get(activeSelectedDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] ring-1 ring-slate-900/5">
        {/* Modern Gradient Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-blue-700 via-indigo-600 to-slate-900 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={employee.fullName}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 backdrop-blur-md text-white font-black flex items-center justify-center text-lg border border-white/20 shadow-md shrink-0">
                {employee.fullName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight truncate">{employee.fullName}</h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/15 border border-white/20 text-blue-100">
                  {employee.employeeId}
                </span>
              </div>
              <p className="text-[11px] text-blue-200 font-medium truncate">
                {employee.designation} • {employee.overtimeRate ? `OT Rate: ₹${employee.overtimeRate}/hr` : 'Auto OT Rate'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer backdrop-blur-sm shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Selector & Key KPI Badges Bar */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          {/* Prev / Next Month Navigator */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-2.5 sm:px-3 py-1.5 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer active:scale-95"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-black text-slate-900 min-w-[120px] sm:min-w-[130px] text-center">
              {formatMonthYear(year, month)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer active:scale-95"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* KPI Stat Chips */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 text-xs font-bold">
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1 shadow-2xs text-[11px] sm:text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>P: <strong>{present}</strong></span>
            </div>
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-1 shadow-2xs text-[11px] sm:text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>A: <strong>{absent}</strong></span>
            </div>
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 flex items-center gap-1 shadow-2xs text-[11px] sm:text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span>HL: <strong>{halfDay}</strong></span>
            </div>
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 flex items-center gap-1 shadow-2xs text-[11px] sm:text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>PL: <strong>{paidLeave}</strong></span>
            </div>
            {totalOvertimeHours > 0 && (
              <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-1 shadow-2xs text-[11px] sm:text-xs font-black">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>OT: {totalOvertimeHours}h</span>
              </div>
            )}
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1 shadow-2xs text-[11px] sm:text-xs">
              <span>{rate}%</span>
            </div>
          </div>
        </div>

        {/* Quick Bulk Action Banner */}
        <div className="px-3.5 sm:px-5 py-1.5 sm:py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-medium text-[11px] hidden sm:inline">
            Tap any working day to mark status & overtime hours.
          </span>
          <button
            type="button"
            disabled={isMarkingAll}
            onClick={handleMarkAllMonthPresent}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition cursor-pointer disabled:opacity-50 ml-auto text-[11px] active:scale-95"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{isMarkingAll ? 'Marking...' : 'Mark All Working Days Present'}</span>
          </button>
        </div>

        {/* --- 7-Column Clean Minimal Color-Coded Calendar Matrix Grid (Soft Light Tints) --- */}
        <div className="p-2 sm:p-4 overflow-y-auto flex-1">
          {/* Weekday Column Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center mb-1.5 sm:mb-2">
            {weekDays.map(w => (
              <div
                key={w.name}
                className={`py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-black tracking-wide uppercase border ${
                  w.isOff
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <span>{w.name}</span>
              </div>
            ))}
          </div>

          {/* Calendar Tiles */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Blank padding cells before 1st of month */}
            {leadingBlanks.map((_, i) => (
              <div
                key={`blank-${i}`}
                className="aspect-square sm:aspect-auto sm:h-14 rounded-xl sm:rounded-2xl bg-slate-50/40 border border-dashed border-slate-200/50 opacity-20"
              />
            ))}

            {/* Actual Days of Month - Clean Soft Pastel Color Tiles */}
            {datesInMonth.map(dateStr => {
              const dayNum = getDayNumber(dateStr);
              const isThu = isThursday(dateStr);
              const holiday = holidayMap.get(dateStr);
              const rec = recordMap.get(dateStr);
              const status: AttendanceStatus = rec ? rec.status : 'Not Marked';
              const hasOT = Boolean(rec?.overtimeHours && rec.overtimeHours > 0);
              const isSelected = activeSelectedDate === dateStr;

              // Soft elegant light colors
              const getTileStyle = () => {
                if (holiday) {
                  return 'bg-amber-50/90 border-amber-300 text-amber-900 font-bold hover:bg-amber-100';
                }
                if (isThu && status === 'Not Marked') {
                  return 'bg-slate-100 border-slate-200 text-slate-400 font-medium';
                }
                if (status === 'Present') {
                  return 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100/80 shadow-2xs';
                }
                if (status === 'Absent') {
                  return 'bg-rose-50 border-rose-300 text-rose-800 font-bold hover:bg-rose-100/80 shadow-2xs';
                }
                if (status === 'Half Day') {
                  return 'bg-orange-50 border-orange-300 text-orange-800 font-bold hover:bg-orange-100/80 shadow-2xs';
                }
                if (status === 'Paid Leave') {
                  return 'bg-sky-50 border-sky-300 text-sky-800 font-bold hover:bg-sky-100/80 shadow-2xs';
                }
                return 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50/40 hover:border-blue-300 font-semibold';
              };

              return (
                <button
                  type="button"
                  key={dateStr}
                  onClick={() => {
                    setSelectedTileDate(dateStr);
                    setCustomOtInput(rec?.overtimeHours ? String(rec.overtimeHours) : '');
                  }}
                  className={`aspect-square sm:aspect-auto sm:h-14 rounded-xl sm:rounded-2xl border transition-all flex flex-col items-center justify-center cursor-pointer select-none relative active:scale-95 ${getTileStyle()} ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-2 scale-105 z-10 shadow-sm'
                      : 'shadow-2xs'
                  }`}
                  title={`${formatIndianDate(dateStr)} — ${
                    holiday ? holiday.name : isThu && status === 'Not Marked' ? 'Weekly Off (Thursday)' : status
                  }${hasOT ? ` (+${rec?.overtimeHours}h Overtime)` : ''}`}
                >
                  <span className="text-xs sm:text-base font-bold tracking-tight">
                    {dayNum}
                  </span>
                  {hasOT && (
                    <span className="text-[9px] sm:text-[10px] font-black px-1 py-0.2 rounded-full bg-amber-200 text-amber-900 border border-amber-400 mt-0.5 leading-none">
                      +{rec?.overtimeHours}h
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Color Legend (Subtle visual aid) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 pt-2.5 mt-1.5 text-[10px] sm:text-[11px] font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-100 border border-emerald-300 shrink-0" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-100 border border-rose-300 shrink-0" />
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-100 border border-orange-300 shrink-0" />
              <span>Half Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-sky-100 border border-sky-300 shrink-0" />
              <span>Paid Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-200 border border-amber-400 shrink-0" />
              <span>+OT Hours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-100 border border-slate-200 shrink-0" />
              <span>Thursday Off</span>
            </div>
          </div>
        </div>

        {/* --- Mobile-Friendly Quick Status & Overtime Action Dock --- */}
        {activeSelectedDate && (
          <div className="p-3 bg-blue-50/95 border-t border-blue-200 flex flex-col gap-2.5 shrink-0">
            {/* Header of selected day & saved confirmation badge */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-blue-950">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>{formatIndianDate(activeSelectedDate)} ({formatDisplayDate(activeSelectedDate, 'EEE')})</strong>
                </span>
                <span className="text-slate-500 font-medium text-[11px]">
                  {activeDateHoliday
                    ? `[Holiday: ${activeDateHoliday.name}]`
                    : activeDateIsThu && activeDateStatus === 'Not Marked'
                    ? '[Thursday Weekly Off]'
                    : `(${activeDateStatus}${activeDateOT > 0 ? `, +${activeDateOT}h OT` : ''})`}
                </span>
              </div>

              {savedFeedback && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[11px] shadow-sm animate-in fade-in zoom-in-95 duration-150">
                  <span>{savedFeedback}</span>
                </span>
              )}
            </div>

            {/* Row 1: 4 Status Buttons (Present, Absent, Half Day, Paid Leave) */}
            <div className="grid grid-cols-4 gap-1.5 w-full shrink-0">
              <button
                type="button"
                onClick={() => handleStatusClick(activeSelectedDate, 'Present')}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 whitespace-nowrap text-center flex items-center justify-center gap-1 shrink-0 ${
                  activeDateStatus === 'Present'
                    ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/30'
                    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                }`}
                title="Mark Present (P)"
              >
                <span>✓ Present</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusClick(activeSelectedDate, 'Absent')}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 whitespace-nowrap text-center flex items-center justify-center gap-1 shrink-0 ${
                  activeDateStatus === 'Absent'
                    ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/30'
                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                }`}
                title="Mark Absent (A)"
              >
                <span>✕ Absent</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusClick(activeSelectedDate, 'Half Day')}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 whitespace-nowrap text-center flex items-center justify-center gap-1 shrink-0 ${
                  activeDateStatus === 'Half Day'
                    ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-500/30'
                    : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
                }`}
                title="Mark Half Day (HL)"
              >
                <span>½ Half Day</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusClick(activeSelectedDate, 'Paid Leave')}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 whitespace-nowrap text-center flex items-center justify-center gap-1 shrink-0 ${
                  activeDateStatus === 'Paid Leave'
                    ? 'bg-sky-600 text-white border-sky-700 ring-2 ring-sky-500/30'
                    : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                }`}
                title="Mark Paid Leave (PL)"
              >
                <span>Paid Leave</span>
              </button>
            </div>

            {/* Row 2: Direct Custom Overtime Hours Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-blue-200/60 text-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Overtime Hours (OT):</span>
                {activeDateOT > 0 ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px]">
                    {activeDateOT}h Set
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium text-[11px]">0h</span>
                )}
              </div>

              {/* Direct Custom OT Input Form */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const val = parseFloat(customOtInput);
                  handleOvertimeClick(activeSelectedDate, !isNaN(val) && val >= 0 ? val : 0);
                }}
                className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto"
              >
                <div className="relative flex-1 sm:w-28">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    placeholder="e.g. 1.5, 2, 3"
                    value={customOtInput}
                    onChange={e => setCustomOtInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-black text-slate-900 bg-white border border-slate-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                    hrs
                  </span>
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs active:scale-95 cursor-pointer shadow-2xs transition whitespace-nowrap"
                >
                  Save OT
                </button>

                {activeDateOT > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomOtInput('');
                      handleOvertimeClick(activeSelectedDate, 0);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs active:scale-95 cursor-pointer shadow-2xs transition whitespace-nowrap"
                    title="Clear Overtime for this date"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500 font-medium text-[11px]">
            <span>Standard: <strong>8 hrs/day</strong></span>
            <span>•</span>
            <span>OT added to base pay</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
