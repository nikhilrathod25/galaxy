import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  CalendarCheck,
  UserPlus,
  HardDriveDownload,
  Upload,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  FileBarChart,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { HolidayRepository } from '../repositories/holidayRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { BackupService } from '../services/backupService';
import { calculateMonthlySalary } from '../services/salaryEngine';
import { formatINR } from '../utils/currencyUtils';
import { getTodayDateString, formatMonthYear, formatDisplayDate } from '../utils/dateUtils';
import { Employee, AttendanceRecord, CompanySettings } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const DashboardPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [totalPayroll, setTotalPayroll] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = getTodayDateString();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const emps = await EmployeeRepository.getAll();
      setEmployees(emps);

      const comp = await SettingsRepository.getCompanySettings();
      setCompany(comp);

      const meta = await SettingsRepository.getBackupMeta();
      setLastBackupAt(meta.lastBackupAt);

      // Load today's attendance
      const todayRecs = await AttendanceRepository.getByDate(todayStr);
      setTodayAttendance(todayRecs);

      // Calculate current month's estimated payroll
      const monthRecs = await AttendanceRepository.getMonthAttendance(currentYear, currentMonth);
      const holidays = await HolidayRepository.getByYear(currentYear);
      const salarySettings = await SettingsRepository.getSalarySettings();

      let payrollSum = 0;
      emps.filter(e => e.status === 'Active').forEach(emp => {
        const empAttendance = monthRecs.filter(r => r.employeeId === emp.employeeId);
        const breakdown = calculateMonthlySalary({
          employee: emp,
          year: currentYear,
          month: currentMonth,
          attendance: empAttendance,
          holidays,
          calculationMode: salarySettings.defaultCalculationMode,
        });
        payrollSum += breakdown.finalSalary;
      });

      setTotalPayroll(payrollSum);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDirectExport = async () => {
    try {
      const backupData = await BackupService.exportFullBackup();
      BackupService.downloadBackupFile(backupData);
      const meta = await SettingsRepository.getBackupMeta();
      setLastBackupAt(meta.lastBackupAt);
      setBackupSuccessMsg('Full JSON backup successfully exported to your device.');
      setTimeout(() => setBackupSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to export backup: ' + err.message);
    }
  };

  const handleDirectImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const validation = BackupService.validateBackupJSON(text);

      if (!validation.isValid) {
        alert('Invalid backup file: ' + validation.errors.join(', '));
        return;
      }

      const backupData = JSON.parse(text);
      await BackupService.importBackup(backupData, 'merge');
      setBackupSuccessMsg('Database backup imported and merged successfully!');
      setTimeout(() => setBackupSuccessMsg(''), 4000);
      await loadDashboardData();
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const activeEmployees = employees.filter(e => e.status === 'Active');
  const todayMap = new Map(todayAttendance.map(r => [r.employeeId, r]));

  const presentCount = activeEmployees.filter(e => todayMap.get(e.employeeId)?.status === 'Present').length;
  const halfDayCount = activeEmployees.filter(e => todayMap.get(e.employeeId)?.status === 'Half Day').length;
  const absentCount = activeEmployees.filter(e => todayMap.get(e.employeeId)?.status === 'Absent').length;
  const leaveCount = activeEmployees.filter(e => {
    const status = todayMap.get(e.employeeId)?.status;
    return status === 'Paid Leave' || status === 'Unpaid Leave';
  }).length;
  const notMarkedCount = activeEmployees.length - (presentCount + halfDayCount + absentCount + leaveCount);

  const isBackupOverdue = !lastBackupAt || (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 3600 * 24) > 7;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>StaffPay Overview</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Welcome, {company?.companyName || 'Manager'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {formatDisplayDate(new Date().toISOString(), 'EEEE, dd MMMM yyyy')} • {formatMonthYear(currentYear, currentMonth)} Payroll Cycle
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/attendance"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-bold transition-all shadow-sm shadow-orange-500/20 active:scale-[0.98]"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Daily Attendance</span>
          </Link>
          <Link
            to="/employees/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4 text-orange-300" />
            <span>Add Staff</span>
          </Link>
        </div>
      </div>

      {backupSuccessMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{backupSuccessMsg}</span>
        </div>
      )}

      {isBackupOverdue && !backupSuccessMsg && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-orange-900">
                Backup Reminder: Export Your Data
              </h4>
              <p className="text-xs text-orange-700 mt-0.5 font-medium">
                StaffPay stores data locally in your browser. Export regular JSON backups to prevent accidental data loss.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDirectExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-sm self-end sm:self-center"
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>Export Backup Now</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Employees</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{activeEmployees.length}</div>
            <Link to="/employees" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold mt-2">
              <span>View directory</span>
              <ArrowRight className="w-3 h-3 text-orange-500" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Present Today</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{presentCount}</div>
            <span className="text-xs text-slate-500 font-medium block mt-2">
              {halfDayCount > 0 && `${halfDayCount} half-day `}
              {notMarkedCount > 0 && `${notMarkedCount} not marked`}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Absent / Leave</span>
            <div className="text-2xl font-black text-orange-600 mt-1">{absentCount + leaveCount}</div>
            <Link to="/attendance" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold mt-2">
              <span>Update status</span>
              <ArrowRight className="w-3 h-3 text-orange-500" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
            <UserX className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{formatMonthYear(currentYear, currentMonth)} Payroll</span>
            <div className="text-xl font-black text-slate-900 mt-1">{formatINR(totalPayroll)}</div>
            <Link to="/salary" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold mt-2">
              <span>Process salaries</span>
              <ArrowRight className="w-3 h-3 text-orange-500" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Today's Staff Status</h3>
              <p className="text-xs text-slate-400 font-medium">{formatDisplayDate(todayStr, 'dd MMMM yyyy')}</p>
            </div>
            <Link to="/attendance" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <span>Mark Attendance</span>
              <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
            </Link>
          </div>
          {activeEmployees.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">No active employees added yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeEmployees.slice(0, 6).map(emp => {
                const status = todayMap.get(emp.employeeId)?.status || 'Not Marked';
                return (
                  <div key={emp.employeeId} className="flex items-center justify-between py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={emp.fullName} className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs border border-blue-100">{emp.fullName.charAt(0)}</div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-slate-800">{emp.fullName}</div>
                        <div className="text-xs text-slate-400 font-mono">{emp.designation}</div>
                      </div>
                    </div>
                    <StatusBadge status={status} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <HardDriveDownload className="w-4 h-4 text-orange-500" />
                <span>Full Backup & Import</span>
              </h3>
              <Link to="/backup" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">All Options →</Link>
            </div>
            <p className="text-xs text-slate-500 font-medium">Download a complete JSON backup of all data to your device, or import an existing file.</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={handleDirectExport} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-sm shadow-orange-500/20 active:scale-[0.98]">
                <HardDriveDownload className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50">
                <Upload className="w-4 h-4 text-orange-300" />
                <span>{isImporting ? 'Importing...' : 'Import'}</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleDirectImportFile} className="hidden" />
            <div className="text-[11px] text-slate-400 font-medium text-center pt-1">
              {lastBackupAt ? `Last Backup: ${formatDisplayDate(lastBackupAt, 'dd MMM yyyy, hh:mm a')}` : 'No backup found.'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-blue-600" />
                <span>Reports & Statements</span>
              </h3>
              <Link to="/reports" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">Open Hub →</Link>
            </div>
            <div className="space-y-2">
              <Link to="/reports" className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 transition-colors text-xs font-semibold text-slate-700 hover:text-blue-700">
                <div className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-blue-600" /> <span>Attendance Matrix CSV</span></div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/reports" className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-100 transition-colors text-xs font-semibold text-slate-700 hover:text-orange-700">
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-500" /> <span>Salary Statement</span></div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link to="/holidays" className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 transition-colors text-xs font-semibold text-slate-700 hover:text-blue-700">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> <span>Holidays Calendar</span></div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
