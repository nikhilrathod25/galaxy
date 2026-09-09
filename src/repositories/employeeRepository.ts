import { db } from '../db/database';
import { Employee, EmployeeStatus } from '../types';
import { FirebaseSyncService } from '../services/firebaseSyncService';

export class EmployeeRepository {
  static async getAll(status?: EmployeeStatus): Promise<Employee[]> {
    if (status) {
      return db.employees.where('status').equals(status).toArray();
    }
    return db.employees.orderBy('fullName').toArray();
  }

  static async getById(id: number): Promise<Employee | undefined> {
    return db.employees.get(id);
  }

  static async getByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    return db.employees.where('employeeId').equals(employeeId).first();
  }

  static async generateNextEmployeeId(): Promise<string> {
    const all = await db.employees.toArray();
    let maxNum = 0;
    for (const emp of all) {
      const match = emp.employeeId.match(/^EMP(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `EMP${String(nextNum).padStart(3, '0')}`;
  }

  static async create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    // Validate uniqueness of employeeId
    const existing = await this.getByEmployeeId(data.employeeId);
    if (existing) {
      throw new Error(`Employee ID "${data.employeeId}" already exists.`);
    }

    const id = await db.employees.add({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    FirebaseSyncService.notifyMutation();
    return id as number;
  }

  static async update(id: number, data: Partial<Employee>): Promise<number> {
    const now = new Date().toISOString();
    const res = await db.employees.update(id, {
      ...data,
      updatedAt: now,
    });
    FirebaseSyncService.notifyMutation();
    return res;
  }

  static async delete(id: number): Promise<void> {
    await db.employees.delete(id);
    FirebaseSyncService.notifyMutation();
  }

  static async count(): Promise<number> {
    return db.employees.count();
  }
}

