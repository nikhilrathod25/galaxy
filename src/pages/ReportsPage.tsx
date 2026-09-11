import React, { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Users,
} from 'lucide-react';
import { EmployeeRepository } from '../repositories/employeeRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { HolidayRepository } from '../repositories/holidayRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { calculateMonthlySalary } from '../services/salaryEngine';
import { CSVService } from '../services/csvService';
import { formatINR } from '../utils/currencyUtils';
import { formatMonthYear, formatDisplayDate } from '../utils/dateUtils';
import { Employee, AttendanceRecord, Holiday, MonthlySalaryBreakdown } from '../types';

export const ReportsPage: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reportType, setReportType] = useState<'attendance' | 'salary'>('attendance');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReportData = async () => {
      setIsLoading(true);
      try {
        const emps = await EmployeeRepository.getAll();
        setEmployees(emps);
        const hols = await HolidayRepository.getByYear(year);
        setHolidays(hols);
        const att = await AttendanceRepository.getMonthAttendance(year, month);
        setAttendance(att);
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadReportData();
  }, [year, month]);

  // Compute monthly calculations for all employees
  const salaryBreakdowns = useMemo(() => {
    return employees.map(emp => {
      const empAtt = attendance.filter(r => r.employeeId === emp.employeeId);
      return calculateMonthlySalary({
        employee: emp,
        year,
        month,
        attendance: empAtt,
        holidays,
        calculationMode: 'working_days',
      });
    });
  }, [employees, attendance, holidays, year, month]);

  const handleExportCSV = () => {
    if (reportType === 'attendance') {
      CSVService.exportMonthlyAttendance(year, month, attendance, employees);
    } else {
      CSVService.exportSalarySheet(year, month, salaryBreakdowns);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            Monthly Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Comprehensive attendance matrices, payroll summaries, and audit logs
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-orange-300" />
            <span>Export {reportType === 'attendance' ? 'Attendance' : 'Payroll'} CSV</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Report Type Switcher & Month Navigator */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-100 shadow-sm no-print">
        {/* Report Type Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setReportType('attendance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              reportType === 'attendance'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance Matrix
          </button>
          <button
            type="button"
            onClick={() => setReportType('salary')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              reportType === 'salary'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payroll Summary Sheet
          </button>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              if (month === 1) {
                setYear(year - 1);
                setMonth(12);
              } else {
                setMonth(month - 1);
              }
            }}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
            {formatMonthYear(year, month)}
          </div>
          <button
            onClick={() => {
              if (month === 12) {
                setYear(year + 1);
                setMonth(1);
              } else {
                setMonth(month + 1);
              }
            }}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {reportType === 'attendance'
                ? `Monthly Attendance Matrix — ${formatMonthYear(year, month)}`
                : `Payroll Statement & Deductions — ${formatMonthYear(year, month)}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Generated on {formatDisplayDate(new Date().toISOString())} • {employees.length} Employee(s)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          {reportType === 'attendance' ? (
            /* Attendance Matrix */
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 min-w-[220px] whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3.5 text-center min-w-[120px] whitespace-nowrap">Working Days</th>
                  <th className="px-4 py-3.5 text-center text-blue-700 min-w-[110px] whitespace-nowrap">Present (P)</th>
                  <th className="px-4 py-3.5 text-center text-rose-700 min-w-[110px] whitespace-nowrap">Absent (A)</th>
                  <th className="px-4 py-3.5 text-center text-orange-600 min-w-[120px] whitespace-nowrap">Half Day (HD)</th>
                  <th className="px-4 py-3.5 text-center text-sky-700 min-w-[120px] whitespace-nowrap">Paid Leave (PL)</th>
                  <th className="px-4 py-3.5 text-center text-amber-700 min-w-[130px] whitespace-nowrap">Unpaid Leave (UL)</th>
                  <th className="px-4 py-3.5 text-center text-slate-400 min-w-[110px] whitespace-nowrap">Not Marked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {salaryBreakdowns.map(s => (
                  <tr key={s.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 whitespace-nowrap">{s.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                        <span className="text-blue-600 font-bold">{s.employeeId}</span> • {s.designation}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-700 whitespace-nowrap">
                      {s.effectiveWorkingDays}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-blue-600 whitespace-nowrap">
                      {s.presentDays}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-rose-600 whitespace-nowrap">
                      {s.absentDays}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-orange-500 whitespace-nowrap">
                      {s.halfDays}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-sky-600 whitespace-nowrap">
                      {s.paidLeaveDays}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-amber-600 whitespace-nowrap">
                      {s.unpaidLeaveDays}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-400 whitespace-nowrap">
                      {s.notMarkedDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Salary Sheet */
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 min-w-[220px] whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3.5 min-w-[130px] whitespace-nowrap">Monthly Base</th>
                  <th className="px-4 py-3.5 min-w-[110px] whitespace-nowrap">Daily Rate</th>
                  <th className="px-4 py-3.5 min-w-[120px] whitespace-nowrap">Absent Ded.</th>
                  <th className="px-4 py-3.5 min-w-[130px] whitespace-nowrap">Half Day Ded.</th>
                  <th className="px-4 py-3.5 min-w-[140px] whitespace-nowrap">Unpaid Leave Ded.</th>
                  <th className="px-4 py-3.5 text-rose-600 min-w-[140px] whitespace-nowrap">Total Deductions</th>
                  <th className="px-6 py-3.5 text-right font-bold text-blue-700 min-w-[150px] whitespace-nowrap">Net Final Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {salaryBreakdowns.map(s => (
                  <tr key={s.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 whitespace-nowrap">{s.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                        <span className="text-blue-600 font-bold">{s.employeeId}</span> • {s.designation}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-800 whitespace-nowrap">
                      {formatINR(s.monthlySalary)}
                    </td>
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{formatINR(s.dailySalary)}</td>
                    <td className="px-4 py-4 text-rose-600 whitespace-nowrap">
                      {s.absentDeduction > 0 ? `-${formatINR(s.absentDeduction)}` : '₹0'}
                    </td>
                    <td className="px-4 py-4 text-orange-500 whitespace-nowrap">
                      {s.halfDayDeduction > 0 ? `-${formatINR(s.halfDayDeduction)}` : '₹0'}
                    </td>
                    <td className="px-4 py-4 text-amber-600 whitespace-nowrap">
                      {s.unpaidLeaveDeduction > 0 ? `-${formatINR(s.unpaidLeaveDeduction)}` : '₹0'}
                    </td>
                    <td className="px-4 py-4 font-bold text-rose-700 whitespace-nowrap">
                      {s.totalDeductions > 0 ? `-${formatINR(s.totalDeductions)}` : '₹0'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-sm text-blue-700 whitespace-nowrap">
                      {formatINR(s.finalSalary, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
