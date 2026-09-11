import { supabase } from './supabase';
import { FinalizedSalaryRecord } from '../types';

export class SalaryService {
  static generateId(employeeId: string, year: number, month: number): string {
    const monthStr = String(month).padStart(2, '0');
    return `${employeeId}_${year}_${monthStr}`;
  }

  private static mapFromDb(row: any): FinalizedSalaryRecord {
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name || '',
      designation: row.designation || '',
      year: Number(row.year),
      month: Number(row.month),
      monthlySalary: Number(row.monthly_salary || 0),
      calculationMode: row.calculation_mode || 'working_days',
      calendarDays: Number(row.calendar_days || 0),
      effectiveWorkingDays: Number(row.effective_working_days || 0),
      presentDays: Number(row.present_days || 0),
      absentDays: Number(row.absent_days || 0),
      halfDays: Number(row.half_days || 0),
      paidLeaveDays: Number(row.paid_leave_days || 0),
      unpaidLeaveDays: Number(row.unpaid_leave_days || 0),
      notMarkedDays: Number(row.not_marked_days || 0),
      totalOvertimeHours: Number(row.total_overtime_hours || 0),
      overtimeEarnings: Number(row.overtime_earnings || 0),
      hourlyOvertimeRate: Number(row.hourly_overtime_rate || 0),
      dailySalary: Number(row.daily_salary || 0),
      absentDeduction: Number(row.absent_deduction || 0),
      halfDayDeduction: Number(row.half_day_deduction || 0),
      unpaidLeaveDeduction: Number(row.unpaid_leave_deduction || 0),
      totalDeductions: Number(row.total_deductions || 0),
      finalSalary: Number(row.final_salary || 0),
      isFinalized: Boolean(row.is_finalized),
      finalizedAt: row.finalized_at || row.created_at,
      notes: row.notes || undefined,
      updatedAt: row.updated_at,
    };
  }

  static async getById(id: string): Promise<FinalizedSalaryRecord | undefined> {
    const { data, error } = await supabase.from('salary_records').select('*').eq('id', id).maybeSingle();
    if (error || !data) return undefined;
    return this.mapFromDb(data);
  }

  static async getByEmployeeAndMonth(
    employeeId: string,
    year: number,
    month: number
  ): Promise<FinalizedSalaryRecord | undefined> {
    const id = this.generateId(employeeId, year, month);
    return this.getById(id);
  }

  static async getByMonth(year: number, month: number): Promise<FinalizedSalaryRecord[]> {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.error('Error fetching salary records by month:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getByEmployee(employeeId: string): Promise<FinalizedSalaryRecord[]> {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      console.error('Error fetching salary records by employee:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getAll(): Promise<FinalizedSalaryRecord[]> {
    const { data, error } = await supabase.from('salary_records').select('*');
    if (error) {
      console.error('Error fetching all salary records:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async saveFinalizedRecord(record: FinalizedSalaryRecord): Promise<string> {
    const id = record.id || this.generateId(record.employeeId, record.year, record.month);
    const now = new Date().toISOString();

    let baseNotes = record.notes ? record.notes.replace(/\s*\[OT:[\d.]+h.*?\]/gi, '').trim() : '';
    if (record.totalOvertimeHours && record.totalOvertimeHours > 0) {
      const otTag = `[OT:${record.totalOvertimeHours}h_RATE:${record.hourlyOvertimeRate || 0}_EARN:${record.overtimeEarnings || 0}]`;
      baseNotes = baseNotes ? `${baseNotes} ${otTag}` : otTag;
    }

    const payload: any = {
      id,
      employee_id: record.employeeId,
      employee_name: record.employeeName,
      designation: record.designation,
      year: record.year,
      month: record.month,
      monthly_salary: record.monthlySalary,
      calculation_mode: record.calculationMode,
      calendar_days: record.calendarDays,
      effective_working_days: record.effectiveWorkingDays,
      present_days: record.presentDays,
      absent_days: record.absentDays,
      half_days: record.halfDays,
      paid_leave_days: record.paidLeaveDays,
      unpaid_leave_days: record.unpaidLeaveDays,
      not_marked_days: record.notMarkedDays,
      daily_salary: record.dailySalary,
      absent_deduction: record.absentDeduction,
      half_day_deduction: record.halfDayDeduction,
      unpaid_leave_deduction: record.unpaidLeaveDeduction,
      total_deductions: record.totalDeductions,
      final_salary: record.finalSalary,
      is_finalized: true,
      finalized_at: record.finalizedAt || now,
      notes: baseNotes || null,
      updated_at: now,
    };

    let { error } = await supabase.from('salary_records').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error saving finalized salary in Supabase:', error);
      throw new Error(error.message || 'Failed to save salary record.');
    }
    return id;
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase.from('salary_records').delete().eq('id', id);
    if (error) {
      console.error('Error deleting salary record from Supabase:', error);
      throw new Error(error.message || 'Failed to delete salary record.');
    }
  }

  static async count(): Promise<number> {
    const { count, error } = await supabase.from('salary_records').select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
}
