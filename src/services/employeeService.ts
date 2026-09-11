import { supabase } from './supabase';
import { Employee, EmployeeStatus } from '../types';

export class EmployeeService {
  private static mapFromDb(row: any): Employee {
    let rawNotes = row.notes || '';
    let overtimeRate: number | undefined = row.overtime_rate ? Number(row.overtime_rate) : undefined;
    
    if (overtimeRate === undefined && rawNotes) {
      const otMatch = rawNotes.match(/\[OT_RATE:([\d.]+)\]/i);
      if (otMatch) {
        overtimeRate = parseFloat(otMatch[1]);
      }
    }
    // Clean tag from display notes
    const displayNotes = rawNotes ? rawNotes.replace(/\s*\[OT_RATE:[\d.]+\]/gi, '').trim() : undefined;

    return {
      id: Number(row.id),
      employeeId: row.employee_id,
      fullName: row.full_name,
      photoUrl: row.photo_url || undefined,
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      designation: row.designation || '',
      joiningDate: row.joining_date,
      endDate: row.end_date || undefined,
      monthlySalary: Number(row.monthly_salary || 0),
      overtimeRate: overtimeRate && !isNaN(overtimeRate) ? overtimeRate : undefined,
      status: row.status as EmployeeStatus,
      notes: displayNotes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapToDb(data: Partial<Employee>): any {
    const dbObj: any = {};
    if (data.employeeId !== undefined) dbObj.employee_id = data.employeeId;
    if (data.fullName !== undefined) dbObj.full_name = data.fullName;
    if (data.photoUrl !== undefined) dbObj.photo_url = data.photoUrl;
    if (data.phone !== undefined) dbObj.phone = data.phone;
    if (data.email !== undefined) dbObj.email = data.email;
    if (data.address !== undefined) dbObj.address = data.address;
    if (data.designation !== undefined) dbObj.designation = data.designation;
    if (data.joiningDate !== undefined) dbObj.joining_date = data.joiningDate;
    if (data.endDate !== undefined) dbObj.end_date = data.endDate;
    if (data.monthlySalary !== undefined) dbObj.monthly_salary = data.monthlySalary;
    if (data.status !== undefined) dbObj.status = data.status;
    
    let baseNotes = data.notes !== undefined ? (data.notes || '') : '';
    baseNotes = baseNotes.replace(/\s*\[OT_RATE:[\d.]+\]/gi, '').trim();
    if (data.overtimeRate !== undefined && data.overtimeRate > 0) {
      baseNotes = baseNotes ? `${baseNotes} [OT_RATE:${data.overtimeRate}]` : `[OT_RATE:${data.overtimeRate}]`;
    }
    if (data.notes !== undefined || data.overtimeRate !== undefined) {
      dbObj.notes = baseNotes || null;
    }

    dbObj.updated_at = new Date().toISOString();
    return dbObj;
  }

  static async getAll(status?: EmployeeStatus): Promise<Employee[]> {
    let query = supabase.from('employees').select('*').order('full_name', { ascending: true });
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching employees from Supabase:', error);
      throw new Error('Failed to load employees from cloud database.');
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getById(id: number): Promise<Employee | undefined> {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    return this.mapFromDb(data);
  }

  static async getByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (error || !data) return undefined;
    return this.mapFromDb(data);
  }

  static async generateNextEmployeeId(): Promise<string> {
    const { data, error } = await supabase.from('employees').select('employee_id');
    if (error) {
      console.warn('Could not generate next employee ID from cloud:', error);
      return 'EMP001';
    }
    let maxNum = 0;
    (data || []).forEach((row: any) => {
      const match = (row.employee_id || '').match(/^EMP(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `EMP${String(maxNum + 1).padStart(3, '0')}`;
  }

  static async create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const existing = await this.getByEmployeeId(data.employeeId);
    if (existing) {
      throw new Error(`Employee ID "${data.employeeId}" already exists.`);
    }

    const payload = this.mapToDb(data);
    payload.created_at = new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from('employees')
      .insert(payload)
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('Error creating employee in Supabase:', error);
      throw new Error(error?.message || 'Failed to create employee.');
    }

    return Number(inserted.id);
  }

  static async update(id: number, data: Partial<Employee>): Promise<number> {
    const payload = this.mapToDb(data);
    const { error } = await supabase.from('employees').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating employee in Supabase:', error);
      throw new Error(error.message || 'Failed to update employee.');
    }
    return 1;
  }

  static async delete(id: number): Promise<void> {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      console.error('Error deleting employee from Supabase:', error);
      throw new Error(error.message || 'Failed to delete employee.');
    }
  }

  static async count(): Promise<number> {
    const { count, error } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
}
