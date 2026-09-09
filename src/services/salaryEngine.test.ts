import { calculateMonthlySalary } from '../services/salaryEngine';
import { Employee, AttendanceRecord, Holiday } from '../types';

function runTests() {
  console.log('=== RUNNING SALARY ENGINE ACCEPTANCE TESTS ===\n');

  // Acceptance Test Case 1: Standard Prompt Benchmark
  // Monthly Salary = ₹30,000, Working Days = 25
  // Present = 20, Absent = 2, Half Day = 1, Paid Leave = 2
  // September 2026 has 30 days (4 Sundays: Sep 6, 13, 20, 27; 1 Holiday: Sep 15 -> 25 working days)
  const emp1: Employee = {
    employeeId: 'EMP003',
    fullName: 'Amit Verma',
    designation: 'Operations Executive',
    phone: '9876533333',
    email: 'amit@example.com',
    address: 'City',
    joiningDate: '2026-09-01',
    monthlySalary: 30000,
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const holidaySep15: Holiday = {
    name: 'Ganesh Chaturthi',
    date: '2026-09-15',
    year: 2026,
  };

  const attendanceRecs: AttendanceRecord[] = [
    // 2 Absent: Sep 2, Sep 7
    { id: 'EMP003_2026-09-02', employeeId: 'EMP003', date: '2026-09-02', status: 'Absent', updatedAt: '' },
    { id: 'EMP003_2026-09-07', employeeId: 'EMP003', date: '2026-09-07', status: 'Absent', updatedAt: '' },
    // 1 Half Day: Sep 5
    { id: 'EMP003_2026-09-05', employeeId: 'EMP003', date: '2026-09-05', status: 'Half Day', updatedAt: '' },
    // 2 Paid Leave: Sep 8, Sep 9
    { id: 'EMP003_2026-09-08', employeeId: 'EMP003', date: '2026-09-08', status: 'Paid Leave', updatedAt: '' },
    { id: 'EMP003_2026-09-09', employeeId: 'EMP003', date: '2026-09-09', status: 'Paid Leave', updatedAt: '' },
  ];

  // 20 Present days
  const presentDates = [
    '2026-09-01', '2026-09-03', '2026-09-04', '2026-09-10', '2026-09-11',
    '2026-09-12', '2026-09-14', '2026-09-16', '2026-09-17', '2026-09-18',
    '2026-09-19', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    '2026-09-25', '2026-09-26', '2026-09-28', '2026-09-29', '2026-09-30'
  ];
  presentDates.forEach(d => {
    attendanceRecs.push({ id: `EMP003_${d}`, employeeId: 'EMP003', date: d, status: 'Present', updatedAt: '' });
  });

  const result = calculateMonthlySalary({
    employee: emp1,
    year: 2026,
    month: 9,
    attendance: attendanceRecs,
    holidays: [holidaySep15],
    calculationMode: 'working_days',
  });

  console.log('Result for Acceptance Test 1:');
  console.log(`- Working Days in Month: ${result.totalWorkingDaysInMonth} (Expected: 25)`);
  console.log(`- Present Days: ${result.presentDays} (Expected: 20)`);
  console.log(`- Absent Days: ${result.absentDays} (Expected: 2)`);
  console.log(`- Half Days: ${result.halfDays} (Expected: 1)`);
  console.log(`- Paid Leave Days: ${result.paidLeaveDays} (Expected: 2)`);
  console.log(`- Daily Salary: ₹${result.dailySalary} (Expected: ₹1200)`);
  console.log(`- Absent Deduction: ₹${result.absentDeduction} (Expected: ₹2400)`);
  console.log(`- Half Day Deduction: ₹${result.halfDayDeduction} (Expected: ₹600)`);
  console.log(`- Total Deductions: ₹${result.totalDeductions} (Expected: ₹3000)`);
  console.log(`- Final Net Salary: ₹${result.finalSalary} (Expected: ₹27000)`);

  if (result.finalSalary === 27000 && result.totalWorkingDaysInMonth === 25) {
    console.log('\n>>> ACCEPTANCE TEST 1 PASSED SUCCESSFULLY! <<<\n');
  } else {
    console.error('\n>>> ACCEPTANCE TEST 1 FAILED! <<<');
    process.exit(1);
  }

  // Acceptance Test Case 2: Future Dates Not Marked
  // Only Sep 1-10 entered, Sep 11-30 are Not Marked.
  // Not Marked must NOT trigger absent deductions!
  const partialRecs = attendanceRecs.filter(r => r.date <= '2026-09-10');
  const resultPartial = calculateMonthlySalary({
    employee: emp1,
    year: 2026,
    month: 9,
    attendance: partialRecs,
    holidays: [holidaySep15],
    calculationMode: 'working_days',
  });

  console.log('Result for Acceptance Test 2 (Partial Month - Future Not Marked):');
  console.log(`- Absent Days: ${resultPartial.absentDays}`);
  console.log(`- Not Marked Days: ${resultPartial.notMarkedDays}`);
  console.log(`- Total Deductions: ₹${resultPartial.totalDeductions} (Only for explicit absences/half-days)`);
  console.log(`- Final Salary: ₹${resultPartial.finalSalary}`);

  if (resultPartial.absentDays === 2 && resultPartial.notMarkedDays > 0) {
    console.log('\n>>> ACCEPTANCE TEST 2 (FUTURE NOT MARKED) PASSED SUCCESSFULLY! <<<\n');
  } else {
    console.error('\n>>> ACCEPTANCE TEST 2 FAILED! <<<');
    process.exit(1);
  }

  console.log('ALL PROGRAMMATIC ACCEPTANCE TESTS PASSED!');
}

runTests();
