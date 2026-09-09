import { db } from '../db/database';
import { FinalizedSalaryRecord } from '../types';
import { FirebaseSyncService } from '../services/firebaseSyncService';

export class SalaryRepository {
  static generateId(employeeId: string, year: number, month: number): string {
    const monthStr = String(month).padStart(2, '0');
    return `${employeeId}_${year}_${monthStr}`;
  }

  static async getById(id: string): Promise<FinalizedSalaryRecord | undefined> {
    return db.salary_records.get(id);
  }

  static async getByEmployeeAndMonth(
    employeeId: string,
    year: number,
    month: number
  ): Promise<FinalizedSalaryRecord | undefined> {
    const id = this.generateId(employeeId, year, month);
    return db.salary_records.get(id);
  }

  static async getByMonth(year: number, month: number): Promise<FinalizedSalaryRecord[]> {
    return db.salary_records
      .where('year')
      .equals(year)
      .and(r => r.month === month)
      .toArray();
  }

  static async getByEmployee(employeeId: string): Promise<FinalizedSalaryRecord[]> {
    return db.salary_records
      .where('employeeId')
      .equals(employeeId)
      .reverse()
      .sortBy('year');
  }

  static async getAll(): Promise<FinalizedSalaryRecord[]> {
    return db.salary_records.toArray();
  }

  static async saveFinalizedRecord(record: FinalizedSalaryRecord): Promise<string> {
    const now = new Date().toISOString();
    const toSave: FinalizedSalaryRecord = {
      ...record,
      id: record.id || this.generateId(record.employeeId, record.year, record.month),
      isFinalized: true,
      finalizedAt: record.finalizedAt || now,
      updatedAt: now,
    };
    await db.salary_records.put(toSave);
    FirebaseSyncService.notifyMutation();
    return toSave.id;
  }

  static async delete(id: string): Promise<void> {
    await db.salary_records.delete(id);
    FirebaseSyncService.notifyMutation();
  }

  static async count(): Promise<number> {
    return db.salary_records.count();
  }
}
