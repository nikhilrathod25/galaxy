import { EmployeeService } from '../services/employeeService';
import { Employee, EmployeeStatus } from '../types';

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
    return EmployeeService.create(data);
  }

  static async update(id: number, data: Partial<Employee>): Promise<number> {
    return EmployeeService.update(id, data);
  }

  static async delete(id: number): Promise<void> {
    return EmployeeService.delete(id);
  }

  static async count(): Promise<number> {
    return EmployeeService.count();
  }
}
