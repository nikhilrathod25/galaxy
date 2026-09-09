import { supabase } from './supabase';
import { AttendanceRecord, AttendanceStatus } from '../types';

export class AttendanceService {
  static generateId(employeeId: string, date: string): string {
    return `${employeeId}_${date}`;
  }

  private static mapFromDb(row: any): AttendanceRecord {
    return {
      id: row.id,
      employeeId: row.employee_id,
      date: row.date,
      status: row.status as AttendanceStatus,
      note: row.note || undefined,
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
    note?: string
  ): Promise<string> {
    const id = this.generateId(employeeId, date);
    const now = new Date().toISOString();

    if (status === 'Not Marked') {
      await supabase.from('attendance').delete().eq('id', id);
      return id;
    }

    const { error } = await supabase.from('attendance').upsert(
      {
        id,
        employee_id: employeeId,
        date,
        status,
        note: note || null,
        updated_at: now,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Error setting attendance in Supabase:', error);
      throw new Error(error.message || 'Failed to update attendance.');
    }

    return id;
  }

  static async bulkSetStatus(
    records: Array<{ employeeId: string; date: string; status: AttendanceStatus; note?: string }>
  ): Promise<void> {
    const now = new Date().toISOString();
    const toUpsert: any[] = [];
    const toDeleteIds: string[] = [];

    for (const r of records) {
      const id = this.generateId(r.employeeId, r.date);
      if (r.status === 'Not Marked') {
        toDeleteIds.push(id);
      } else {
        toUpsert.push({
          id,
          employee_id: r.employeeId,
          date: r.date,
          status: r.status,
          note: r.note || null,
          updated_at: now,
        });
      }
    }

    if (toDeleteIds.length > 0) {
      await supabase.from('attendance').delete().in('id', toDeleteIds);
    }

    if (toUpsert.length > 0) {
      const { error } = await supabase.from('attendance').upsert(toUpsert, { onConflict: 'id' });
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
