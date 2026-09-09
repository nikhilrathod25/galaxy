export type EmployeeStatus = 'Active' | 'Inactive';

export interface Employee {
  id?: number;
  employeeId: string; // e.g. "EMP001" - Unique & stable across devices
  fullName: string;
  photoUrl?: string; // base64 compressed data URL
  phone: string;
  email: string;
  address: string;
  designation: string;
  joiningDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional, if resigned/terminated)
  monthlySalary: number; // Base monthly salary in INR (e.g. 30000)
  status: EmployeeStatus;
  notes?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}
