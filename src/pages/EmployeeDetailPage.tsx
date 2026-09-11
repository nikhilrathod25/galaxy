import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  UserCheck,
  UserX,
  Trash2,
  History,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { SalaryRepository } from '../repositories/salaryRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { Employee, AttendanceRecord, FinalizedSalaryRecord, CompanySettings } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { SalarySlipModal } from '../components/salary/SalarySlipModal';
import { formatINR } from '../utils/currencyUtils';
import { formatDisplayDate, formatMonthYear } from '../utils/dateUtils';

export const EmployeeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<FinalizedSalaryRecord[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<FinalizedSalaryRecord | null>(null);

  // Month navigation for attendance
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [confirmToggleStatusOpen, setConfirmToggleStatusOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const emp = await EmployeeRepository.getById(parseInt(id, 10));
      if (!emp) {
        navigate('/employees');
        return;
      }
      setEmployee(emp);

      const comp = await SettingsRepository.getCompanySettings();
      setCompany(comp);

      // Load attendance for selected month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const att = await AttendanceRepository.getByEmployeeAndMonth(emp.employeeId, year, month);
      setAttendance(att);

      // Load finalized salary history
      const hist = await SalaryRepository.getByEmployee(emp.employeeId);
      setSalaryHistory(hist);
    } catch (err) {
      console.error('Failed to load employee details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToggleStatus = async () => {
    if (!employee || !employee.id) return;
    const newStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
    await EmployeeRepository.update(employee.id, { status: newStatus });
    setConfirmToggleStatusOpen(false);
    loadData();
  };

  const handleDeleteEmployee = async () => {
    if (!employee || !employee.id) return;
    setIsDeleting(true);
    try {
      await EmployeeRepository.delete(employee.id);
      setConfirmDeleteOpen(false);
      navigate('/employees');
    } catch (err: any) {
      alert(`Failed to delete employee: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!employee) return null;

  // Compute monthly attendance counts
  const presentCount = attendance.filter((a) => a.status === 'Present').length;
  const absentCount = attendance.filter((a) => a.status === 'Absent').length;
  const halfDayCount = attendance.filter((a) => a.status === 'Half Day').length;
  const paidLeaveCount = attendance.filter((a) => a.status === 'Paid Leave').length;
  const unpaidLeaveCount = attendance.filter((a) => a.status === 'Unpaid Leave').length;

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span>Back to Employees</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Toggle Button */}
          <button
            type="button"
            onClick={() => setConfirmToggleStatusOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              employee.status === 'Active'
                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {employee.status === 'Active' ? (
              <>
                <UserX className="w-3.5 h-3.5 text-slate-500" />
                <span>Deactivate</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Activate</span>
              </>
            )}
          </button>

          {/* Edit Profile Button */}
          <Link
            to={`/employees/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs shadow-blue-600/20 active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5 text-orange-300" />
            <span>Edit Profile</span>
          </Link>

          {/* Delete Employee Button */}
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
            title="Delete Employee"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Compact Employee Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={employee.fullName}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-xl border border-blue-200 shadow-2xs shrink-0">
                {employee.fullName.charAt(0)}
              </div>
            )}

            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 truncate">{employee.fullName}</h2>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {employee.employeeId}
                </span>
                <StatusBadge status={employee.status} size="sm" />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                <span className="font-semibold text-slate-700">{employee.designation}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Joined {formatDisplayDate(employee.joiningDate, 'dd MMM yyyy')}
                </span>
                {employee.endDate && (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    Left {formatDisplayDate(employee.endDate, 'dd MMM yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Salary Box & OT Rate */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto px-4 py-2.5 rounded-xl bg-orange-50/80 border border-orange-200 text-orange-950 shrink-0 gap-1">
            <span className="text-[10px] uppercase font-bold text-orange-700">Monthly Basic</span>
            <span className="text-xl font-black text-orange-600">
              {formatINR(employee.monthlySalary)}
            </span>
            <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              OT: {employee.overtimeRate && employee.overtimeRate > 0 ? `₹${employee.overtimeRate}/hr` : 'Auto (Basic ÷ 8h)'}
            </span>
          </div>
        </div>

        {/* Compact Contact Badges if provided */}
        {(employee.phone || employee.email || employee.address) && (
          <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-slate-100 text-xs text-slate-600">
            {employee.phone && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>{employee.phone}</span>
              </div>
            )}
            {employee.email && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>{employee.email}</span>
              </div>
            )}
            {employee.address && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>{employee.address}</span>
              </div>
            )}
          </div>
        )}

        {employee.notes && (
          <div className="mt-2.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <strong className="text-slate-700">Note: </strong>
            {employee.notes}
          </div>
        )}
      </div>

      {/* Attendance Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Attendance Breakdown</h3>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-2 min-w-[110px] text-center">
              {formatMonthYear(currentDate.getFullYear(), currentDate.getMonth() + 1)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Attendance Counter Badges */}
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
            <span className="text-[10px] uppercase font-bold text-blue-600 block">Present</span>
            <span className="text-sm sm:text-base font-black text-blue-700">{presentCount}d</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
            <span className="text-[10px] uppercase font-bold text-rose-600 block">Absent</span>
            <span className="text-sm sm:text-base font-black text-rose-700">{absentCount}d</span>
          </div>
          <div className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-900">
            <span className="text-[10px] uppercase font-bold text-orange-600 block">Half Day</span>
            <span className="text-sm sm:text-base font-black text-orange-600">{halfDayCount}d</span>
          </div>
          <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
            <span className="text-[10px] uppercase font-bold text-sky-600 block">Paid Lv</span>
            <span className="text-sm sm:text-base font-black text-sky-700">{paidLeaveCount}d</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Unpaid</span>
            <span className="text-sm sm:text-base font-black text-slate-700">{unpaidLeaveCount}d</span>
          </div>
        </div>

        {/* Attendance Log Table */}
        {attendance.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No attendance recorded for {formatMonthYear(currentDate.getFullYear(), currentDate.getMonth() + 1)}.
            <div className="mt-2">
              <Link
                to="/attendance"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
              >
                <span>Mark in Attendance Hub</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-h-[235px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Date</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Status</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((rec) => {
                    const badgeColor =
                      rec.status === 'Present'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : rec.status === 'Absent'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : rec.status === 'Half Day'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : rec.status === 'Paid Leave'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200';

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3.5 py-2 font-bold text-slate-800 whitespace-nowrap">
                          {formatDisplayDate(rec.date, 'dd MMM yyyy (EEE)')}
                        </td>
                        <td className="px-3.5 py-2 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeColor}`}>
                              {rec.status}
                            </span>
                            {rec.overtimeHours && rec.overtimeHours > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                +{rec.overtimeHours}h OT
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3.5 py-2 text-slate-500 whitespace-nowrap">
                          {rec.note || '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finalized Salary History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Finalized Salary History</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-semibold">
            {salaryHistory.length} record(s)
          </span>
        </div>

        {salaryHistory.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-xs">
            No finalized salary snapshots yet. You can finalize salaries in the Salary & Payroll module.
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Period</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Base Salary</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Present</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Deductions</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-50">Net Pay</th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap bg-slate-50">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {salaryHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3.5 py-2 font-bold text-slate-800 whitespace-nowrap">
                      {formatMonthYear(rec.year, rec.month)}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap">{formatINR(rec.monthlySalary)}</td>
                    <td className="px-3.5 py-2 text-blue-600 font-bold whitespace-nowrap">{rec.presentDays}d</td>
                    <td className="px-3.5 py-2 text-rose-600 whitespace-nowrap">
                      {rec.totalDeductions > 0 ? `-${formatINR(rec.totalDeductions)}` : '₹0'}
                    </td>
                    <td className="px-3.5 py-2 font-black text-blue-700 whitespace-nowrap">
                      {formatINR(rec.finalSalary, true)}
                    </td>
                    <td className="px-3.5 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Slip</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Salary Slip Modal */}
      {selectedSlip && company && (
        <SalarySlipModal
          isOpen={Boolean(selectedSlip)}
          onClose={() => setSelectedSlip(null)}
          salary={selectedSlip}
          company={company}
        />
      )}

      {/* Status Toggle Confirm */}
      <ConfirmDialog
        isOpen={confirmToggleStatusOpen}
        onClose={() => setConfirmToggleStatusOpen(false)}
        onConfirm={handleToggleStatus}
        title={employee.status === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}
        message={
          employee.status === 'Active'
            ? `Are you sure you want to deactivate ${employee.fullName}? Historical attendance and salary records will be preserved safely.`
            : `Are you sure you want to activate ${employee.fullName}?`
        }
        confirmLabel={employee.status === 'Active' ? 'Deactivate' : 'Activate'}
        variant={employee.status === 'Active' ? 'warning' : 'info'}
      />

      {/* Delete Employee Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteEmployee}
        title="Delete Employee Profile"
        message={`Are you sure you want to permanently delete ${employee.fullName} (${employee.employeeId})? This action cannot be undone.`}
        confirmLabel="Yes, Delete Employee"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
