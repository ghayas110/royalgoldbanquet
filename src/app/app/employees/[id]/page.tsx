import { requirePermission, hasPermission } from '@/lib/session';
import { getEmployeeLedger } from '@/lib/data';
import { notFound } from 'next/navigation';
import { resolvePeriod } from '@/lib/format';
import { summarizeAttendance, salaryDeduction } from '@/lib/attendance-calc';
import { EmployeeLedgerClient } from './ledger-client';

export const metadata = { title: 'Employee — Royal Gold Banquet' };

export default async function EmployeeLedger({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('attendance.view');
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const { year, month } = resolvePeriod(sp, { year: now.getFullYear(), month: now.getMonth() + 1 });

  const ledger = await getEmployeeLedger(Number(id), year, month);
  if (!ledger) notFound();

  const summary = summarizeAttendance(ledger.attendance);
  const daysInMonth = new Date(year, month, 0).getDate();
  const suggestedAbsenceDeduction = salaryDeduction(ledger.employee.monthlySalary, daysInMonth, summary.effectiveAbsentDays);

  const alreadyPaidThisMonth = ledger.salaries.some((s) => s.year === year && s.month === month);

  return (
    <EmployeeLedgerClient
      ledger={ledger}
      year={year} month={month}
      attendanceSummary={summary}
      suggestedAbsenceDeduction={suggestedAbsenceDeduction}
      alreadyPaidThisMonth={alreadyPaidThisMonth}
      canManage={hasPermission(user, 'employees.manage')}
    />
  );
}
