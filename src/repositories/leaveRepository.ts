import { LeaveService } from '../services/leaveService';
import { LeaveType, LeaveRecord } from '../types';

export class LeaveRepository {
  // Leave Types
  static async getAllLeaveTypes(): Promise<LeaveType[]> {
    return LeaveService.getAllLeaveTypes();
  }

  static async getLeaveTypeById(id: number): Promise<LeaveType | undefined> {
    return LeaveService.getLeaveTypeById(id);
  }

  static async createLeaveType(data: Omit<LeaveType, 'id'>): Promise<number> {
    return LeaveService.createLeaveType(data);
  }

  static async updateLeaveType(id: number, data: Partial<LeaveType>): Promise<number> {
    return LeaveService.updateLeaveType(id, data);
  }

  static async deleteLeaveType(id: number): Promise<void> {
    return LeaveService.deleteLeaveType(id);
  }

  // Leave Records
  static async getAllLeaves(): Promise<LeaveRecord[]> {
    return LeaveService.getAllLeaves();
  }

  static async getLeavesByEmployee(employeeId: string): Promise<LeaveRecord[]> {
    return LeaveService.getLeavesByEmployee(employeeId);
  }

  static async getLeavesByDateRange(startDate: string, endDate: string): Promise<LeaveRecord[]> {
    return LeaveService.getLeavesByDateRange(startDate, endDate);
  }

  static async createLeave(data: Omit<LeaveRecord, 'id' | 'createdAt'>): Promise<number> {
    return LeaveService.createLeave(data);
  }

  static async updateLeave(id: number, data: Partial<LeaveRecord>): Promise<number> {
    return LeaveService.updateLeave(id, data);
  }

  static async deleteLeave(id: number): Promise<void> {
    return LeaveService.deleteLeave(id);
  }

  static async count(): Promise<number> {
    return LeaveService.count();
  }
}
