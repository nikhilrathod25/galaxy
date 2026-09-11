export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Half Day'
  | 'Paid Leave'
  | 'Unpaid Leave'
  | 'Not Marked';

export interface AttendanceRecord {
  id: string; // Unique composite key: `${employeeId}_${date}` (e.g. "EMP001_2026-09-10")
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  overtimeHours?: number; // Extra hours worked beyond 8 hrs (e.g. 1.5, 2)
  note?: string;
  updatedAt: string; // ISO string
}

export interface DailyAttendanceRow {
  employee: {
    id?: number;
    employeeId: string;
    fullName: string;
    designation: string;
    photoUrl?: string;
    status: string;
    joiningDate: string;
    endDate?: string;
  };
  record?: AttendanceRecord;
  status: AttendanceStatus;
  note?: string;
  isBeforeJoining: boolean;
  isAfterEndDate: boolean;
}
