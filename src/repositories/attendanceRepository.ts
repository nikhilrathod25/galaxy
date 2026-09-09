import { db } from '../db/database';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { FirebaseSyncService } from '../services/firebaseSyncService';

export class AttendanceRepository {
  /**
   * Generates a stable unique composite key: `${employeeId}_${date}`
   */
  static generateId(employeeId: string, date: string): string {
    return `${employeeId}_${date}`;
  }

  static async getByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecord | undefined> {
    const id = this.generateId(employeeId, date);
    return db.attendance.get(id);
  }

  static async getByDate(date: string): Promise<AttendanceRecord[]> {
    return db.attendance.where('date').equals(date).toArray();
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    return db.attendance
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  static async getByEmployeeAndMonth(employeeId: string, year: number, month: number): Promise<AttendanceRecord[]> {
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    // Calculate last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const records = await db.attendance
      .where('employeeId')
      .equals(employeeId)
      .and(r => r.date >= startDate && r.date <= endDate)
      .toArray();

    return records;
  }

  static async getMonthAttendance(year: number, month: number): Promise<AttendanceRecord[]> {
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    return db.attendance
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  static async setStatus(
    employeeId: string,
    date: string,
    status: AttendanceStatus,
    note?: string
  ): Promise<string> {
    const id = this.generateId(employeeId, date);
    const now = new Date().toISOString();

    if (status === 'Not Marked') {
      // If setting back to Not Marked, we can delete the record or update
      await db.attendance.delete(id);
      FirebaseSyncService.notifyMutation();
      return id;
    }

    await db.attendance.put({
      id,
      employeeId,
      date,
      status,
      note,
      updatedAt: now,
    });

    FirebaseSyncService.notifyMutation();
    return id;
  }

  static async bulkSetStatus(
    records: Array<{ employeeId: string; date: string; status: AttendanceStatus; note?: string }>
  ): Promise<void> {
    const now = new Date().toISOString();
    const toPut: AttendanceRecord[] = [];
    const toDelete: string[] = [];

    for (const r of records) {
      const id = this.generateId(r.employeeId, r.date);
      if (r.status === 'Not Marked') {
        toDelete.push(id);
      } else {
        toPut.push({
          id,
          employeeId: r.employeeId,
          date: r.date,
          status: r.status,
          note: r.note,
          updatedAt: now,
        });
      }
    }

    await db.transaction('rw', db.attendance, async () => {
      if (toDelete.length > 0) {
        await db.attendance.bulkDelete(toDelete);
      }
      if (toPut.length > 0) {
        await db.attendance.bulkPut(toPut);
      }
    });

    FirebaseSyncService.notifyMutation();
  }

  static async markAllPresentForDate(
    date: string,
    employeeIds: string[],
    overwriteExisting: boolean = false
  ): Promise<{ updatedCount: number; skippedCount: number }> {
    const existing = await this.getByDate(date);
    const existingMap = new Map(existing.map(r => [r.employeeId, r]));

    const now = new Date().toISOString();
    const toPut: AttendanceRecord[] = [];
    let skippedCount = 0;

    for (const empId of employeeIds) {
      const current = existingMap.get(empId);
      if (current && !overwriteExisting && current.status !== 'Not Marked') {
        skippedCount++;
        continue;
      }
      toPut.push({
        id: this.generateId(empId, date),
        employeeId: empId,
        date,
        status: 'Present',
        updatedAt: now,
      });
    }

    if (toPut.length > 0) {
      await db.attendance.bulkPut(toPut);
      FirebaseSyncService.notifyMutation();
    }

    return {
      updatedCount: toPut.length,
      skippedCount,
    };
  }

  static async count(): Promise<number> {
    return db.attendance.count();
  }
}

