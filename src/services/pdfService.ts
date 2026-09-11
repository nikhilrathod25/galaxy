import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlySalaryBreakdown, FinalizedSalaryRecord, CompanySettings } from '../types';
import { formatMonthYear, formatDisplayDate } from '../utils/dateUtils';
import { formatINR, numberToWordsINR } from '../utils/currencyUtils';

export class PDFService {
  /**
   * Generates and downloads a professional Salary Slip PDF in Blue & Orange branding
   */
  static generateSalarySlip(
    salary: MonthlySalaryBreakdown | FinalizedSalaryRecord,
    company: CompanySettings
  ): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 16;

    // Company Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); // Deep Blue (blue-900)
    doc.text(company.companyName || 'StaffPay Business', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    if (company.tagline) {
      y += 5;
      doc.text(company.tagline, margin, y);
    }
    y += 4;
    doc.text(`${company.address || ''} | Phone: ${company.phone || ''} | Email: ${company.email || ''}`, margin, y);

    // Title & Month Badge
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235); // Royal Blue (blue-600)
    doc.text('PAYSLIP / SALARY SLIP', margin, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const monthYearStr = formatMonthYear(salary.year, salary.month);
    doc.text(`For Month: ${monthYearStr}`, pageWidth - margin, y, { align: 'right' });

    // Employee Details Grid
    y += 8;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 2,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 },
        1: { cellWidth: 55 },
        2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 },
        3: { cellWidth: 55 },
      },
      body: [
        ['Employee ID:', salary.employeeId, 'Employee Name:', salary.employeeName],
        ['Designation:', salary.designation, 'Pay Period:', monthYearStr],
        ['Calculation Mode:', salary.calculationMode === 'working_days' ? 'Working Days (Excl. Sun/Holidays)' : 'Calendar Days', 'Generated On:', formatDisplayDate(new Date().toISOString())],
      ],
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Attendance Summary Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Attendance & Working Days Summary', margin, y);

    y += 3;
    const otHours = (salary as any).totalOvertimeHours || 0;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: {
        fillColor: [239, 246, 255], // blue-50
        textColor: [30, 58, 138], // blue-900
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        halign: 'center',
      },
      head: [['Effective Working Days', 'Present', 'Absent', 'Half Days', 'Paid Leave', 'Unpaid Leave', 'Overtime']],
      body: [
        [
          (salary as any).effectiveWorkingDays || salary.calendarDays,
          salary.presentDays,
          salary.absentDays,
          salary.halfDays,
          salary.paidLeaveDays,
          salary.unpaidLeaveDays,
          otHours > 0 ? `${otHours} hrs` : '0 hrs',
        ],
      ],
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Earnings & Deductions Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Salary & Deductions Breakdown', margin, y);

    y += 3;
    const otEarnings = (salary as any).overtimeEarnings || 0;
    const otRate = (salary as any).hourlyOvertimeRate || Math.round(salary.dailySalary / 8);
    const grossEarnings = salary.monthlySalary + otEarnings;

    const earningsBody: any[] = [
      [
        'Basic Monthly Salary',
        formatINR(salary.monthlySalary, true),
        `Absent Deduction (${salary.absentDays} days)`,
        salary.absentDeduction > 0 ? `-${formatINR(salary.absentDeduction, true)}` : '₹0.00',
      ],
    ];

    if (otHours > 0) {
      earningsBody.push([
        `Overtime (${otHours}h @ ₹${otRate}/hr)`,
        `+${formatINR(otEarnings, true)}`,
        `Half Day Deduction (${salary.halfDays} days @ 50%)`,
        salary.halfDayDeduction > 0 ? `-${formatINR(salary.halfDayDeduction, true)}` : '₹0.00',
      ]);
      earningsBody.push([
        '',
        '',
        `Unpaid Leave Deduction (${salary.unpaidLeaveDays} days)`,
        salary.unpaidLeaveDeduction > 0 ? `-${formatINR(salary.unpaidLeaveDeduction, true)}` : '₹0.00',
      ]);
    } else {
      earningsBody.push([
        '',
        '',
        `Half Day Deduction (${salary.halfDays} days @ 50%)`,
        salary.halfDayDeduction > 0 ? `-${formatINR(salary.halfDayDeduction, true)}` : '₹0.00',
      ]);
      earningsBody.push([
        '',
        '',
        `Unpaid Leave Deduction (${salary.unpaidLeaveDays} days)`,
        salary.unpaidLeaveDeduction > 0 ? `-${formatINR(salary.unpaidLeaveDeduction, true)}` : '₹0.00',
      ]);
    }

    if ((salary as any).customDeduction && (salary as any).customDeduction > 0) {
      earningsBody.push([
        '',
        '',
        `Advance / Custom Deduction (${(salary as any).notes || 'Adjustment'})`,
        `-${formatINR((salary as any).customDeduction, true)}`,
      ]);
    }

    earningsBody.push([
      { content: 'Total Gross Earnings', styles: { fontStyle: 'bold' } },
      { content: formatINR(grossEarnings, true), styles: { fontStyle: 'bold' } },
      { content: 'Total Deductions', styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
      { content: `-${formatINR(salary.totalDeductions, true)}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // Royal Blue
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
      },
      head: [['Earnings Description', 'Amount', 'Deductions Description', 'Amount']],
      body: earningsBody,
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Net Take Home Box
    doc.setFillColor(239, 246, 255); // Blue-50
    doc.setDrawColor(191, 219, 254); // Blue-200
    doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138); // Blue-900
    doc.text('NET SALARY PAYABLE:', margin + 6, y + 8);

    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235); // Royal Blue
    doc.text(formatINR(salary.finalSalary, true), pageWidth - margin - 6, y + 8, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const amountInWords = numberToWordsINR(salary.finalSalary);
    doc.text(`In Words: ${amountInWords}`, margin + 6, y + 15);

    // Signatures
    y += 35;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + 10, y, margin + 60, y);
    doc.line(pageWidth - margin - 60, y, pageWidth - margin - 10, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(company.authorizedSignatory || 'Authorized Signatory', margin + 35, y, { align: 'center' });
    doc.text('Employee Signature', pageWidth - margin - 35, y, { align: 'center' });

    // Footer note
    y = 282;
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated salary slip created via StaffPay. No signature is required in digital format.', pageWidth / 2, y, { align: 'center' });

    // Save PDF
    const filename = `SalarySlip_${salary.employeeId}_${monthYearStr.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  }
}
