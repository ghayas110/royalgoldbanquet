import { requirePermission, can } from '@/lib/session';
import { getDefaultPeriod, getAttendanceMatrix } from '@/lib/data';
import { resolvePeriod } from '@/lib/format';
import { AttendanceClient } from './attendance-client';

export const metadata = { title: 'Attendance — Skylight Ballroom & Catering' };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission('attendance.view');
  const sp = await searchParams;
  // Attendance is tracked for the current month by default (not tied to booking activity)
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const { year, month } = resolvePeriod(sp, fallback);
  const matrix = await getAttendanceMatrix(year, month);

  return (
    <AttendanceClient
      year={year} month={month}
      days={matrix.days}
      employees={matrix.employees.map((e: any) => ({
        id: e.id, name: e.name, designation: e.designation, salary: Number(e.monthly_salary),
        userRole: e.user_role ?? null,
      }))}
      cells={matrix.cells}
      canMark={can(user.permissions, 'attendance.mark')}
      canManage={can(user.permissions, 'employees.manage')}
    />
  );
}
