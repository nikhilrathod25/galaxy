import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  Calculator as CalcIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Delete,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { MonthlySalaryBreakdown, FinalizedSalaryRecord, CompanySettings } from '../../types';
import { PDFService } from '../../services/pdfService';
import { SalaryRepository } from '../../repositories/salaryRepository';
import { formatMonthYear } from '../../utils/dateUtils';
import { formatINR, numberToWordsINR } from '../../utils/currencyUtils';

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  salary: MonthlySalaryBreakdown | FinalizedSalaryRecord | null;
  company: CompanySettings;
  onSalaryUpdated?: () => Promise<void>;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({
  isOpen,
  onClose,
  salary,
  company,
  onSalaryUpdated,
}) => {
  const [customDeduction, setCustomDeduction] = useState<string>('');
  const [deductionNote, setDeductionNote] = useState<string>('');
  const [showInlineCalc, setShowInlineCalc] = useState<boolean>(false);
  const [calcExpr, setCalcExpr] = useState<string>('');
  const [calcResult, setCalcResult] = useState<string>('0');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync state on salary change
  useEffect(() => {
    if (salary) {
      const existingDeduction = (salary as any).customDeduction || 0;
      setCustomDeduction(existingDeduction > 0 ? String(existingDeduction) : '');
      setDeductionNote((salary as any).notes || '');
      setSaveFeedback(null);
    }
  }, [salary]);

  if (!salary) return null;

  const monthYearStr = formatMonthYear(salary.year, salary.month);

  // Base and Standard Calculations
  const otEarnings = (salary as any).overtimeEarnings || 0;
  const otHours = (salary as any).totalOvertimeHours || 0;
  const otRate = (salary as any).hourlyOvertimeRate || Math.round(salary.dailySalary / 8);
  const grossEarnings = salary.monthlySalary + otEarnings;

  const standardDeductions =
    (salary.absentDeduction || 0) +
    (salary.halfDayDeduction || 0) +
    (salary.unpaidLeaveDeduction || 0);

  const baseCalculatedNet = Math.max(0, grossEarnings - standardDeductions);

  // Custom Deduction from input
  const numCustomDeduction = parseFloat(customDeduction) || 0;
  const totalAdjustedDeductions = standardDeductions + numCustomDeduction;
  const finalAdjustedNetSalary = Math.max(0, grossEarnings - totalAdjustedDeductions);

  // Mini Calculator Logic
  const evalCalc = (expr: string) => {
    if (!expr.trim()) return '0';
    try {
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      if (!/^[0-9+\-*/. ()]+$/.test(sanitized)) return 'Error';
      // eslint-disable-next-line no-new-func
      const res = Function(`'use strict'; return (${sanitized})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return String(Math.round(res * 100) / 100);
      }
      return '0';
    } catch {
      return '';
    }
  };

  const handleCalcInput = (char: string) => {
    setCalcExpr(prev => {
      const next = prev + char;
      const res = evalCalc(next);
      if (res && res !== 'Error') setCalcResult(res);
      return next;
    });
  };

  const handleCalcBackspace = () => {
    setCalcExpr(prev => {
      const next = prev.slice(0, -1);
      const res = evalCalc(next);
      if (res && res !== 'Error') setCalcResult(res);
      else if (!next) setCalcResult('0');
      return next;
    });
  };

  const handleApplyCalcToDeduction = () => {
    const val = parseFloat(calcResult);
    if (!isNaN(val) && val >= 0) {
      setCustomDeduction(String(val));
      setShowInlineCalc(false);
    }
  };

  // Save Final Adjusted Salary to Database
  const handleSaveAdjustedSalary = async () => {
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const recordId = `${salary.employeeId}_${salary.year}_${String(salary.month).padStart(2, '0')}`;

      const updatedRecord: FinalizedSalaryRecord = {
        id: recordId,
        employeeId: salary.employeeId,
        employeeName: salary.employeeName,
        designation: salary.designation,
        year: salary.year,
        month: salary.month,
        monthlySalary: salary.monthlySalary,
        calculationMode: salary.calculationMode,
        calendarDays: salary.calendarDays,
        effectiveWorkingDays: (salary as any).effectiveWorkingDays || salary.calendarDays,
        presentDays: salary.presentDays,
        absentDays: salary.absentDays,
        halfDays: salary.halfDays,
        paidLeaveDays: salary.paidLeaveDays,
        unpaidLeaveDays: salary.unpaidLeaveDays,
        notMarkedDays: salary.notMarkedDays,
        totalOvertimeHours: otHours,
        overtimeEarnings: otEarnings,
        hourlyOvertimeRate: otRate,
        dailySalary: salary.dailySalary,
        absentDeduction: salary.absentDeduction,
        halfDayDeduction: salary.halfDayDeduction,
        unpaidLeaveDeduction: salary.unpaidLeaveDeduction,
        totalDeductions: totalAdjustedDeductions,
        finalSalary: finalAdjustedNetSalary,
        isFinalized: Boolean(salary.isFinalized),
        finalizedAt: salary.isFinalized ? (salary as any).finalizedAt : undefined,
        notes: deductionNote.trim() || (numCustomDeduction > 0 ? `Advance / Deduction: ₹${numCustomDeduction}` : undefined),
        updatedAt: nowIso,
        customDeduction: numCustomDeduction,
      } as any;

      await SalaryRepository.saveFinalizedRecord(updatedRecord);

      setSaveFeedback(salary.isFinalized ? 'Salary Updated ✓' : 'Adjustment Saved (Draft) ✓');
      if (onSalaryUpdated) {
        await onSalaryUpdated();
      }
      setTimeout(() => setSaveFeedback(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // Build salary object for PDF / Print with custom deduction included
  const currentPrintSalary: any = {
    ...salary,
    customDeduction: numCustomDeduction,
    totalDeductions: totalAdjustedDeductions,
    finalSalary: finalAdjustedNetSalary,
    notes: deductionNote.trim(),
  };

  const handleDownloadPDF = () => {
    PDFService.generateSalarySlip(currentPrintSalary, company);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Salary Slip & Adjustments"
      subtitle={`${salary.employeeName} — ${monthYearStr}`}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* --- 1. Custom Deduction & Advance Editor Card --- */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-white border border-amber-200 shadow-2xs space-y-3.5 no-print">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                ₹
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-amber-950">
                  Salary Adjustments & Deductions (एडवांस या अन्य कटौती)
                </h4>
                <p className="text-[11px] text-amber-800 font-medium">
                  Total Salary me se advance ya fine minus karein aur note save karein.
                </p>
              </div>
            </div>

            {/* Quick Calculator Toggle */}
            <button
              type="button"
              onClick={() => setShowInlineCalc(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                showInlineCalc
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <CalcIcon className="w-3.5 h-3.5" />
              <span>{showInlineCalc ? 'Hide Calculator' : 'Open Calculator'}</span>
            </button>
          </div>

          {/* Inline Calculator Popup in modal */}
          {showInlineCalc && (
            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-white max-w-sm mx-auto animate-in zoom-in-95 duration-150 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Quick Math Calculator</span>
                <span className="font-mono text-amber-300">{calcExpr || '0'}</span>
              </div>
              <div className="text-right text-xl font-black font-mono tracking-tight text-white bg-slate-950 p-2 rounded-xl border border-slate-800 truncate">
                {calcResult}
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setCalcExpr('');
                    setCalcResult('0');
                  }}
                  className="p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                >
                  AC
                </button>
                <button
                  type="button"
                  onClick={handleCalcBackspace}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput(' ÷ ')}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                  ÷
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput(' × ')}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                  ×
                </button>

                <button type="button" onClick={() => handleCalcInput('7')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">7</button>
                <button type="button" onClick={() => handleCalcInput('8')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">8</button>
                <button type="button" onClick={() => handleCalcInput('9')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">9</button>
                <button type="button" onClick={() => handleCalcInput(' − ')} className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">−</button>

                <button type="button" onClick={() => handleCalcInput('4')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">4</button>
                <button type="button" onClick={() => handleCalcInput('5')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">5</button>
                <button type="button" onClick={() => handleCalcInput('6')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">6</button>
                <button type="button" onClick={() => handleCalcInput(' + ')} className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">+</button>

                <button type="button" onClick={() => handleCalcInput('1')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">1</button>
                <button type="button" onClick={() => handleCalcInput('2')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">2</button>
                <button type="button" onClick={() => handleCalcInput('3')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">3</button>
                <button type="button" onClick={() => handleCalcInput('.')} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700">.</button>

                <button type="button" onClick={() => handleCalcInput('0')} className="col-span-2 p-2 rounded-xl bg-slate-800 hover:bg-slate-700">0</button>
                <button
                  type="button"
                  onClick={handleApplyCalcToDeduction}
                  className="col-span-2 p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs active:scale-95"
                >
                  Apply to Deduction ✓
                </button>
              </div>
            </div>
          )}

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">
                Deduct from Total Salary / Advance (₹ Minus):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2000 (Advance / fine)"
                  value={customDeduction}
                  onChange={e => setCustomDeduction(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm font-black text-slate-900 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">
                Remark / Reason (किस चीज़ के पैसे काटे):
              </label>
              <input
                type="text"
                placeholder="e.g. Advance on 15th, Damage fine"
                value={deductionNote}
                onChange={e => setDeductionNote(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Live Calculation Bar & Save Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-amber-200/60">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
              <span className="text-slate-500">Gross: {formatINR(grossEarnings)}</span>
              <span>−</span>
              <span className="text-rose-600">Total Deductions: {formatINR(totalAdjustedDeductions)}</span>
              <span>=</span>
              <span className="text-sm font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                Final Net: {formatINR(finalAdjustedNetSalary, true)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {saveFeedback && (
                <span className="text-xs font-bold text-emerald-700 animate-in fade-in">
                  {saveFeedback}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveAdjustedSalary}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-xs shadow-orange-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Adjustment'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- 2. Printable Official Slip Container --- */}
        <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 text-slate-800 space-y-5 shadow-sm">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{company.companyName}</h2>
              {company.tagline && <p className="text-xs text-slate-500 font-medium">{company.tagline}</p>}
              <p className="text-xs text-slate-400 mt-1">
                {company.address} | {company.phone}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
                Payslip
              </span>
              <p className="text-sm font-bold text-slate-800 mt-1">{monthYearStr}</p>
            </div>
          </div>

          {/* Employee Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl text-xs">
            <div>
              <span className="text-slate-400 block font-semibold">Employee ID</span>
              <span className="font-bold text-slate-800">{salary.employeeId}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Employee Name</span>
              <span className="font-bold text-slate-800">{salary.employeeName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Designation</span>
              <span className="font-bold text-slate-800">{salary.designation}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Calculation Mode</span>
              <span className="font-bold text-slate-800">
                {salary.calculationMode === 'working_days' ? 'Working Days' : 'Calendar Days'}
              </span>
            </div>
          </div>

          {/* Attendance Summary */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Attendance & Overtime Summary
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs">
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] sm:text-xs">Working</span>
                <span className="font-bold text-slate-700 text-xs sm:text-sm">
                  {(salary as any).effectiveWorkingDays || salary.calendarDays}
                </span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <span className="text-blue-600 block text-[10px] sm:text-xs font-semibold">Present</span>
                <span className="font-bold text-blue-700 text-xs sm:text-sm">{salary.presentDays}</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <span className="text-rose-600 block text-[10px] sm:text-xs font-semibold">Absent</span>
                <span className="font-bold text-rose-700 text-xs sm:text-sm">{salary.absentDays}</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-orange-50 border border-orange-100">
                <span className="text-orange-600 block text-[10px] sm:text-xs font-semibold">Half Day</span>
                <span className="font-bold text-orange-700 text-xs sm:text-sm">{salary.halfDays}</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-sky-50 border border-sky-100">
                <span className="text-sky-600 block text-[10px] sm:text-xs font-semibold">Paid Lv</span>
                <span className="font-bold text-sky-700 text-xs sm:text-sm">{salary.paidLeaveDays}</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-amber-700 block text-[10px] sm:text-xs font-semibold">Unpaid</span>
                <span className="font-bold text-amber-800 text-xs sm:text-sm">{salary.unpaidLeaveDays}</span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-100/70 border border-amber-200 col-span-3 sm:col-span-1">
                <span className="text-amber-900 block text-[10px] sm:text-xs font-semibold">Overtime</span>
                <span className="font-bold text-amber-950 text-xs sm:text-sm">{otHours} hrs</span>
              </div>
            </div>
          </div>

          {/* Responsive Earnings & Deductions Container (Stacked on mobile, 2-col on desktop) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs bg-white shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Earnings Column */}
              <div className="flex flex-col justify-between">
                <div className="p-3 sm:p-3.5 bg-slate-100/80 font-black text-slate-800 border-b border-slate-200 text-xs uppercase tracking-wide">
                  Earnings
                </div>
                <div className="p-3.5 sm:p-4 space-y-2.5 flex-1 font-medium">
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span className="text-slate-700">Basic Monthly Salary</span>
                    <span className="font-bold text-slate-900 shrink-0">{formatINR(salary.monthlySalary, true)}</span>
                  </div>

                  {otHours > 0 && (
                    <div className="flex items-center justify-between gap-2 text-amber-900 font-semibold bg-amber-50/70 p-2 rounded-xl border border-amber-200">
                      <div className="min-w-0">
                        <span className="block font-bold">Overtime Pay</span>
                        <span className="text-[11px] text-amber-800">
                          {otHours} hrs @ ₹{otRate}/hr
                        </span>
                      </div>
                      <span className="text-emerald-700 font-black shrink-0">
                        +{formatINR(otEarnings, true)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 font-bold flex items-center justify-between gap-2">
                  <span className="text-slate-800 font-black">Total Gross Earnings</span>
                  <span className="text-slate-950 font-black shrink-0">{formatINR(grossEarnings, true)}</span>
                </div>
              </div>

              {/* Deductions Column */}
              <div className="flex flex-col justify-between">
                <div className="p-3 sm:p-3.5 bg-slate-100/80 font-black text-slate-800 border-b border-slate-200 text-xs uppercase tracking-wide">
                  Deductions
                </div>
                <div className="p-3.5 sm:p-4 space-y-2 flex-1 font-medium">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Absent Deduction ({salary.absentDays}d)</span>
                    <span className={`font-semibold shrink-0 ${salary.absentDeduction > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {salary.absentDeduction > 0 ? `-${formatINR(salary.absentDeduction, true)}` : '₹0.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Half Day Deduction ({salary.halfDays}d)</span>
                    <span className={`font-semibold shrink-0 ${salary.halfDayDeduction > 0 ? 'text-orange-600 font-bold' : 'text-slate-400'}`}>
                      {salary.halfDayDeduction > 0 ? `-${formatINR(salary.halfDayDeduction, true)}` : '₹0.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Unpaid Leave ({salary.unpaidLeaveDays}d)</span>
                    <span className={`font-semibold shrink-0 ${salary.unpaidLeaveDeduction > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                      {salary.unpaidLeaveDeduction > 0 ? `-${formatINR(salary.unpaidLeaveDeduction, true)}` : '₹0.00'}
                    </span>
                  </div>

                  {numCustomDeduction > 0 && (
                    <div className="flex items-center justify-between gap-2 text-rose-800 font-bold bg-rose-50/80 p-2 rounded-xl border border-rose-200">
                      <div className="min-w-0">
                        <span className="block font-black text-rose-900">Advance / Other Deduction</span>
                        {deductionNote && (
                          <span className="text-[11px] text-rose-700 font-medium block truncate max-w-[200px] sm:max-w-xs">
                            Note: {deductionNote}
                          </span>
                        )}
                      </div>
                      <span className="text-rose-700 font-black shrink-0">
                        -{formatINR(numCustomDeduction, true)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 font-bold flex items-center justify-between gap-2">
                  <span className="text-rose-700 font-black">Total Deductions</span>
                  <span className="text-rose-700 font-black shrink-0">-{formatINR(totalAdjustedDeductions, true)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary Highlight Box in Blue */}
          <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/90 border border-blue-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <span className="text-xs uppercase tracking-wider font-bold text-blue-900">
                  Net Salary Payable
                </span>
                <p className="text-xs text-blue-700 italic mt-0.5 break-words">
                  In Words: {numberToWordsINR(finalAdjustedNetSalary)}
                </p>
                {deductionNote && (
                  <p className="text-[11px] text-amber-800 font-bold mt-1">
                    Note: {deductionNote}
                  </p>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-700 shrink-0">
                {formatINR(finalAdjustedNetSalary, true)}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-slate-500">
            <div className="border-t border-slate-200 pt-2">
              <p className="font-semibold text-slate-700">
                {company.authorizedSignatory || 'Authorized Signatory'}
              </p>
              <p className="text-[11px] text-slate-400">Employer</p>
            </div>
            <div className="border-t border-slate-200 pt-2">
              <p className="font-semibold text-slate-700">{salary.employeeName}</p>
              <p className="text-[11px] text-slate-400">Employee Signature</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-4 h-4 text-orange-300" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
