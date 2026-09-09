import { db } from './database';
import { Employee, AttendanceRecord, Holiday } from '../types';

export async function seedSampleData(): Promise<{ employeesCount: number; attendanceCount: number }> {
  // Check if employees already exist
  const count = await db.employees.count();
  if (count > 0) {
    throw new Error('Database already has employees. Clear database before loading sample data.');
  }

  const now = new Date().toISOString();

  // 1. Sample Employees
  const sampleEmployees: Omit<Employee, 'id'>[] = [
    {
      employeeId: 'EMP001',
      fullName: 'Rahul Sharma',
      designation: 'Senior Developer',
      phone: '+91 98765 11111',
      email: 'rahul.sharma@example.com',
      address: 'A-102, Green Avenue, Sector 62',
      joiningDate: '2026-01-01',
      monthlySalary: 50000,
      status: 'Active',
      notes: 'Team Lead for Frontend and Mobile',
      createdAt: now,
      updatedAt: now,
    },
    {
      employeeId: 'EMP002',
      fullName: 'Priya Patel',
      designation: 'UI/UX Designer',
      phone: '+91 98765 22222',
      email: 'priya.patel@example.com',
      address: 'B-304, Sunshine Residency',
      joiningDate: '2026-02-15',
      monthlySalary: 35000,
      status: 'Active',
      notes: 'Designs product interfaces and marketing collaterals',
      createdAt: now,
      updatedAt: now,
    },
    {
      employeeId: 'EMP003',
      fullName: 'Amit Verma',
      designation: 'Operations Executive',
      phone: '+91 98765 33333',
      email: 'amit.verma@example.com',
      address: 'C-501, Royal Heights',
      joiningDate: '2026-09-01',
      monthlySalary: 30000,
      status: 'Active',
      notes: 'Acceptance test benchmark employee (₹30,000)',
      createdAt: now,
      updatedAt: now,
    },
    {
      employeeId: 'EMP004',
      fullName: 'Sneha Roy',
      designation: 'Accountant',
      phone: '+91 98765 44444',
      email: 'sneha.roy@example.com',
      address: 'D-202, Metro View Towers',
      joiningDate: '2026-09-10', // Mid-month joiner test
      monthlySalary: 28000,
      status: 'Active',
      notes: 'Joined mid-September',
      createdAt: now,
      updatedAt: now,
    },
    {
      employeeId: 'EMP005',
      fullName: 'Vikram Singh',
      designation: 'Sales Manager',
      phone: '+91 98765 55555',
      email: 'vikram.singh@example.com',
      address: 'E-101, Palm Grove Enclave',
      joiningDate: '2026-03-01',
      monthlySalary: 42000,
      status: 'Active',
      notes: 'Field client relationships',
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.employees.bulkAdd(sampleEmployees as Employee[]);

  // 2. Sample Holidays for 2026
  const sampleHolidays: Omit<Holiday, 'id'>[] = [
    { name: 'Republic Day', date: '2026-01-26', year: 2026, description: 'National Holiday' },
    { name: 'Holi', date: '2026-03-04', year: 2026, description: 'Festival of Colors' },
    { name: 'Independence Day', date: '2026-08-15', year: 2026, description: 'National Holiday' },
    { name: 'Ganesh Chaturthi', date: '2026-09-15', year: 2026, description: 'State Holiday' },
    { name: 'Gandhi Jayanti', date: '2026-10-02', year: 2026, description: 'National Holiday' },
    { name: 'Diwali', date: '2026-11-08', year: 2026, description: 'Festival of Lights' },
    { name: 'Christmas', date: '2026-12-25', year: 2026, description: 'Christmas Day' },
  ];

  for (const h of sampleHolidays) {
    const existing = await db.holidays.where('date').equals(h.date).first();
    if (!existing) {
      await db.holidays.add(h as Holiday);
    }
  }

  // 3. Sample Attendance for September 2026 (Days 1 to 10)
  // For Amit Verma (EMP003): Matches acceptance test (Present, Absent, Half Day, Paid Leave)
  const attendanceRecords: AttendanceRecord[] = [];
  
  // Rahul Sharma (EMP001): All Present
  for (let d = 1; d <= 10; d++) {
    const dayStr = String(d).padStart(2, '0');
    const date = `2026-09-${dayStr}`;
    attendanceRecords.push({
      id: `EMP001_${date}`,
      employeeId: 'EMP001',
      date,
      status: 'Present',
      updatedAt: now,
    });
  }

  // Priya Patel (EMP002): 8 Present, 1 Half Day, 1 Paid Leave
  for (let d = 1; d <= 10; d++) {
    const dayStr = String(d).padStart(2, '0');
    const date = `2026-09-${dayStr}`;
    let status: any = 'Present';
    if (d === 4) status = 'Half Day';
    if (d === 8) status = 'Paid Leave';
    attendanceRecords.push({
      id: `EMP002_${date}`,
      employeeId: 'EMP002',
      date,
      status,
      updatedAt: now,
    });
  }

  // Amit Verma (EMP003): 6 Present, 2 Absent, 1 Half Day, 1 Paid Leave
  for (let d = 1; d <= 10; d++) {
    const dayStr = String(d).padStart(2, '0');
    const date = `2026-09-${dayStr}`;
    let status: any = 'Present';
    if (d === 2 || d === 7) status = 'Absent';
    if (d === 5) status = 'Half Day';
    if (d === 9) status = 'Paid Leave';
    attendanceRecords.push({
      id: `EMP003_${date}`,
      employeeId: 'EMP003',
      date,
      status,
      updatedAt: now,
    });
  }

  await db.attendance.bulkPut(attendanceRecords);

  return {
    employeesCount: sampleEmployees.length,
    attendanceCount: attendanceRecords.length,
  };
}
