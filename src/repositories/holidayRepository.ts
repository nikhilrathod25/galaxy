import { db } from '../db/database';
import { Holiday } from '../types';
import { CloudSyncService } from '../services/cloudSyncService';

export class HolidayRepository {
  static async getAll(): Promise<Holiday[]> {
    return db.holidays.orderBy('date').toArray();
  }

  static async getByYear(year: number): Promise<Holiday[]> {
    return db.holidays.where('year').equals(year).sortBy('date');
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<Holiday[]> {
    return db.holidays
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  static async getByDate(date: string): Promise<Holiday | undefined> {
    return db.holidays.where('date').equals(date).first();
  }

  static async create(data: Omit<Holiday, 'id'>): Promise<number> {
    const existing = await this.getByDate(data.date);
    if (existing) {
      throw new Error(`Holiday on ${data.date} already exists (${existing.name}).`);
    }
    const id = (await db.holidays.add(data)) as number;
    CloudSyncService.notifyMutation();
    return id;
  }

  static async update(id: number, data: Partial<Holiday>): Promise<number> {
    const res = await db.holidays.update(id, data);
    CloudSyncService.notifyMutation();
    return res;
  }

  static async delete(id: number): Promise<void> {
    await db.holidays.delete(id);
    CloudSyncService.notifyMutation();
  }

  static async count(): Promise<number> {
    return db.holidays.count();
  }
}

