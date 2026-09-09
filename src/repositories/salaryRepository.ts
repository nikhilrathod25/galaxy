import { SalaryService } from '../services/salaryService';
import { FinalizedSalaryRecord } from '../types';

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
    return SalaryService.saveFinalizedRecord(record);
  }

  static async delete(id: string): Promise<void> {
    return SalaryService.delete(id);
  }

  static async count(): Promise<number> {
    return SalaryService.count();
  }
}
