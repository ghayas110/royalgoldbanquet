'use server';

import { z } from 'zod';
import { execute, queryOne, query, withTransaction } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export type SalaryResult = { ok: true; message?: string } | { ok: false; error: string };

/** Resolve an expense head id by name (for posting salary/loan into the expense sheet). */
async function headIdByName(name: string): Promise<number | null> {
  const row = await queryOne<{ id: number }>(`SELECT id FROM expense_heads WHERE name = ? AND is_active = 1 LIMIT 1`, [name]);
  return row?.id ?? null;
}

// ── Loans ──────────────────────────────────────────────
const loanSchema = z.object({
  employeeId: z.number().int().positive(),
  amount: z.number().positive().max(9999999),
  dateTaken: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(255).optional().nullable(),
  postToExpense: z.boolean().default(true),
});

export async function addLoan(input: unknown): Promise<SalaryResult> {
  const actor = await assertPermission('employees.manage');
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { employeeId, amount, dateTaken, note, postToExpense } = parsed.data;

  const res = await execute(
    `INSERT INTO employee_loans (employee_id, amount, date_taken, note, is_settled, created_by) VALUES (?,?,?,?,0,?)`,
    [employeeId, amount, dateTaken, note || null, actor.id],
  );
  // Post the loan given into the expense sheet under "Employee Loan"
  if (postToExpense) {
    const headId = await headIdByName('Employee Loan');
    if (headId) {
      await execute(`INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, entered_by) VALUES (?,?,?,?,?)`,
        [dateTaken, headId, amount, `Loan to employee #${employeeId}`, actor.id]);
    }
  }
  await audit({ userId: actor.id, action: 'CREATE', entity: 'employee_loan', entityId: res.insertId, after: { employeeId, amount } });
  revalidatePath(`/app/employees/${employeeId}`);
  return { ok: true, message: 'Loan recorded.' };
}

/** Manually record a loan repayment not tied to a salary run. */
export async function repayLoan(loanId: number, employeeId: number, amount: number, date: string, note?: string): Promise<SalaryResult> {
  const actor = await assertPermission('employees.manage');
  if (amount <= 0) return { ok: false, error: 'Enter an amount.' };
  await execute(`INSERT INTO loan_repayments (loan_id, employee_id, amount, repay_date, note) VALUES (?,?,?,?,?)`,
    [loanId, employeeId, amount, date, note || 'Manual repayment']);
  await settleIfCleared(loanId);
  await audit({ userId: actor.id, action: 'REPAY', entity: 'employee_loan', entityId: loanId, after: { amount } });
  revalidatePath(`/app/employees/${employeeId}`);
  return { ok: true, message: 'Repayment recorded.' };
}

async function settleIfCleared(loanId: number) {
  const row = await queryOne<{ principal: number; repaid: number }>(
    `SELECT l.amount principal, COALESCE((SELECT SUM(amount) FROM loan_repayments r WHERE r.loan_id = l.id),0) repaid
       FROM employee_loans l WHERE l.id = ?`, [loanId]);
  if (row && Number(row.repaid) >= Number(row.principal)) {
    await execute(`UPDATE employee_loans SET is_settled = 1 WHERE id = ?`, [loanId]);
  }
}

// ── Salary disbursement ────────────────────────────────
const salarySchema = z.object({
  employeeId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  baseSalary: z.number().min(0).max(9999999),
  absentDays: z.number().min(0).max(31),
  absenceDeduction: z.number().min(0).max(9999999),
  loanDeduction: z.number().min(0).max(9999999),
  otherDeduction: z.number().min(0).max(9999999),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(255).optional().nullable(),
  postToExpense: z.boolean().default(true),
});

export async function disburseSalary(input: unknown): Promise<SalaryResult> {
  const actor = await assertPermission('employees.manage');
  const parsed = salarySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const d = parsed.data;

  const existing = await queryOne(`SELECT id FROM salary_payments WHERE employee_id=? AND year=? AND month=?`, [d.employeeId, d.year, d.month]);
  if (existing) return { ok: false, error: 'Salary for this month is already disbursed.' };

  // An advance is part of THIS salary — money already handed over — so it comes
  // out of what is left to pay. Worked out server-side rather than trusted from
  // the form, and capped at what the month can bear so net never goes negative.
  const advanceOutstanding = await outstandingAdvanceTotal(d.employeeId);
  const beforeAdvance = Math.max(0, d.baseSalary - d.absenceDeduction - d.loanDeduction - d.otherDeduction);
  const advanceDeduction = Math.min(advanceOutstanding, beforeAdvance);
  const net = beforeAdvance - advanceDeduction;

  // Validate loan deduction does not exceed outstanding
  if (d.loanDeduction > 0) {
    const out = await outstandingLoanTotal(d.employeeId);
    if (d.loanDeduction > out + 0.01) return { ok: false, error: `Loan deduction exceeds outstanding (${out}).` };
  }

  try {
    const salaryId = await withTransaction(async (tx) => {
      const res = await tx.execute(
        `INSERT INTO salary_payments (employee_id, year, month, base_salary, absent_days, absence_deduction, loan_deduction, advance_deduction, other_deduction, net_paid, paid_date, note, paid_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [d.employeeId, d.year, d.month, d.baseSalary, d.absentDays, d.absenceDeduction, d.loanDeduction, advanceDeduction, d.otherDeduction, net, d.paidDate, d.note || null, actor.id],
      );
      const salaryId = res.insertId;

      // Recover the advances this salary just absorbed, oldest first, so each
      // one carries the salary run that cleared it.
      let advLeft = advanceDeduction;
      if (advLeft > 0) {
        const open = await tx.query<any>(
          `SELECT id, amount, recovered FROM employee_advances
            WHERE employee_id = ? AND is_settled = 0 ORDER BY advance_date, id`,
          [d.employeeId],
        );
        for (const a of open) {
          if (advLeft <= 0) break;
          const owed = Number(a.amount) - Number(a.recovered);
          if (owed <= 0) continue;
          const take = Math.min(owed, advLeft);
          const nowRecovered = Number(a.recovered) + take;
          await tx.execute(
            `UPDATE employee_advances
                SET recovered = ?, is_settled = ?, salary_payment_id = ?
              WHERE id = ?`,
            [nowRecovered, nowRecovered >= Number(a.amount) ? 1 : 0, salaryId, a.id],
          );
          advLeft -= take;
        }
      }

      // Allocate loan deduction against unsettled loans (oldest first)
      let remaining = d.loanDeduction;
      if (remaining > 0) {
        const loans = await tx.query<any>(
          `SELECT l.id, l.amount, COALESCE((SELECT SUM(amount) FROM loan_repayments r WHERE r.loan_id=l.id),0) repaid
             FROM employee_loans l WHERE l.employee_id=? AND l.is_settled=0 ORDER BY l.date_taken, l.id`,
          [d.employeeId],
        );
        for (const l of loans) {
          if (remaining <= 0) break;
          const owed = Number(l.amount) - Number(l.repaid);
          if (owed <= 0) continue;
          const pay = Math.min(owed, remaining);
          await tx.execute(`INSERT INTO loan_repayments (loan_id, employee_id, amount, repay_date, salary_payment_id, note) VALUES (?,?,?,?,?,?)`,
            [l.id, d.employeeId, pay, d.paidDate, salaryId, `Deducted from ${d.month}/${d.year} salary`]);
          if (Number(l.repaid) + pay >= Number(l.amount)) await tx.execute(`UPDATE employee_loans SET is_settled=1 WHERE id=?`, [l.id]);
          remaining -= pay;
        }
      }
      return salaryId;
    });

    // Post net salary into the expense sheet under "Salary Expense"
    if (d.postToExpense) {
      const headId = await headIdByName('Salary Expense');
      if (headId) {
        await execute(`INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, entered_by) VALUES (?,?,?,?,?)`,
          [d.paidDate, headId, net, `Salary #${d.employeeId} ${d.month}/${d.year}`, actor.id]);
      }
    }

    await audit({ userId: actor.id, action: 'DISBURSE_SALARY', entity: 'salary_payment', entityId: salaryId, after: { employeeId: d.employeeId, net } });
    revalidatePath(`/app/employees/${d.employeeId}`);
    return {
      ok: true,
      message: advanceDeduction > 0
        ? `Salary disbursed — Rs. ${advanceDeduction.toLocaleString('en-PK')} advance recovered, net Rs. ${net.toLocaleString('en-PK')} paid.`
        : `Salary disbursed — net Rs. ${net.toLocaleString('en-PK')}.`,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function outstandingLoanTotal(employeeId: number): Promise<number> {
  const row = await queryOne<{ out: number }>(
    `SELECT COALESCE(SUM(l.amount),0) - COALESCE((SELECT SUM(r.amount) FROM loan_repayments r WHERE r.employee_id=?),0) AS out
       FROM employee_loans l WHERE l.employee_id=?`, [employeeId, employeeId]);
  return Math.max(0, Number(row?.out ?? 0));
}

// ── Salary advances ────────────────────────────────────
// An advance is this month's own money taken early; a LOAN is a larger sum
// repaid over months. Keeping them apart is what the owner asked for.
const advanceSchema = z.object({
  employeeId: z.number().int().positive(),
  amount: z.number().positive().max(9999999),
  advanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  note: z.string().max(255).optional().nullable(),
  postToExpense: z.boolean().default(true),
});

/** Advances taken but not yet recovered out of a salary run. */
async function outstandingAdvanceTotal(employeeId: number): Promise<number> {
  // `outstanding`, not `out` — OUT is a MySQL reserved word and fails to parse
  // as a bare alias here.
  const row = await queryOne<{ outstanding: number }>(
    `SELECT COALESCE(SUM(amount - recovered), 0) AS outstanding
       FROM employee_advances WHERE employee_id = ? AND is_settled = 0`,
    [employeeId],
  );
  return Math.max(0, Number(row?.outstanding ?? 0));
}

export async function addAdvance(input: unknown): Promise<SalaryResult> {
  const actor = await assertPermission('employees.manage');
  const parsed = advanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { employeeId, amount, advanceDate, note, postToExpense } = parsed.data;

  const emp = await queryOne<{ name: string; monthly_salary: string }>(
    `SELECT name, monthly_salary FROM employees WHERE id = ?`, [employeeId],
  );
  if (!emp) return { ok: false, error: 'Employee not found.' };

  // An advance larger than the salary it comes out of cannot be recovered next
  // month, which is how an "advance" quietly turns into an unrecorded loan.
  const salary = Number(emp.monthly_salary);
  const already = await outstandingAdvanceTotal(employeeId);
  if (salary > 0 && already + amount > salary) {
    return {
      ok: false,
      error: `That would put ${emp.name}'s advances at Rs. ${(already + amount).toLocaleString('en-PK')}, above the Rs. ${salary.toLocaleString('en-PK')} monthly salary it is recovered from. Record it as a loan instead.`,
    };
  }

  const res = await execute(
    `INSERT INTO employee_advances (employee_id, amount, advance_date, note, created_by) VALUES (?,?,?,?,?)`,
    [employeeId, amount, advanceDate, note || null, actor.id],
  );

  // The cash leaves today, so the expense is dated today — not at month end.
  if (postToExpense) {
    const headId = await headIdByName('Advance to Employees');
    if (headId) {
      await execute(
        `INSERT INTO petty_cash_entries (entry_date, expense_head_id, amount, qty_note, entered_by) VALUES (?,?,?,?,?)`,
        [advanceDate, headId, amount, `Advance — ${emp.name}`.slice(0, 80), actor.id],
      );
    }
  }

  await audit({ userId: actor.id, action: 'CREATE', entity: 'employee_advance', entityId: res.insertId, after: { employeeId, amount } });
  revalidatePath(`/app/employees/${employeeId}`);
  revalidatePath('/app/petty-cash');
  return { ok: true, message: `Advance of Rs. ${amount.toLocaleString('en-PK')} recorded for ${emp.name}.` };
}

/** Remove an advance entered by mistake. Refused once salary has recovered any of it. */
export async function deleteAdvance(advanceId: number): Promise<SalaryResult> {
  const actor = await assertPermission('employees.manage');
  const row = await queryOne<{ employee_id: number; recovered: string; amount: string }>(
    `SELECT employee_id, recovered, amount FROM employee_advances WHERE id = ?`, [advanceId],
  );
  if (!row) return { ok: false, error: 'Advance not found.' };
  if (Number(row.recovered) > 0) {
    return { ok: false, error: 'Part of this advance has already been recovered from a salary — it can no longer be deleted.' };
  }
  await execute(`DELETE FROM employee_advances WHERE id = ?`, [advanceId]);
  await audit({ userId: actor.id, action: 'DELETE', entity: 'employee_advance', entityId: advanceId, before: row });
  revalidatePath(`/app/employees/${row.employee_id}`);
  return { ok: true, message: 'Advance removed. The petty-cash entry it created is untouched — delete that separately if it was also a mistake.' };
}
