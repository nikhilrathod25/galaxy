import { db } from '../db/database';
import { LeaveType, LeaveRecord } from '../types';
import { FirebaseSyncService } from '../services/firebaseSyncService';

export class LeaveRepository {
  // Leave Types
  static async getAllLeaveTypes(): Promise<LeaveType[]> {
    return db.leave_types.toArray();
  }

  static async getLeaveTypeById(id: number): Promise<LeaveType | undefined> {
    return db.leave_types.get(id);
  }

  static async createLeaveType(data: Omit<LeaveType, 'id'>): Promise<number> {
    const res = (await db.leave_types.add(data)) as number;
    FirebaseSyncService.notifyMutation();
    return res;
  }

  static async updateLeaveType(id: number, data: Partial<LeaveType>): Promise<number> {
    const res = await db.leave_types.update(id, data);
    FirebaseSyncService.notifyMutation();
    return res;
  }

  static async deleteLeaveType(id: number): Promise<void> {
    await db.leave_types.delete(id);
    FirebaseSyncService.notifyMutation();
  }

  // Leave Records
  static async getAllLeaves(): Promise<LeaveRecord[]> {
    return db.leaves.toArray();
  }

  static async getLeavesByEmployee(employeeId: string): Promise<LeaveRecord[]> {
    return db.leaves.where('employeeId').equals(employeeId).toArray();
  }

  static async getLeavesByDateRange(startDate: string, endDate: string): Promise<LeaveRecord[]> {
    return db.leaves
      .filter(leave => leave.startDate <= endDate && leave.endDate >= startDate)
      .toArray();
  }

  static async createLeave(data: Omit<LeaveRecord, 'id' | 'createdAt'>): Promise<number> {
    const now = new Date().toISOString();
    const res = (await db.leaves.add({
      ...data,
      createdAt: now,
    })) as number;
    FirebaseSyncService.notifyMutation();
    return res;
  }

  static async updateLeave(id: number, data: Partial<LeaveRecord>): Promise<number> {
    const res = await db.leaves.update(id, data);
    FirebaseSyncService.notifyMutation();
    return res;
  }

  static async deleteLeave(id: number): Promise<void> {
    await db.leaves.delete(id);
    FirebaseSyncService.notifyMutation();
  }

  static async count(): Promise<number> {
    return db.leaves.count();
  }
}
