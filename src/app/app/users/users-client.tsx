'use client';

import { useState, useMemo, useTransition } from 'react';
import { Card, SectionTitle, Button, Badge, Field, Input, Select, Modal, Toggle, FadeUp, TableScroll } from '@/components/ui';
import { ALL_PERMISSIONS, ALL_ROLES, ROLE_DEFAULTS, ROLE_META, type Permission, type Role } from '@/lib/types';
import { PERMISSION_META } from '@/lib/permissions';
import { createUser, updateUser, setUserActive, resetPassword } from '@/lib/actions/users';
import { UserPlus, Shield, Check, Pencil, KeyRound, BadgeCheck } from 'lucide-react';
import { fmtMoney } from '@/lib/format';

type UserVM = {
  id: number; name: string; email: string; role: Role;
  is_active: boolean; permissions: Permission[]; hasOverride: boolean;
  /** Set when this login is also on the payroll — see the Staff column. */
  employeeId: number | null; employeeName: string | null;
  designation: string | null; monthlySalary: number | null;
};

export type StaffOption = {
  id: number; name: string; designation: string; salary: number;
  /** Name of the user already using this record, if any. */
  linkedTo: string | null;
};

const ROLE_TONE: Record<Role, 'gold' | 'green' | 'amber' | 'muted'> = {
  SUPER_ADMIN: 'gold', OWNER: 'gold', MANAGER: 'green', ACCOUNTANT: 'amber',
  SUPERVISOR: 'green', RECEPTIONIST: 'muted', VIEWER: 'muted', CATERING: 'amber',
};

/** The "on the payroll" marker, shared by the mobile cards and the table. */
function StaffTag({ u }: { u: UserVM }) {
  if (!u.employeeId) {
    return <span className="text-xs text-[rgb(var(--text-dim))]">Login only</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-positive" title={`Appears in Attendance and on the salary sheet as ${u.designation || 'Staff'}`}>
      <BadgeCheck className="h-3.5 w-3.5" />
      {u.designation || 'Staff'}
      {u.monthlySalary ? <span className="text-[rgb(var(--text-dim))]">· {fmtMoney(u.monthlySalary)}</span> : null}
    </span>
  );
}

export function UsersClient({ users, staffOptions }: { users: UserVM[]; staffOptions: StaffOption[] }) {
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; user: UserVM }>(null);
  const [msg, setMsg] = useState('');

  return (
    <div className="space-y-6">
      <FadeUp>
        <SectionTitle
          sub="Create accounts and grant granular access per user"
          right={<Button onClick={() => setModal({ mode: 'create' })}><UserPlus className="h-4 w-4" /> New user</Button>}
        >
          Users & Access
        </SectionTitle>
      </FadeUp>

      {msg && <div className="rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">{msg}</div>}

      {/* Mobile: stacked cards. The table hides ~420px of itself on a phone,
          which put Role/Status and the Edit + enable/disable actions entirely
          off-screen. */}
      <FadeUp delay={0.05} className="space-y-3 md:hidden">
        {users.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-ink ring-1 ring-inset ring-white/15">{u.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[rgb(var(--text))]">{u.name}</div>
                <div className="truncate text-xs text-[rgb(var(--text-muted))]">{u.email}</div>
              </div>
              <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border)/0.4)] pt-3">
              <Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>
              <span className="text-xs text-[rgb(var(--text-dim))]">{u.permissions.length} perms</span>
              {u.hasOverride && <Badge tone="amber">custom</Badge>}
              <span className="w-full"><StaffTag u={u} /></span>

              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setModal({ mode: 'edit', user: u })} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-gold">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <ToggleActive user={u} labelled />
              </div>
            </div>
          </Card>
        ))}
      </FadeUp>

      <FadeUp delay={0.05} className="hidden md:block">
        <Card className="overflow-hidden">
          <TableScroll>
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Access</th>
                  <th className="px-5 py-3 font-medium">Staff record</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[rgb(var(--border)/0.25)] last:border-0 hover:bg-[rgb(var(--surface-2)/0.5)]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-xs font-semibold text-ink ring-1 ring-inset ring-white/15">{u.name.slice(0, 1)}</span>
                        <span className="text-[rgb(var(--text))]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[rgb(var(--text-muted))]">{u.email}</td>
                    <td className="px-5 py-3.5"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                    <td className="px-5 py-3.5 text-[rgb(var(--text-muted))]">
                      {u.permissions.length} perms {u.hasOverride && <Badge tone="amber" className="ml-1">custom</Badge>}
                    </td>
                    <td className="px-5 py-3.5"><StaffTag u={u} /></td>
                    <td className="px-5 py-3.5">
                      <Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal({ mode: 'edit', user: u })} className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-gold" title="Edit"><Pencil className="h-4 w-4" /></button>
                        <ToggleActive user={u} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      </FadeUp>

      {modal && (
        <UserModal
          key={modal.mode === 'edit' ? modal.user.id : 'create'}
          initial={modal.mode === 'edit' ? modal.user : null}
          staffOptions={staffOptions}
          onClose={() => setModal(null)}
          onDone={(m) => { setModal(null); setMsg(m); setTimeout(() => setMsg(''), 3500); }}
        />
      )}
    </div>
  );
}

/** `labelled` shows the action text — icon-only is too ambiguous on mobile. */
function ToggleActive({ user, labelled }: { user: UserVM; labelled?: boolean }) {
  const [pending, start] = useTransition();
  const action = user.is_active ? 'Disable' : 'Enable';
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await setUserActive(user.id, !user.is_active); })}
      className={
        labelled
          ? 'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] disabled:opacity-50'
          : 'rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] disabled:opacity-50'
      }
      title={action}
      aria-label={`${action} ${user.name}`}
    >
      <Shield className="h-3.5 w-3.5" />
      {labelled && action}
    </button>
  );
}

function UserModal({ initial, staffOptions, onClose, onDone }: { initial: UserVM | null; staffOptions: StaffOption[]; onClose: () => void; onDone: (msg: string) => void }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(initial?.role ?? 'MANAGER');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(initial?.permissions ?? ROLE_DEFAULTS['MANAGER']));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  // ── Staff record ──
  // Existing link opens on "link"; a fresh user defaults to "none" so nobody
  // accidentally lands on the payroll.
  const [staffMode, setStaffMode] = useState<'none' | 'link' | 'create'>(initial?.employeeId ? 'link' : 'none');
  const [staffId, setStaffId] = useState<number | null>(initial?.employeeId ?? null);
  const [designation, setDesignation] = useState(initial?.designation ?? '');
  const [salary, setSalary] = useState<string>(initial?.monthlySalary != null ? String(initial.monthlySalary) : '');

  /** Records free to claim: unlinked, or the one this user already holds. */
  const availableStaff = useMemo(
    () => staffOptions.filter((s) => !s.linkedTo || s.id === initial?.employeeId),
    [staffOptions, initial?.employeeId],
  );

  const groups = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    for (const p of ALL_PERMISSIONS) {
      const grp = PERMISSION_META[p].group;
      (g[grp] ??= []).push(p);
    }
    return g;
  }, []);

  function applyRoleDefaults(r: Role) {
    setRole(r);
    setPerms(new Set(ROLE_DEFAULTS[r]));
  }
  function toggle(p: Permission) {
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function submit() {
    setError('');
    const staff = {
      mode: staffMode,
      employeeId: staffMode === 'link' ? staffId : null,
      designation: designation || undefined,
      monthlySalary: salary === '' ? undefined : Number(salary),
    };
    start(async () => {
      const permissions = [...perms];
      const res = isEdit
        ? await updateUser({ id: initial!.id, name, role, permissions, staff })
        : await createUser({ name, email, password, role, permissions, staff });
      if (res.ok) onDone(res.message ?? 'Saved.');
      else setError(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${initial!.name}` : 'Create user'} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ali Finance" /></Field>
          <Field label="Email"><Input type="email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)} placeholder="name@skylightballroom.pk" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && <Field label="Password" hint="Min 6 characters"><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" /></Field>}
          <Field label="Role" hint="Selecting a role presets its default access">
            <Select value={role} onChange={(e) => applyRoleDefaults(e.target.value as Role)}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].hint}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* ── Staff record ──
            Links this login to a row in `employees`, which is what Attendance
            and the salary sheet read from. */}
        <div className="rounded-xl border border-[rgb(var(--border)/0.5)] p-4">
          <div className="text-sm font-medium text-[rgb(var(--text-muted))]">Staff record</div>
          <p className="mt-0.5 text-xs text-[rgb(var(--text-dim))]">
            Link this person to the payroll so they appear in Attendance and on the printed salary sheet.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              { k: 'none', label: 'Login only' },
              { k: 'link', label: 'Existing staff member' },
              { k: 'create', label: 'Create new staff record' },
            ] as const).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setStaffMode(opt.k)}
                className={[
                  'rounded-full border px-3.5 py-1.5 text-sm transition',
                  staffMode === opt.k
                    ? 'border-gold bg-[rgb(var(--gold)/0.15)] text-gold'
                    : 'border-[rgb(var(--border)/0.6)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {staffMode === 'link' && (
            <div className="mt-3">
              {availableStaff.length === 0 ? (
                <p className="text-sm text-[rgb(var(--text-dim))]">
                  Every staff record is already linked to a user. Choose <b>Create new staff record</b> instead.
                </p>
              ) : (
                <Field label="Staff member">
                  <Select value={staffId ?? ''} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select a staff member…</option>
                    {availableStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.designation ? ` — ${s.designation}` : ''}{s.salary ? ` (${fmtMoney(s.salary)})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          )}

          {staffMode === 'create' && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Designation"><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Manager" /></Field>
              <Field label="Monthly salary"><Input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0" /></Field>
            </div>
          )}

          {staffMode === 'none' && initial?.employeeId && (
            <p className="mt-3 text-xs text-amber-500">
              Saving will unlink {initial.employeeName ?? 'the staff record'}. The record itself, its attendance
              and its salary history are kept.
            </p>
          )}
        </div>

        <div>
          {/* Stacks on a phone — side by side, the three links wrapped
              mid-word ("Select / all", "Reset to / role"). */}
          <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-[rgb(var(--text-muted))]">Access permissions</span>
            <div className="flex flex-wrap gap-3 text-xs [&_button]:whitespace-nowrap">
              <button onClick={() => setPerms(new Set(ALL_PERMISSIONS))} className="text-gold hover:underline">Select all</button>
              <button onClick={() => setPerms(new Set())} className="text-[rgb(var(--text-dim))] hover:underline">Clear</button>
              <button onClick={() => setPerms(new Set(ROLE_DEFAULTS[role]))} className="text-[rgb(var(--text-dim))] hover:underline">Reset to role</button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 max-h-[38vh] overflow-y-auto pr-1">
            {Object.entries(groups).map(([grp, list]) => (
              <div key={grp} className="rounded-xl border border-[rgb(var(--border)/0.5)] p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold/80">{grp}</div>
                <div className="space-y-2">
                  {list.map((p) => (
                    <label key={p} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <span onClick={() => toggle(p)} className={`flex h-[18px] w-[18px] items-center justify-center rounded border transition-colors ${perms.has(p) ? 'border-gold bg-gold text-ink' : 'border-[rgb(var(--border))]'}`}>
                        {perms.has(p) && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="text-[rgb(var(--text-muted))]" onClick={() => toggle(p)}>{PERMISSION_META[p].label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

        <div className="flex items-center justify-between gap-3 pt-1">
          {isEdit ? <ResetPasswordInline userId={initial!.id} onDone={onDone} /> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordInline({ userId, onDone }: { userId: number; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pending, start] = useTransition();
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-dim))] hover:text-gold"><KeyRound className="h-3.5 w-3.5" /> Reset password</button>;
  return (
    <div className="flex items-center gap-2">
      <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="w-40 py-1.5" />
      <Button variant="outline" className="py-1.5 text-xs" disabled={pending} onClick={() => start(async () => { const r = await resetPassword(userId, pw); if (r.ok) { onDone('Password reset.'); } })}>Set</Button>
    </div>
  );
}
