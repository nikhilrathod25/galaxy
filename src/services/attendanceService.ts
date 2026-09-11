import { supabase } from './supabase';
import { AttendanceRecord, AttendanceStatus } from '../types';

export class AttendanceService {
  static generateId(employeeId: string, date: string): string {
    return `${employeeId}_${date}`;
  }

  private static mapFromDb(row: any): AttendanceRecord {
    let rawNote = row.note || '';
    let overtimeHours: number | undefined = row.overtime_hours ? Number(row.overtime_hours) : undefined;

    if (overtimeHours === undefined && rawNote) {
      const otMatch = rawNote.match(/\[OT:([\d.]+)h\]/i);
      if (otMatch) {
        overtimeHours = parseFloat(otMatch[1]);
      }
    }
    const displayNote = rawNote ? rawNote.replace(/\s*\[OT:[\d.]+h\]/gi, '').trim() : undefined;

    return {
      id: row.id,
      employeeId: row.employee_id,
      date: row.date,
      status: row.status as AttendanceStatus,
      overtimeHours: overtimeHours && !isNaN(overtimeHours) && overtimeHours > 0 ? overtimeHours : undefined,
      note: displayNote || undefined,
      updatedAt: row.updated_at,
    };
  }

  static async getByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecord | undefined> {
    const id = this.generateId(employeeId, date);
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return undefined;
    return this.mapFromDb(data);
  }

  static async getByDate(date: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', date);

    if (error) {
      console.error('Error fetching attendance by date:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getAll(): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase.from('attendance').select('*');
    if (error) {
      console.error('Error fetching all attendance:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('Error fetching attendance by date range:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getByEmployeeAndMonth(employeeId: string, year: number, month: number): Promise<AttendanceRecord[]> {
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('Error fetching attendance by month:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getMonthAttendance(year: number, month: number): Promise<AttendanceRecord[]> {
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('Error fetching month attendance:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async setStatus(
    employeeId: string,
    date: string,
    status: AttendanceStatus,
    note?: string,
    overtimeHours?: number
  ): Promise<string> {
    const id = this.generateId(employeeId, date);
    const now = new Date().toISOString();

    if (status === 'Not Marked') {
      await supabase.from('attendance').delete().eq('id', id);
      return id;
    }

    let baseNote = note ? note.replace(/\s*\[OT:[\d.]+h\]/gi, '').trim() : '';
    if (overtimeHours && overtimeHours > 0) {
      baseNote = baseNote ? `${baseNote} [OT:${overtimeHours}h]` : `[OT:${overtimeHours}h]`;
    }

    const payload: any = {
      id,
      employee_id: employeeId,
      date,
      status,
      note: baseNote || null,
      updated_at: now,
    };
    if (overtimeHours !== undefined) {
      payload.overtime_hours = overtimeHours;
    }

    let { error } = await supabase.from('attendance').upsert(
      payload,
      { onConflict: 'id' }
    );

    if (error && (error.message?.includes('overtime_hours') || error.code === 'PGRST204')) {
      delete payload.overtime_hours;
      const retry = await supabase.from('attendance').upsert(payload, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) {
      console.error('Error setting attendance in Supabase:', error);
      throw new Error(error.message || 'Failed to update attendance.');
    }

    return id;
  }

  static async bulkSetStatus(
    records: Array<{ employeeId: string; date: string; status: AttendanceStatus; note?: string; overtimeHours?: number }>
  ): Promise<void> {
    const now = new Date().toISOString();
    const toUpsert: any[] = [];
    const toDeleteIds: string[] = [];

    for (const r of records) {
      const id = this.generateId(r.employeeId, r.date);
      if (r.status === 'Not Marked') {
        toDeleteIds.push(id);
      } else {
        let baseNote = r.note ? r.note.replace(/\s*\[OT:[\d.]+h\]/gi, '').trim() : '';
        if (r.overtimeHours && r.overtimeHours > 0) {
          baseNote = baseNote ? `${baseNote} [OT:${r.overtimeHours}h]` : `[OT:${r.overtimeHours}h]`;
        }

        const payload: any = {
          id,
          employee_id: r.employeeId,
          date: r.date,
          status: r.status,
          note: baseNote || null,
          updated_at: now,
        };
        if (r.overtimeHours !== undefined) {
          payload.overtime_hours = r.overtimeHours;
        }
        toUpsert.push(payload);
      }
    }

    if (toDeleteIds.length > 0) {
      await supabase.from('attendance').delete().in('id', toDeleteIds);
    }

    if (toUpsert.length > 0) {
      let { error } = await supabase.from('attendance').upsert(toUpsert, { onConflict: 'id' });
      if (error && (error.message?.includes('overtime_hours') || error.code === 'PGRST204')) {
        toUpsert.forEach(p => delete p.overtime_hours);
        const retry = await supabase.from('attendance').upsert(toUpsert, { onConflict: 'id' });
        error = retry.error;
      }
      if (error) {
        console.error('Error bulk updating attendance:', error);
        throw new Error(error.message || 'Failed to save attendance records.');
      }
    }
  }

  static async markAllPresentForDate(
    date: string,
    employeeIds: string[],
    overwriteExisting: boolean = false
  ): Promise<{ updatedCount: number; skippedCount: number }> {
    const existing = await this.getByDate(date);
    const existingMap = new Map(existing.map((r) => [r.employeeId, r]));

    const now = new Date().toISOString();
    const toUpsert: any[] = [];
    let skippedCount = 0;

    for (const empId of employeeIds) {
      const current = existingMap.get(empId);
      if (current && !overwriteExisting && current.status !== 'Not Marked') {
        skippedCount++;
        continue;
      }
      toUpsert.push({
        id: this.generateId(empId, date),
        employee_id: empId,
        date,
        status: 'Present',
        updated_at: now,
      });
    }

    if (toUpsert.length > 0) {
      const { error } = await supabase.from('attendance').upsert(toUpsert, { onConflict: 'user_id,id' });
      if (error) {
        console.error('Error marking all present in Supabase:', error);
        throw new Error(error.message || 'Failed to mark attendance.');
      }
    }

    return {
      updatedCount: toUpsert.length,
      skippedCount,
    };
  }

  static async count(): Promise<number> {
    const { count, error } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
}
