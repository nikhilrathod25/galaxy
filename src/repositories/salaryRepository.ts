import { SalaryService } from '../services/salaryService';
import { FinalizedSalaryRecord } from '../types';
import { GoogleDriveSyncService } from '../services/googleDriveSyncService';

export class SalaryRepository {
  static generateId(employeeId: string, year: number, month: number): string {
    return SalaryService.generateId(employeeId, year, month);
  }

  static async getById(id: string): Promise<FinalizedSalaryRecord | undefined> {
    return SalaryService.getById(id);
  }

  static async getByEmployeeAndMonth(
    employeeId: string,
    year: number,
    month: number
  ): Promise<FinalizedSalaryRecord | undefined> {
    return SalaryService.getByEmployeeAndMonth(employeeId, year, month);
  }

  static async getByMonth(year: number, month: number): Promise<FinalizedSalaryRecord[]> {
    return SalaryService.getByMonth(year, month);
  }

  static async getByEmployee(employeeId: string): Promise<FinalizedSalaryRecord[]> {
    return SalaryService.getByEmployee(employeeId);
  }

  static async getAll(): Promise<FinalizedSalaryRecord[]> {
    return SalaryService.getAll();
  }

  static async saveFinalizedRecord(record: FinalizedSalaryRecord): Promise<string> {
    const res = await SalaryService.saveFinalizedRecord(record);
    GoogleDriveSyncService.triggerBackgroundSync();
    return res;
  }

  static async delete(id: string): Promise<void> {
    await SalaryService.delete(id);
    GoogleDriveSyncService.triggerBackgroundSync();
  }

  static async count(): Promise<number> {
    return SalaryService.count();
  }
}
