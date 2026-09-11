import { EmployeeService } from '../services/employeeService';
import { Employee, EmployeeStatus } from '../types';
import { GoogleDriveSyncService } from '../services/googleDriveSyncService';

export class EmployeeRepository {
  static async getAll(status?: EmployeeStatus): Promise<Employee[]> {
    return EmployeeService.getAll(status);
  }

  static async getById(id: number): Promise<Employee | undefined> {
    return EmployeeService.getById(id);
  }

  static async getByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    return EmployeeService.getByEmployeeId(employeeId);
  }

  static async generateNextEmployeeId(): Promise<string> {
    return EmployeeService.generateNextEmployeeId();
  }

  static async create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const res = await EmployeeService.create(data);
    GoogleDriveSyncService.triggerBackgroundSync();
    return res;
  }

  static async update(id: number, data: Partial<Employee>): Promise<number> {
    const res = await EmployeeService.update(id, data);
    GoogleDriveSyncService.triggerBackgroundSync();
    return res;
  }

  static async delete(id: number): Promise<void> {
    await EmployeeService.delete(id);
    GoogleDriveSyncService.triggerBackgroundSync();
  }

  static async count(): Promise<number> {
    return EmployeeService.count();
  }
}
