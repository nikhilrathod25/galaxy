import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Download,
  Lock,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  Users,
  Eye,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { HolidayRepository } from '../repositories/holidayRepository';
import { SalaryRepository } from '../repositories/salaryRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { calculateMonthlySalary } from '../services/salaryEngine';
import { CSVService } from '../services/csvService';
import { SalarySlipModal } from '../components/salary/SalarySlipModal';
import { FinalizeMonthModal } from '../components/salary/FinalizeMonthModal';
import { EmptyState } from '../components/common/EmptyState';
import {
  Employee,
  AttendanceRecord,
  Holiday,
  MonthlySalaryBreakdown,
  FinalizedSalaryRecord,
  CompanySettings,
  SalaryCalculationMode,
} from '../types';
import { formatINR } from '../utils/currencyUtils';
import { formatMonthYear } from '../utils/dateUtils';

export const SalaryPage: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calculationMode, setCalculationMode] = useState<SalaryCalculationMode>('working_days');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [finalizedRecords, setFinalizedRecords] = useState<FinalizedSalaryRecord[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);

  const [selectedSlip, setSelectedSlip] = useState<MonthlySalaryBreakdown | FinalizedSalaryRecord | null>(null);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load base data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const emps = await EmployeeRepository.getAll();
        setEmployees(emps);

        const comp = await SettingsRepository.getCompanySettings();
        setCompany(comp);

        const salarySettings = await SettingsRepository.getSalarySettings();
        setCalculationMode(salarySettings.defaultCalculationMode);

        const hols = await HolidayRepository.getByYear(year);
        setHolidays(hols);

        const att = await AttendanceRepository.getMonthAttendance(year, month);
        setAttendance(att);

        const finalized = await SalaryRepository.getByMonth(year, month);
        setFinalizedRecords(finalized);
      } catch (err) {
        console.error('Error loading salary page:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [year, month]);

  // Compute calculated salaries for each active employee
  const calculatedSalaries = useMemo(() => {
    const finalizedMap = new Map(finalizedRecords.map(r => [r.employeeId, r]));

    return employees.map(emp => {
      const existingFinalized = finalizedMap.get(emp.employeeId);
      if (existingFinalized) {
        return existingFinalized;
      }

      const empAttendance = attendance.filter(r => r.employeeId === emp.employeeId);
      return calculateMonthlySalary({
        employee: emp,
        year,
        month,
        attendance: empAttendance,
        holidays,
        calculationMode,
      });
    });
  }, [employees, attendance, holidays, year, month, calculationMode, finalizedRecords]);

  // Totals
  const summary = useMemo(() => {
    let grossTotal = 0;
    let deductionTotal = 0;
    let netTotal = 0;
    let finalizedCount = 0;

    calculatedSalaries.forEach(s => {
      grossTotal += s.monthlySalary;
      deductionTotal += s.totalDeductions;
      netTotal += s.finalSalary;
      if (s.isFinalized) finalizedCount++;
    });

    return { grossTotal, deductionTotal, netTotal, finalizedCount };
  }, [calculatedSalaries]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleFinalizeAll = async (notes?: string) => {
    const nowIso = new Date().toISOString();
    for (const s of calculatedSalaries) {
      const record: FinalizedSalaryRecord = {
        id: `${s.employeeId}_${year}_${String(month).padStart(2, '0')}`,
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        designation: s.designation,
        year,
        month,
        monthlySalary: s.monthlySalary,
        calculationMode: s.calculationMode,
        calendarDays: s.calendarDays,
        effectiveWorkingDays: s.effectiveWorkingDays,
        presentDays: s.presentDays,
        absentDays: s.absentDays,
        halfDays: s.halfDays,
        paidLeaveDays: s.paidLeaveDays,
        unpaidLeaveDays: s.unpaidLeaveDays,
        notMarkedDays: s.notMarkedDays,
        dailySalary: s.dailySalary,
        absentDeduction: s.absentDeduction,
        halfDayDeduction: s.halfDayDeduction,
        unpaidLeaveDeduction: s.unpaidLeaveDeduction,
        totalDeductions: s.totalDeductions,
        finalSalary: s.finalSalary,
        isFinalized: true,
        finalizedAt: nowIso,
        notes: notes || 'Bulk monthly finalization',
        updatedAt: nowIso,
      };
      await SalaryRepository.saveFinalizedRecord(record);
    }

    const updatedFinalized = await SalaryRepository.getByMonth(year, month);
    setFinalizedRecords(updatedFinalized);
    setFinalizeModalOpen(false);
  };

  const handleExportCSV = () => {
    CSVService.exportSalarySheet(year, month, calculatedSalaries);
  };

  if (employees.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={Users}
        title="No employees registered yet"
        description="Add employees to calculate salaries and generate payslips."
        actionLabel="Add First Employee"
        onAction={() => (window.location.href = '#/employees/create')}
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Top Header & Month Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Salary & Payroll Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Automated attendance-based salary calculations & instant PDF payslips
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV Statement */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>

          {/* Finalize Month Action */}
          <button
            type="button"
            onClick={() => setFinalizeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-xs shadow-orange-500/20 active:scale-95 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Finalize Month</span>
          </button>
        </div>
      </div>

      {/* Month Navigator Toolbar & Calculation Mode Switch */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-black text-slate-900 min-w-[150px] text-center">
            {formatMonthYear(year, month)}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calculation Rule Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
          <span>Rule:</span>
          <select
            value={calculationMode}
            onChange={e => setCalculationMode(e.target.value as SalaryCalculationMode)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="working_days">Working Days (Excl. Sundays)</option>
            <option value="calendar_days">Calendar Days (Full Month Days)</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Base Payroll
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatINR(summary.grossTotal)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block font-medium">
            {employees.length} Registered Staff
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            Total Deductions
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            -{formatINR(summary.deductionTotal)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block font-medium">
            Absent & half-day deductions
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-blue-600 text-white shadow-xs border border-blue-700">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-200">
            Net Payable Payroll
          </span>
          <div className="text-2xl font-black text-white mt-1">
            {formatINR(summary.netTotal, true)}
          </div>
          <span className="text-xs text-blue-100 mt-1 block font-semibold">
            {summary.finalizedCount} / {employees.length} Finalized
          </span>
        </div>
      </div>

      {/* Compact Staff Payroll Table / Roster (No massive scrolling!) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Staff Payroll Summary for {formatMonthYear(year, month)}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Click "View Payslip / Breakdown" to see itemized deduction calculations and print PDF slip
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Base Salary</th>
                <th className="px-5 py-3.5">Attendance Summary</th>
                <th className="px-5 py-3.5">Deductions</th>
                <th className="px-5 py-3.5">Net Payable</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedSalaries.map(salary => {
                const isFinal = salary.isFinalized;
                return (
                  <tr key={salary.employeeId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-sm border border-blue-200">
                          {salary.employeeName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{salary.employeeName}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {salary.employeeId} • {salary.designation}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {formatINR(salary.monthlySalary)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {salary.presentDays}P
                        </span>
                        {salary.absentDays > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                            {salary.absentDays}A
                          </span>
                        )}
                        {salary.halfDays > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                            {salary.halfDays}HD
                          </span>
                        )}
                        {salary.paidLeaveDays > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                            {salary.paidLeaveDays}PL
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-bold text-rose-600">
                      {salary.totalDeductions > 0
                        ? `-${formatINR(salary.totalDeductions)}`
                        : '₹0'}
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-base font-black text-blue-700">
                        {formatINR(salary.finalSalary, true)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {isFinal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Finalized</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <span>Draft</span>
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(salary)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shadow-blue-600/20 active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-orange-300" />
                        <span>View Payslip</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip & Calculation Detail Modal */}
      {selectedSlip && company && (
        <SalarySlipModal
          isOpen={Boolean(selectedSlip)}
          onClose={() => setSelectedSlip(null)}
          salary={selectedSlip}
          company={company}
        />
      )}

      {/* Bulk Finalize Month Modal */}
      <FinalizeMonthModal
        isOpen={finalizeModalOpen}
        onClose={() => setFinalizeModalOpen(false)}
        onConfirmFinalize={handleFinalizeAll}
        year={year}
        month={month}
        totalEmployees={employees.length}
      />
    </div>
  );
};
