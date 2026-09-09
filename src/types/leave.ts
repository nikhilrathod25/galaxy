export interface LeaveType {
  id?: number;
  name: string; // e.g. "Casual Leave", "Sick Leave", "Paid Leave", "Unpaid Leave"
  isPaid: boolean;
  description?: string;
  isDefault?: boolean;
}

export interface LeaveRecord {
  id?: number;
  employeeId: string;
  leaveTypeId: number;
  leaveTypeName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  reason?: string;
  isPaid: boolean;
  createdAt: string;
}
