import React from 'react';
import { Download, Printer, Building2, User, Calendar, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { MonthlySalaryBreakdown, FinalizedSalaryRecord, CompanySettings } from '../../types';
import { PDFService } from '../../services/pdfService';
import { formatMonthYear, formatDisplayDate } from '../../utils/dateUtils';
import { formatINR, numberToWordsINR } from '../../utils/currencyUtils';

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  salary: MonthlySalaryBreakdown | FinalizedSalaryRecord | null;
  company: CompanySettings;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({
  isOpen,
  onClose,
  salary,
  company,
}) => {
  if (!salary) return null;

  const monthYearStr = formatMonthYear(salary.year, salary.month);

  const handleDownloadPDF = () => {
    PDFService.generateSalarySlip(salary, company);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Salary Slip"
      subtitle={`${salary.employeeName} — ${monthYearStr}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Printable Slip Container */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-slate-800 space-y-6 shadow-sm">
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
              Attendance Summary
            </h4>
            <div className="grid grid-cols-6 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block">Working</span>
                <span className="font-bold text-slate-700">
                  {(salary as any).effectiveWorkingDays || salary.calendarDays}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <span className="text-blue-600 block font-semibold">Present</span>
                <span className="font-bold text-blue-700">{salary.presentDays}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <span className="text-rose-600 block font-semibold">Absent</span>
                <span className="font-bold text-rose-700">{salary.absentDays}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100">
                <span className="text-orange-600 block font-semibold">Half Day</span>
                <span className="font-bold text-orange-700">{salary.halfDays}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100">
                <span className="text-sky-600 block font-semibold">Paid Leave</span>
                <span className="font-bold text-sky-700">{salary.paidLeaveDays}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-amber-700 block font-semibold">Unpaid</span>
                <span className="font-bold text-amber-800">{salary.unpaidLeaveDays}</span>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left border-r border-slate-200 w-1/2">
                    Earnings
                  </th>
                  <th className="px-4 py-3 text-left w-1/2">Deductions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 border-r border-slate-200 align-top">
                    <div className="flex justify-between font-semibold">
                      <span>Basic Monthly Salary</span>
                      <span>{formatINR(salary.monthlySalary, true)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Absent ({salary.absentDays}d)</span>
                      <span className="text-rose-600">
                        {salary.absentDeduction > 0
                          ? `-${formatINR(salary.absentDeduction, true)}`
                          : '₹0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Half Day ({salary.halfDays}d)</span>
                      <span className="text-orange-600">
                        {salary.halfDayDeduction > 0
                          ? `-${formatINR(salary.halfDayDeduction, true)}`
                          : '₹0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unpaid Leave ({salary.unpaidLeaveDays}d)</span>
                      <span className="text-amber-700">
                        {salary.unpaidLeaveDeduction > 0
                          ? `-${formatINR(salary.unpaidLeaveDeduction, true)}`
                          : '₹0.00'}
                      </span>
                    </div>
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-3 border-r border-slate-200">
                    <div className="flex justify-between">
                      <span>Total Gross Earnings</span>
                      <span>{formatINR(salary.monthlySalary, true)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-between text-rose-600">
                      <span>Total Deductions</span>
                      <span>-{formatINR(salary.totalDeductions, true)}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Salary Highlight Box in Blue & Orange */}
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-blue-900">
                  Net Salary Payable
                </span>
                <p className="text-xs text-blue-700 italic mt-0.5">
                  In Words: {numberToWordsINR(salary.finalSalary)}
                </p>
              </div>
              <div className="text-2xl font-black text-blue-700">
                {formatINR(salary.finalSalary, true)}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-slate-500">
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-orange-300" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
