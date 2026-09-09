import React from 'react';
import { FileText, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { MonthlySalaryBreakdown, FinalizedSalaryRecord } from '../../types';
import { formatINR } from '../../utils/currencyUtils';

interface SalaryCalculationCardProps {
  salary: MonthlySalaryBreakdown | FinalizedSalaryRecord;
  onViewSlip: (salary: MonthlySalaryBreakdown | FinalizedSalaryRecord) => void;
  onFinalize?: (salary: MonthlySalaryBreakdown) => void;
}

export const SalaryCalculationCard: React.FC<SalaryCalculationCardProps> = ({
  salary,
  onViewSlip,
  onFinalize,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5 sm:p-6 transition-all hover:shadow-md">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">{salary.employeeName}</h3>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {salary.employeeId}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">{salary.designation}</p>
        </div>

        {salary.isFinalized ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Lock className="w-3 h-3 text-blue-600" />
            Finalized
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            Estimated
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-slate-50 rounded-2xl mb-4 text-center">
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Working</div>
          <div className="text-sm font-bold text-slate-700">
            {(salary as any).effectiveWorkingDays || salary.calendarDays}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Present</div>
          <div className="text-sm font-bold text-blue-600">{salary.presentDays}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Absent</div>
          <div className="text-sm font-bold text-rose-600">{salary.absentDays}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Half Day</div>
          <div className="text-sm font-bold text-orange-500">{salary.halfDays}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Paid Leave</div>
          <div className="text-sm font-bold text-sky-600">{salary.paidLeaveDays}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Unpaid Leave</div>
          <div className="text-sm font-bold text-amber-600">{salary.unpaidLeaveDays}</div>
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span className="font-medium">Basic Monthly Salary</span>
          <span className="font-bold text-slate-800">{formatINR(salary.monthlySalary)}</span>
        </div>

        {salary.absentDeduction > 0 && (
          <div className="flex items-center justify-between text-xs text-rose-600 font-medium">
            <span>Absent Deduction ({salary.absentDays} days)</span>
            <span>-{formatINR(salary.absentDeduction)}</span>
          </div>
        )}

        {salary.halfDayDeduction > 0 && (
          <div className="flex items-center justify-between text-xs text-orange-600 font-medium">
            <span>Half Day Deduction ({salary.halfDays} half days @ 50%)</span>
            <span>-{formatINR(salary.halfDayDeduction)}</span>
          </div>
        )}

        {salary.unpaidLeaveDeduction > 0 && (
          <div className="flex items-center justify-between text-xs text-amber-700 font-medium">
            <span>Unpaid Leave Deduction ({salary.unpaidLeaveDays} days)</span>
            <span>-{formatINR(salary.unpaidLeaveDeduction)}</span>
          </div>
        )}

        {salary.totalDeductions > 0 && (
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 pt-1 border-t border-slate-100">
            <span>Total Deductions</span>
            <span>-{formatINR(salary.totalDeductions)}</span>
          </div>
        )}

        {/* Final Net Salary in Blue & Orange */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/80 border border-blue-100 text-blue-950 font-bold mt-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-blue-700 font-bold">Net Payable Salary</div>
            <div className="text-xs text-blue-500 font-normal">
              Rate: {formatINR(salary.dailySalary)} / day
            </div>
          </div>
          <div className="text-xl text-blue-700 font-black">{formatINR(salary.finalSalary, true)}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onViewSlip(salary)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>Salary Slip</span>
        </button>

        {!salary.isFinalized && onFinalize && (
          <button
            type="button"
            onClick={() => onFinalize(salary as MonthlySalaryBreakdown)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-all shadow-md shadow-orange-500/20 active:scale-[0.98]"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Finalize</span>
          </button>
        )}
      </div>
    </div>
  );
};
