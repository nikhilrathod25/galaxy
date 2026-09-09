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
  AlertTriangle,
  History,
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

  const [confirmToggleStatusOpen, setConfirmToggleStatusOpen] = useState(false);
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

      // Load recent attendance logs
      const now = new Date();
      const att = await AttendanceRepository.getByEmployeeAndMonth(
        emp.employeeId,
        now.getFullYear(),
        now.getMonth() + 1
      );
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
  }, [id]);

  const handleToggleStatus = async () => {
    if (!employee || !employee.id) return;
    const newStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
    await EmployeeRepository.update(employee.id, { status: newStatus });
    setConfirmToggleStatusOpen(false);
    loadData();
  };

  if (!employee) return null;

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/employees"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmToggleStatusOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border ${
              employee.status === 'Active'
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {employee.status === 'Active' ? (
              <>
                <UserX className="w-3.5 h-3.5" />
                <span>Deactivate</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Activate</span>
              </>
            )}
          </button>

          <Link
            to={`/employees/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98]"
          >
            <Edit2 className="w-3.5 h-3.5 text-orange-300" />
            <span>Edit Profile</span>
          </Link>
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
                {salaryHistory.map(rec => (
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
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors"
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
    </div>
  );
};
