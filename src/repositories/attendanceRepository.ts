import { AttendanceService } from '../services/attendanceService';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { GoogleDriveSyncService } from '../services/googleDriveSyncService';

export class AttendanceRepository {
  static generateId(employeeId: string, date: string): string {
    return AttendanceService.generateId(employeeId, date);
  }

  static async getByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecord | undefined> {
    return AttendanceService.getByEmployeeAndDate(employeeId, date);
  }

  static async getByDate(date: string): Promise<AttendanceRecord[]> {
    return AttendanceService.getByDate(date);
  }

  static async getAll(): Promise<AttendanceRecord[]> {
    return AttendanceService.getAll();
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    return AttendanceService.getByDateRange(startDate, endDate);
  }

  static async getByEmployeeAndMonth(employeeId: string, year: number, month: number): Promise<AttendanceRecord[]> {
    return AttendanceService.getByEmployeeAndMonth(employeeId, year, month);
  }

  static async getMonthAttendance(year: number, month: number): Promise<AttendanceRecord[]> {
    return AttendanceService.getMonthAttendance(year, month);
  }

  static async setStatus(
    employeeId: string,
    date: string,
    status: AttendanceStatus,
    note?: string,
    overtimeHours?: number
  ): Promise<string> {
    const res = await AttendanceService.setStatus(employeeId, date, status, note, overtimeHours);
    GoogleDriveSyncService.triggerBackgroundSync();
    return res;
  }

  static async bulkSetStatus(
    records: Array<{ employeeId: string; date: string; status: AttendanceStatus; note?: string; overtimeHours?: number }>
  ): Promise<void> {
    await AttendanceService.bulkSetStatus(records);
    GoogleDriveSyncService.triggerBackgroundSync();
  }

  static async markAllPresentForDate(
    date: string,
    employeeIds: string[],
    overwriteExisting: boolean = false
  ): Promise<{ updatedCount: number; skippedCount: number }> {
    const res = await AttendanceService.markAllPresentForDate(date, employeeIds, overwriteExisting);
    GoogleDriveSyncService.triggerBackgroundSync();
    return res;
  }

  static async count(): Promise<number> {
    return AttendanceService.count();
  }
}
