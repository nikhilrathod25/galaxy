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
  Building2,
  FileText,
  UserCheck,
  UserX,
  Trash2,
  AlertTriangle,
  History,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
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
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/employees"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Toggle Button */}
          <button
            type="button"
            onClick={() => setConfirmToggleStatusOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
              employee.status === 'Active'
                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {employee.status === 'Active' ? (
              <>
                <UserX className="w-3.5 h-3.5 text-slate-500" />
                <span>Deactivate</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Activate</span>
              </>
            )}
          </button>

          {/* Edit Profile Button */}
          <Link
            to={`/employees/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98]"
          >
            <Edit2 className="w-3.5 h-3.5 text-orange-300" />
            <span>Edit Profile</span>
          </Link>

          {/* Delete Employee Button */}
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
            title="Delete Employee"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {employee.photoUrl ? (
            <img
              src={employee.photoUrl}
              alt={employee.fullName}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-blue-200 shadow-sm"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-3xl border border-blue-200 shadow-sm">
              {employee.fullName.charAt(0)}
            </div>
          )}

          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">{employee.fullName}</h2>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                {employee.employeeId}
              </span>
              <StatusBadge status={employee.status} size="sm" />
            </div>

            <p className="text-sm font-semibold text-slate-500">{employee.designation}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Joined {formatDisplayDate(employee.joiningDate, 'dd MMM yyyy')}</span>
              </div>
              {employee.endDate && (
                <div className="flex items-center gap-1.5 text-rose-500 font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Left {formatDisplayDate(employee.endDate, 'dd MMM yyyy')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 text-right self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
            <span className="text-[11px] uppercase tracking-wider font-bold text-orange-700">
              Monthly Salary
            </span>
            <span className="text-2xl font-black text-orange-600 mt-1">
              {formatINR(employee.monthlySalary)}
            </span>
          </div>
        </div>

        {/* Contact & Address Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-100 text-xs font-medium">
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{employee.phone || 'No phone provided'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{employee.email || 'No email provided'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{employee.address || 'No address provided'}</span>
          </div>
        </div>

        {employee.notes && (
          <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium">
            <strong className="text-slate-800">Notes: </strong>
            {employee.notes}
          </div>
        )}
      </div>

      {/* Attendance History Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Attendance Log</h3>
              <p className="text-xs text-slate-400 font-medium">
                Daily attendance breakdown for {employee.fullName}
              </p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-2 min-w-[120px] text-center">
              {formatMonthYear(currentDate.getFullYear(), currentDate.getMonth() + 1)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Monthly Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
            <span className="text-[11px] text-emerald-700 block">Present</span>
            <span className="text-lg font-black text-emerald-600">{presentCount} days</span>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-medium">
            <span className="text-[11px] text-rose-700 block">Absent</span>
            <span className="text-lg font-black text-rose-600">{absentCount} days</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-medium">
            <span className="text-[11px] text-amber-700 block">Half Day</span>
            <span className="text-lg font-black text-amber-600">{halfDayCount} days</span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-medium">
            <span className="text-[11px] text-blue-700 block">Paid Leave</span>
            <span className="text-lg font-black text-blue-600">{paidLeaveCount} days</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium">
            <span className="text-[11px] text-slate-500 block">Unpaid Leave</span>
            <span className="text-lg font-black text-slate-700">{unpaidLeaveCount} days</span>
          </div>
        </div>

        {/* Attendance Log Table */}
        {attendance.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">
            No attendance recorded for {formatMonthYear(currentDate.getFullYear(), currentDate.getMonth() + 1)} yet.
            <div className="mt-2">
              <Link
                to="/attendance"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
              >
                <span>Go to Attendance Hub to Mark</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Note</th>
                  <th className="px-4 py-2.5 text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {attendance
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((rec) => {
                    const getBadgeStyle = () => {
                      if (rec.status === 'Present') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      if (rec.status === 'Absent') return 'bg-rose-50 text-rose-700 border-rose-200';
                      if (rec.status === 'Half Day') return 'bg-amber-50 text-amber-700 border-amber-200';
                      if (rec.status === 'Paid Leave') return 'bg-blue-50 text-blue-700 border-blue-200';
                      return 'bg-slate-50 text-slate-600 border-slate-200';
                    };

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-800">
                          {formatDisplayDate(rec.date, 'dd MMM yyyy (EEE)')}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${getBadgeStyle()}`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-normal">
                          {rec.note || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400 font-mono text-[10px]">
                          {rec.updatedAt ? formatDisplayDate(rec.updatedAt, 'dd MMM, hh:mm a') : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Salary History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Finalized Salary History</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-semibold">
            {salaryHistory.length} record(s)
          </span>
        </div>

        {salaryHistory.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm font-medium">
            No finalized salary snapshots for this employee yet. You can finalize salaries in the Salary & Payroll section.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Base Salary</th>
                  <th className="px-4 py-3">Working</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Absent/HD</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net Pay</th>
                  <th className="px-4 py-3 text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {salaryHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {formatMonthYear(rec.year, rec.month)}
                    </td>
                    <td className="px-4 py-3">{formatINR(rec.monthlySalary)}</td>
                    <td className="px-4 py-3">{rec.effectiveWorkingDays}</td>
                    <td className="px-4 py-3 text-blue-600">{rec.presentDays}</td>
                    <td className="px-4 py-3 text-rose-600">
                      {rec.absentDays} abs / {rec.halfDays} hd
                    </td>
                    <td className="px-4 py-3 text-rose-600">
                      -{formatINR(rec.totalDeductions)}
                    </td>
                    <td className="px-4 py-3 font-black text-blue-700">
                      {formatINR(rec.finalSalary, true)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(rec)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
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
