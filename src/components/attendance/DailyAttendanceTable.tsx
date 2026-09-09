import React, { useState, useMemo } from 'react';
import {
  CheckCheck,
  Search,
  AlertCircle,
  Sparkles,
  LayoutGrid,
  List,
  Check,
  X,
  Clock,
  Palmtree,
  HelpCircle,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { Employee, AttendanceRecord, AttendanceStatus, Holiday } from '../../types';
import { AttendanceStatusSelector } from './AttendanceStatusSelector';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatINR } from '../../utils/currencyUtils';
import { isSunday, isDateStrictlyBefore, isDateStrictlyAfter } from '../../utils/dateUtils';

interface DailyAttendanceTableProps {
  date: string; // YYYY-MM-DD
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  holiday?: Holiday;
  onStatusChange: (employeeId: string, status: AttendanceStatus, note?: string) => Promise<void>;
  onMarkAllPresent: (overwrite: boolean) => Promise<void>;
}

export const DailyAttendanceTable: React.FC<DailyAttendanceTableProps> = ({
  date,
  employees,
  attendanceRecords,
  holiday,
  onStatusChange,
  onMarkAllPresent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('cards');
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [editingNoteEmpId, setEditingNoteEmpId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const isSun = isSunday(date);

  // Map attendance by employeeId
  const attendanceMap = useMemo(() => {
    return new Map(attendanceRecords.map(r => [r.employeeId, r]));
  }, [attendanceRecords]);

  // Calculate day counts and eligibility
  const eligibleEmployees = useMemo(() => {
    return employees.filter(emp => {
      const isBeforeJoin = emp.joiningDate ? isDateStrictlyBefore(date, emp.joiningDate) : false;
      const isAfterExit = emp.endDate ? isDateStrictlyAfter(date, emp.endDate) : false;
      const isInactive = emp.status === 'Inactive';
      return !isBeforeJoin && !isAfterExit && !isInactive;
    });
  }, [employees, date]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let paidLeave = 0;
    let unpaidLeave = 0;
    let notMarked = 0;

    eligibleEmployees.forEach(emp => {
      const record = attendanceMap.get(emp.employeeId);
      const status = record ? record.status : 'Not Marked';

      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
      else if (status === 'Half Day') halfDay++;
      else if (status === 'Paid Leave') paidLeave++;
      else if (status === 'Unpaid Leave') unpaidLeave++;
      else notMarked++;
    });

    const totalEligible = eligibleEmployees.length;
    const totalMarked = totalEligible - notMarked;
    const progressPercent = totalEligible > 0 ? Math.round((totalMarked / totalEligible) * 100) : 0;

    return {
      present,
      absent,
      halfDay,
      paidLeave,
      unpaidLeave,
      notMarked,
      totalEligible,
      totalMarked,
      progressPercent,
    };
  }, [eligibleEmployees, attendanceMap]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(emp => {
      const record = attendanceMap.get(emp.employeeId);
      const status = record ? record.status : 'Not Marked';

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
  }, [employees, searchQuery, statusFilter, attendanceMap]);

  const handleMarkAllConfirm = async () => {
    setIsMarkingAll(true);
    try {
      await onMarkAllPresent(true);
    } finally {
      setIsMarkingAll(false);
      setConfirmMarkAllOpen(false);
    }
  };

  const handleSaveNote = async (employeeId: string) => {
    const record = attendanceMap.get(employeeId);
    const currentStatus = record ? record.status : 'Present';
    await onStatusChange(employeeId, currentStatus, noteText);
    setEditingNoteEmpId(null);
    setNoteText('');
  };

  return (
    <div className="space-y-5 w-full">
      {/* Holiday or Sunday Alert Banner */}
      {holiday && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 shadow-xs">
          <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold text-orange-900">Official Holiday: {holiday.name}</span>
            {holiday.description && (
              <span className="text-orange-700 ml-1.5 font-medium">— {holiday.description}</span>
            )}
            <span className="block text-xs text-orange-600 mt-0.5 font-medium">
              Holidays are automatically counted as paid non-working days in salary calculation.
            </span>
          </div>
        </div>
      )}

      {isSun && !holiday && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 shadow-xs">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm font-semibold text-blue-900">
            Sunday (Weekly Off) — Attendance is not required unless special overtime is marked.
          </div>
        </div>
      )}

      {/* Overview Stat Cards with Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Progress Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Attendance Progress for {date}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {stats.totalMarked} of {stats.totalEligible} staff members marked ({stats.progressPercent}%)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const hasExisting = attendanceRecords.length > 0;
                if (hasExisting) {
                  setConfirmMarkAllOpen(true);
                } else {
                  onMarkAllPresent(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-orange-300" />
              <span>Mark All as Present</span>
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${stats.totalEligible > 0 ? (stats.present / stats.totalEligible) * 100 : 0}%` }}
            title={`Present: ${stats.present}`}
          />
          <div
            className="bg-orange-500 h-full transition-all duration-300"
            style={{ width: `${stats.totalEligible > 0 ? (stats.halfDay / stats.totalEligible) * 100 : 0}%` }}
            title={`Half Day: ${stats.halfDay}`}
          />
          <div
            className="bg-sky-600 h-full transition-all duration-300"
            style={{ width: `${stats.totalEligible > 0 ? (stats.paidLeave / stats.totalEligible) * 100 : 0}%` }}
            title={`Paid Leave: ${stats.paidLeave}`}
          />
          <div
            className="bg-rose-600 h-full transition-all duration-300"
            style={{ width: `${stats.totalEligible > 0 ? (stats.absent / stats.totalEligible) * 100 : 0}%` }}
            title={`Absent: ${stats.absent}`}
          />
        </div>

        {/* Counter Badges / Quick Filter Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-[11px] font-bold block text-slate-500">Total Staff</span>
            <span className="text-xl font-black text-slate-900">{stats.totalEligible}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Present')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'Present'
                ? 'bg-blue-100 border-blue-400 text-blue-900 ring-2 ring-blue-500/20'
                : 'bg-blue-50/60 border-blue-200 text-blue-800 hover:bg-blue-50'
            }`}
          >
            <span className="text-[11px] font-bold block text-blue-600">✓ Present</span>
            <span className="text-xl font-black text-blue-700">{stats.present}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Absent')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'Absent'
                ? 'bg-rose-100 border-rose-400 text-rose-900 ring-2 ring-rose-500/20'
                : 'bg-rose-50/60 border-rose-200 text-rose-800 hover:bg-rose-50'
            }`}
          >
            <span className="text-[11px] font-bold block text-rose-600">✕ Absent</span>
            <span className="text-xl font-black text-rose-700">{stats.absent}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Half Day')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'Half Day'
                ? 'bg-orange-100 border-orange-400 text-orange-900 ring-2 ring-orange-500/20'
                : 'bg-orange-50/60 border-orange-200 text-orange-800 hover:bg-orange-50'
            }`}
          >
            <span className="text-[11px] font-bold block text-orange-600">½ Half Day</span>
            <span className="text-xl font-black text-orange-600">{stats.halfDay}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Paid Leave')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'Paid Leave'
                ? 'bg-sky-100 border-sky-400 text-sky-900 ring-2 ring-sky-500/20'
                : 'bg-sky-50/60 border-sky-200 text-sky-800 hover:bg-sky-50'
            }`}
          >
            <span className="text-[11px] font-bold block text-sky-600">🏖️ Paid Leave</span>
            <span className="text-xl font-black text-sky-700">{stats.paidLeave}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('NOT_MARKED')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'NOT_MARKED'
                ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-500/20'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-[11px] font-bold block text-slate-500">Pending</span>
            <span className="text-xl font-black text-slate-700">{stats.notMarked}</span>
          </button>
        </div>
      </div>

      {/* Filter and View Mode Switcher Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee by name, ID or role..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setDisplayMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card View</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'table'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards View (Easy Mode) */}
      {displayMode === 'cards' ? (
        <div className="space-y-3">
          {filteredEmployees.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 font-medium">
              No employees match the current filter or search.
            </div>
          ) : (
            filteredEmployees.map(emp => {
              const record = attendanceMap.get(emp.employeeId);
              const currentStatus: AttendanceStatus = record ? record.status : 'Not Marked';

              const isBeforeJoin = emp.joiningDate
                ? isDateStrictlyBefore(date, emp.joiningDate)
                : false;
              const isAfterExit = emp.endDate
                ? isDateStrictlyAfter(date, emp.endDate)
                : false;
              const isInactive = emp.status === 'Inactive';
              const isTenureDisabled = isBeforeJoin || isAfterExit || isInactive;

              return (
                <div
                  key={emp.employeeId}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                    currentStatus === 'Present'
                      ? 'border-blue-200 bg-blue-50/10'
                      : currentStatus === 'Absent'
                      ? 'border-rose-200 bg-rose-50/10'
                      : currentStatus === 'Half Day'
                      ? 'border-orange-200 bg-orange-50/10'
                      : currentStatus === 'Paid Leave'
                      ? 'border-sky-200 bg-sky-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Employee Profile Header */}
                    <div className="flex items-center gap-3.5 min-w-[240px]">
                      {emp.photoUrl ? (
                        <img
                          src={emp.photoUrl}
                          alt={emp.fullName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-lg border border-blue-200 shadow-xs">
                          {emp.fullName.charAt(0)}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-base">{emp.fullName}</h4>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {emp.employeeId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                          <span>{emp.designation}</span>
                          <span>•</span>
                          <span>{formatINR(emp.monthlySalary)}/mo</span>
                        </div>
                        {record?.note && (
                          <div className="text-xs text-orange-700 font-medium mt-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Note: {record.note}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attendance Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {isTenureDisabled ? (
                        <div className="text-xs text-slate-400 font-medium italic px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                          {isBeforeJoin
                            ? `Joined on ${emp.joiningDate}`
                            : isAfterExit
                            ? `Left on ${emp.endDate}`
                            : 'Inactive Staff Member'}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <AttendanceStatusSelector
                            value={currentStatus}
                            onChange={newStatus => {
                              onStatusChange(emp.employeeId, newStatus);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* List / Table Mode */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Attendance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => {
                    const record = attendanceMap.get(emp.employeeId);
                    const currentStatus: AttendanceStatus = record ? record.status : 'Not Marked';

                    const isBeforeJoin = emp.joiningDate
                      ? isDateStrictlyBefore(date, emp.joiningDate)
                      : false;
                    const isAfterExit = emp.endDate
                      ? isDateStrictlyAfter(date, emp.endDate)
                      : false;
                    const isInactive = emp.status === 'Inactive';
                    const isTenureDisabled = isBeforeJoin || isAfterExit || isInactive;

                    return (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {emp.photoUrl ? (
                              <img
                                src={emp.photoUrl}
                                alt={emp.fullName}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-sm border border-blue-200">
                                {emp.fullName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{emp.fullName}</div>
                              <div className="text-xs text-slate-400 font-mono">
                                {emp.employeeId}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {emp.designation}
                        </td>

                        <td className="px-6 py-4">
                          {isBeforeJoin ? (
                            <span className="text-xs text-slate-400 italic">
                              Joined {emp.joiningDate}
                            </span>
                          ) : isAfterExit ? (
                            <span className="text-xs text-slate-400 italic">
                              Left {emp.endDate}
                            </span>
                          ) : isInactive ? (
                            <span className="text-xs text-slate-400 italic">Inactive</span>
                          ) : (
                            <StatusBadge status={currentStatus} />
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {isTenureDisabled ? (
                            <span className="text-xs text-slate-400 font-medium">Not Applicable</span>
                          ) : (
                            <AttendanceStatusSelector
                              value={currentStatus}
                              onChange={newStatus => {
                                onStatusChange(emp.employeeId, newStatus);
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explanatory Salary Guide Box */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Understanding Attendance & Salary Calculation:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          <div className="p-2.5 bg-white rounded-xl border border-blue-200">
            <span className="font-bold text-blue-700 block">✓ Present</span>
            <span className="text-slate-500 text-[11px]">Full 1.0 day pay (100% salary).</span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-rose-200">
            <span className="font-bold text-rose-700 block">✕ Absent</span>
            <span className="text-slate-500 text-[11px]">Deducted 1.0 day per-day salary.</span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-orange-200">
            <span className="font-bold text-orange-700 block">½ Half Day</span>
            <span className="text-slate-500 text-[11px]">Deducted 0.5 day (gets 50% pay).</span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-sky-200">
            <span className="font-bold text-sky-700 block">🏖️ Paid Leave</span>
            <span className="text-slate-500 text-[11px]">Approved paid leave (100% pay).</span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-amber-200">
            <span className="font-bold text-amber-700 block">🚫 Unpaid Leave</span>
            <span className="text-slate-500 text-[11px]">Unpaid leave (salary deducted).</span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Overwrite */}
      <ConfirmDialog
        isOpen={confirmMarkAllOpen}
        onClose={() => setConfirmMarkAllOpen(false)}
        onConfirm={handleMarkAllConfirm}
        title="Mark All Present"
        message="Some attendance records already exist for today. Do you want to overwrite all eligible staff members to Present?"
        confirmLabel="Overwrite All to Present"
        cancelLabel="Cancel"
        variant="warning"
        isLoading={isMarkingAll}
      />
    </div>
  );
};
