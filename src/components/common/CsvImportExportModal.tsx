import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Users,
  CalendarCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CSVService, CSVImportResult } from '../../services/csvService';
import { EmployeeRepository } from '../../repositories/employeeRepository';
import { AttendanceRepository } from '../../repositories/attendanceRepository';
import { SalaryRepository } from '../../repositories/salaryRepository';
import { calculateMonthlySalary } from '../../services/salaryEngine';
import { HolidayRepository } from '../../repositories/holidayRepository';
import { formatMonthYear } from '../../utils/dateUtils';
import { Employee, AttendanceRecord, Holiday, FinalizedSalaryRecord } from '../../types';

interface CsvImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportExportModal: React.FC<CsvImportExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importType, setImportType] = useState<'employees' | 'attendance'>('employees');
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [importError, setImportError] = useState<string>('');

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Export Handlers
  const handleExportEmployees = async () => {
    setIsExporting('employees');
    try {
      const emps = await EmployeeRepository.getAll();
      CSVService.exportEmployees(emps);
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportAttendance = async () => {
    setIsExporting('attendance');
    try {
      const emps = await EmployeeRepository.getAll();
      const records = await AttendanceRepository.getMonthAttendance(selectedYear, selectedMonth);
      CSVService.exportMonthlyAttendance(selectedYear, selectedMonth, records, emps);
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportSalary = async () => {
    setIsExporting('salary');
    try {
      const emps = await EmployeeRepository.getAll();
      const records = await AttendanceRepository.getMonthAttendance(selectedYear, selectedMonth);
      const holidays = await HolidayRepository.getByYear(selectedYear);
      const finalized = await SalaryRepository.getByMonth(selectedYear, selectedMonth);
      const finMap = new Map(finalized.map(f => [f.employeeId, f]));

      const calculated = emps.map(emp => {
        const existing = finMap.get(emp.employeeId);
        if (existing) return existing;
        const empAtt = records.filter(r => r.employeeId === emp.employeeId);
        return calculateMonthlySalary({
          employee: emp,
          year: selectedYear,
          month: selectedMonth,
          attendance: empAtt,
          holidays,
          calculationMode: 'working_days',
        });
      });

      CSVService.exportSalarySheet(selectedYear, selectedMonth, calculated);
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // File upload for Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportResult(null);
    setIsImporting(true);

    try {
      let result: CSVImportResult;
      if (importType === 'employees') {
        result = await CSVService.importEmployees(file);
      } else {
        result = await CSVService.importAttendance(file);
      }

      setImportResult(result);
      if (result.successCount > 0) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      }
    } catch (err: any) {
      setImportError(err.message || 'Import failed. Please check CSV format.');
    } finally {
      setIsImporting(false);
      e.target.value = ''; // reset file input
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-orange-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Data Hub — CSV Import & Export</h3>
              <p className="text-xs text-blue-100 font-medium">
                Manage your staff, attendance, and payroll CSV records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setImportResult(null);
              setImportError('');
            }}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Data</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setImportResult(null);
              setImportError('');
            }}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV Data</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Month Selector Filter Bar (Used for Attendance and Salary) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100">
            <div>
              <span className="text-xs font-bold text-blue-900 block">Selected Month Filter:</span>
              <span className="text-[11px] text-blue-700">
                Exports will filter records for this period
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-1.5 bg-white rounded-xl border border-blue-200 text-xs font-black text-blue-900 min-w-[130px] text-center shadow-2xs">
                {formatMonthYear(selectedYear, selectedMonth)}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Export Employees Roster</h4>
                    <p className="text-xs text-slate-500">
                      Download full list of employees with designations, joining dates & salary
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isExporting === 'employees'}
                  onClick={handleExportEmployees}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-orange-300" />
                  <span>{isExporting === 'employees' ? 'Exporting...' : 'Export Employees (CSV)'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Export Monthly Attendance</h4>
                    <p className="text-xs text-slate-500">
                      Export attendance entries for {formatMonthYear(selectedYear, selectedMonth)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isExporting === 'attendance'}
                  onClick={handleExportAttendance}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'attendance' ? 'Exporting...' : 'Export Attendance (CSV)'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Export Payroll & Salary Sheet</h4>
                    <p className="text-xs text-slate-500">
                      Calculated salary, deductions & net pay for {formatMonthYear(selectedYear, selectedMonth)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isExporting === 'salary'}
                  onClick={handleExportSalary}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'salary' ? 'Exporting...' : 'Export Salary (CSV)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Type Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setImportType('employees');
                    setImportResult(null);
                    setImportError('');
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    importType === 'employees'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Employees CSV</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Bulk create or update staff roster</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportType('attendance');
                    setImportResult(null);
                    setImportError('');
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    importType === 'attendance'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <CalendarCheck className="w-4 h-4 text-emerald-600" />
                    <span>Attendance CSV</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Bulk mark dates & statuses</p>
                </button>
              </div>

              {/* Template Download Option */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Need sample format template?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (importType === 'employees') {
                      CSVService.downloadEmployeeTemplate();
                    } else {
                      CSVService.downloadAttendanceTemplate();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample {importType === 'employees' ? 'Employee' : 'Attendance'} CSV</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-6 text-center bg-slate-50/50 transition-colors">
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">
                  Select {importType === 'employees' ? 'Employees' : 'Attendance'} CSV File
                </h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Standard comma-separated .csv file
                </p>

                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95">
                  <Upload className="w-4 h-4" />
                  <span>{isImporting ? 'Processing...' : 'Choose CSV File to Upload'}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isImporting}
                  />
                </label>
              </div>

              {/* Import Result Messages */}
              {importError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <p>
                    Processed <strong>{importResult.totalRows}</strong> rows: Successfully imported{' '}
                    <strong>{importResult.successCount}</strong> records.
                  </p>
                  {importResult.errorCount > 0 && (
                    <div className="mt-2 text-rose-700 space-y-1">
                      <span className="font-bold">{importResult.errorCount} row(s) had issues:</span>
                      <ul className="list-disc pl-4 text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                        {importResult.errors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
