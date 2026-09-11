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
import { formatMonthYear, getDatesInMonth } from '../utils/dateUtils';

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
        totalOvertimeHours: (s as any).totalOvertimeHours || 0,
        overtimeEarnings: (s as any).overtimeEarnings || 0,
        hourlyOvertimeRate: (s as any).hourlyOvertimeRate || 0,
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

  // Month eligibility for finalization (only past months OR on/after last day of current month)
  const isMonthEligibleToFinalize = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    const curDay = today.getDate();

    if (year < curYear) return true;
    if (year === curYear && month < curMonth) return true;
    if (year === curYear && month === curMonth) {
      const datesInM = getDatesInMonth(year, month);
      return curDay >= datesInM.length;
    }
    return false;
  }, [year, month]);

  const handleFinalizeSingle = async (s: FinalizedSalaryRecord | MonthlySalaryBreakdown) => {
    const isCurrentlyFinal = s.isFinalized;
    const nowIso = new Date().toISOString();
    const recordId = `${s.employeeId}_${year}_${String(month).padStart(2, '0')}`;

    if (isCurrentlyFinal) {
      if (window.confirm(`Unlock / unfinalize salary record for ${s.employeeName} for ${formatMonthYear(year, month)}?`)) {
        await SalaryRepository.delete(recordId);
        const updatedFinalized = await SalaryRepository.getByMonth(year, month);
        setFinalizedRecords(updatedFinalized);
      }
      return;
    }

    if (!isMonthEligibleToFinalize) {
      const totalDays = getDatesInMonth(year, month).length;
      alert(`Finalize option mahine ke aakhri din (${totalDays} ${formatMonthYear(year, month)}) ko hi active hoga, taaki pure mahine ki attendance complete hone ke baad hi salary lock ki ja sake.`);
      return;
    }

    if (!window.confirm(`Finalize & lock salary for ${s.employeeName} (₹${s.finalSalary.toLocaleString('en-IN')}) for ${formatMonthYear(year, month)}?`)) {
      return;
    }

    const record: FinalizedSalaryRecord = {
      id: recordId,
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
      totalOvertimeHours: (s as any).totalOvertimeHours || 0,
      overtimeEarnings: (s as any).overtimeEarnings || 0,
      hourlyOvertimeRate: (s as any).hourlyOvertimeRate || 0,
      dailySalary: s.dailySalary,
      absentDeduction: s.absentDeduction,
      halfDayDeduction: s.halfDayDeduction,
      unpaidLeaveDeduction: s.unpaidLeaveDeduction,
      totalDeductions: s.totalDeductions,
      finalSalary: s.finalSalary,
      isFinalized: true,
      finalizedAt: nowIso,
      notes: 'Individual employee finalization',
      updatedAt: nowIso,
    };
    await SalaryRepository.saveFinalizedRecord(record);
    const updatedFinalized = await SalaryRepository.getByMonth(year, month);
    setFinalizedRecords(updatedFinalized);
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
            onClick={() => {
              if (!isMonthEligibleToFinalize) {
                const totalDays = getDatesInMonth(year, month).length;
                alert(`Finalize option mahine ke aakhri din (${totalDays} ${formatMonthYear(year, month)}) ko hi active hoga, taaki pure mahine ki attendance complete hone ke baad hi payroll lock ki ja sake.`);
                return;
              }
              setFinalizeModalOpen(true);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
              isMonthEligibleToFinalize
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
            title={
              isMonthEligibleToFinalize
                ? 'Finalize Month Payroll'
                : `Unlocks on last day of month (${getDatesInMonth(year, month).length} ${formatMonthYear(year, month)})`
            }
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

      {/* Compact Staff Payroll Table / Roster */}
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

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 min-w-[220px] whitespace-nowrap">Employee</th>
                <th className="px-5 py-3.5 min-w-[140px] whitespace-nowrap">Base Salary</th>
                <th className="px-5 py-3.5 min-w-[190px] whitespace-nowrap">Attendance Summary</th>
                <th className="px-5 py-3.5 min-w-[140px] whitespace-nowrap">Deductions</th>
                <th className="px-5 py-3.5 min-w-[150px] whitespace-nowrap">Net Payable</th>
                <th className="px-5 py-3.5 min-w-[120px] whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 min-w-[200px] text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedSalaries.map(salary => {
                const isFinal = salary.isFinalized;
                return (
                  <tr key={salary.employeeId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-sm border border-blue-200 shrink-0">
                          {salary.employeeName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 whitespace-nowrap">{salary.employeeName}</div>
                          <div className="text-xs text-slate-400 font-mono whitespace-nowrap">
                            {salary.employeeId} • {salary.designation}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-800 whitespace-nowrap">
                      {formatINR(salary.monthlySalary)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                          {salary.presentDays}P
                        </span>
                        {salary.absentDays > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                            {salary.absentDays}A
                          </span>
                        )}
                        {salary.halfDays > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap shrink-0">
                            {salary.halfDays}HD
                          </span>
                        )}
                        {salary.paidLeaveDays > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap shrink-0">
                            {salary.paidLeaveDays}PL
                          </span>
                        )}
                        {Boolean((salary as any).totalOvertimeHours && (salary as any).totalOvertimeHours > 0) && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold whitespace-nowrap shrink-0">
                            +{(salary as any).totalOvertimeHours}h OT
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-bold text-rose-600 whitespace-nowrap">
                      {salary.totalDeductions > 0
                        ? `-${formatINR(salary.totalDeductions)}`
                        : '₹0'}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-base font-black text-blue-700 whitespace-nowrap">
                        {formatINR(salary.finalSalary, true)}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {isFinal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Finalized</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                          <span>Draft</span>
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* Per-Employee Finalize Lock Badge Button */}
                        <button
                          type="button"
                          onClick={() => handleFinalizeSingle(salary)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap shrink-0 border ${
                            isFinal
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : isMonthEligibleToFinalize
                              ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-500 hover:text-white group/lock'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                          title={
                            isFinal
                              ? 'Salary Locked (Click to Unlock)'
                              : isMonthEligibleToFinalize
                              ? 'Finalize & Lock Salary for this employee'
                              : `Unlocks on last day of month (${getDatesInMonth(year, month).length} ${formatMonthYear(year, month)})`
                          }
                        >
                          {isFinal ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Lock
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isMonthEligibleToFinalize ? 'text-amber-600 group-hover/lock:text-white' : 'text-slate-400'
                              }`}
                            />
                          )}
                          <span className="whitespace-nowrap">{isFinal ? 'Locked' : 'Finalize'}</span>
                        </button>

                        {/* View Payslip Light Badge Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedSlip(salary)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/70 hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-700 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap shrink-0 group/btn"
                          title="View Payslip & Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600 group-hover/btn:text-white shrink-0" />
                          <span className="whitespace-nowrap">View Slip</span>
                        </button>
                      </div>
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
          onSalaryUpdated={async () => {
            const updatedFinalized = await SalaryRepository.getByMonth(year, month);
            setFinalizedRecords(updatedFinalized);
          }}
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
