import { HolidayService } from '../services/holidayService';
import { Holiday } from '../types';

export class HolidayRepository {
  static async getAll(): Promise<Holiday[]> {
    return HolidayService.getAll();
  }

  static async getByYear(year: number): Promise<Holiday[]> {
    return HolidayService.getByYear(year);
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<Holiday[]> {
    return HolidayService.getByDateRange(startDate, endDate);
  }

  static async getByDate(date: string): Promise<Holiday | undefined> {
    return HolidayService.getByDate(date);
  }

  static async create(data: Omit<Holiday, 'id'>): Promise<number> {
    return HolidayService.create(data);
  }

  static async update(id: number, data: Partial<Holiday>): Promise<number> {
    return HolidayService.update(id, data);
  }

  static async delete(id: number): Promise<void> {
    return HolidayService.delete(id);
  }

  static async count(): Promise<number> {
    return HolidayService.count();
  }
}
