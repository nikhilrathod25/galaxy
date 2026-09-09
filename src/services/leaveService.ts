import { supabase } from './supabase';
import { LeaveType, LeaveRecord } from '../types';

export class LeaveService {
  // --- Leave Types ---

  private static mapLeaveTypeFromDb(row: any): LeaveType {
    return {
      id: Number(row.id),
      name: row.name,
      isPaid: Boolean(row.is_paid),
      description: row.description || undefined,
      isDefault: Boolean(row.is_default),
    };
  }

  static async getAllLeaveTypes(): Promise<LeaveType[]> {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching leave types:', error);
      return [];
    }

    if (!data || data.length === 0) {
      // Seed default leave types if empty
      const defaultTypes = [
        { name: 'Casual Leave', is_paid: true, description: 'Casual / Personal leave', is_default: true },
        { name: 'Sick Leave', is_paid: true, description: 'Medical recovery', is_default: true },
        { name: 'Paid Leave', is_paid: true, description: 'Earned / Annual paid leave', is_default: true },
        { name: 'Unpaid Leave', is_paid: false, description: 'Leave without pay / Loss of Pay', is_default: true },
      ];
      const { data: inserted } = await supabase.from('leave_types').insert(defaultTypes).select();
      return (inserted || []).map(this.mapLeaveTypeFromDb);
    }

    return data.map(this.mapLeaveTypeFromDb);
  }

  static async getLeaveTypeById(id: number): Promise<LeaveType | undefined> {
    const { data, error } = await supabase.from('leave_types').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    return this.mapLeaveTypeFromDb(data);
  }

  static async createLeaveType(data: Omit<LeaveType, 'id'>): Promise<number> {
    const { data: inserted, error } = await supabase
      .from('leave_types')
      .insert({
        name: data.name,
        is_paid: data.isPaid,
        description: data.description || null,
        is_default: Boolean(data.isDefault),
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('Error creating leave type in Supabase:', error);
      throw new Error(error?.message || 'Failed to create leave type.');
    }
    return Number(inserted.id);
  }

  static async updateLeaveType(id: number, data: Partial<LeaveType>): Promise<number> {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.isPaid !== undefined) payload.is_paid = data.isPaid;
    if (data.description !== undefined) payload.description = data.description;
    if (data.isDefault !== undefined) payload.is_default = data.isDefault;
    payload.updated_at = new Date().toISOString();

    const { error } = await supabase.from('leave_types').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating leave type:', error);
      throw new Error(error.message || 'Failed to update leave type.');
    }
    return 1;
  }

  static async deleteLeaveType(id: number): Promise<void> {
    const { error } = await supabase.from('leave_types').delete().eq('id', id);
    if (error) {
      console.error('Error deleting leave type:', error);
      throw new Error(error.message || 'Failed to delete leave type.');
    }
  }

  // --- Leave Records ---

  private static mapLeaveRecordFromDb(row: any): LeaveRecord {
    return {
      id: Number(row.id),
      employeeId: row.employee_id,
      leaveTypeId: Number(row.leave_type_id),
      leaveTypeName: row.leave_type_name || '',
      startDate: row.start_date,
      endDate: row.end_date,
      daysCount: Number(row.days_count || 1),
      reason: row.reason || undefined,
      isPaid: Boolean(row.is_paid),
      createdAt: row.created_at,
    };
  }

  static async getAllLeaves(): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching leaves:', error);
      return [];
    }
    return (data || []).map(this.mapLeaveRecordFromDb);
  }

  static async getLeavesByEmployee(employeeId: string): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching leaves by employee:', error);
      return [];
    }
    return (data || []).map(this.mapLeaveRecordFromDb);
  }

  static async getLeavesByDateRange(startDate: string, endDate: string): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (error) {
      console.error('Error fetching leaves by range:', error);
      return [];
    }
    return (data || []).map(this.mapLeaveRecordFromDb);
  }

  static async createLeave(data: Omit<LeaveRecord, 'id' | 'createdAt'>): Promise<number> {
    const { data: inserted, error } = await supabase
      .from('leaves')
      .insert({
        employee_id: data.employeeId,
        leave_type_id: data.leaveTypeId || null,
        leave_type_name: data.leaveTypeName || '',
        start_date: data.startDate,
        end_date: data.endDate,
        days_count: data.daysCount,
        reason: data.reason || null,
        is_paid: data.isPaid,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('Error creating leave record in Supabase:', error);
      throw new Error(error?.message || 'Failed to save leave record.');
    }
    return Number(inserted.id);
  }

  static async updateLeave(id: number, data: Partial<LeaveRecord>): Promise<number> {
    const payload: any = {};
    if (data.employeeId !== undefined) payload.employee_id = data.employeeId;
    if (data.leaveTypeId !== undefined) payload.leave_type_id = data.leaveTypeId;
    if (data.leaveTypeName !== undefined) payload.leave_type_name = data.leaveTypeName;
    if (data.startDate !== undefined) payload.start_date = data.startDate;
    if (data.endDate !== undefined) payload.end_date = data.endDate;
    if (data.daysCount !== undefined) payload.days_count = data.daysCount;
    if (data.reason !== undefined) payload.reason = data.reason;
    if (data.isPaid !== undefined) payload.is_paid = data.isPaid;
    payload.updated_at = new Date().toISOString();

    const { error } = await supabase.from('leaves').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating leave record in Supabase:', error);
      throw new Error(error.message || 'Failed to update leave record.');
    }
    return 1;
  }

  static async deleteLeave(id: number): Promise<void> {
    const { error } = await supabase.from('leaves').delete().eq('id', id);
    if (error) {
      console.error('Error deleting leave record from Supabase:', error);
      throw new Error(error.message || 'Failed to delete leave record.');
    }
  }

  static async count(): Promise<number> {
    const { count, error } = await supabase.from('leaves').select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
}
