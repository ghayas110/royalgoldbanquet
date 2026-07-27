/**
 * Pure attendance rules — testable, no I/O.
 *
 * Business rule (per owner):
 *   • 1 ABSENT  = 1 absent day
 *   • 3 LATE    = 1 absent day  (every 3 lates convert to one absent day)
 *   • LEAVE is tracked separately and does NOT count as an absent day.
 */
export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  leave: number;
}

export interface AttendanceSummary extends AttendanceCounts {
  marked: number;            // present + absent + late + leave
  lateAsAbsent: number;      // floor(late / 3)
  effectiveAbsentDays: number; // absent + floor(late / 3)
  lateRemainder: number;     // late % 3 (lates not yet converted)
}

export function summarizeAttendance(c: AttendanceCounts): AttendanceSummary {
  const late = Math.max(0, Math.trunc(c.late));
  const absent = Math.max(0, Math.trunc(c.absent));
  const lateAsAbsent = Math.floor(late / 3);
  return {
    present: c.present, absent, late, leave: c.leave,
    marked: c.present + absent + late + c.leave,
    lateAsAbsent,
    effectiveAbsentDays: absent + lateAsAbsent,
    lateRemainder: late % 3,
  };
}

/** Salary deduction for a month given per-day pay and effective absent days. */
export function salaryDeduction(monthlySalary: number, workingDays: number, effectiveAbsentDays: number): number {
  if (workingDays <= 0) return 0;
  const perDay = monthlySalary / workingDays;
  return Math.round(perDay * effectiveAbsentDays * 100) / 100;
}
