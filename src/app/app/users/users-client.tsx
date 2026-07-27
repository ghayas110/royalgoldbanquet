'use client';

import { useState, useMemo, useTransition } from 'react';
import { Card, SectionTitle, Button, Badge, Field, Input, Select, Modal, Toggle, FadeUp } from '@/components/ui';
import { ALL_PERMISSIONS, ROLE_DEFAULTS, type Permission, type Role } from '@/lib/types';
import { PERMISSION_META } from '@/lib/permissions';
import { createUser, updateUser, setUserActive, resetPassword } from '@/lib/actions/users';
import { UserPlus, Shield, Check, Pencil, KeyRound } from 'lucide-react';

type UserVM = {
  id: number; name: string; email: string; role: Role;
  is_active: boolean; permissions: Permission[]; hasOverride: boolean;
};

const ROLE_TONE: Record<Role, 'gold' | 'green' | 'muted'> = { OWNER: 'gold', MANAGER: 'green', VIEWER: 'muted' };

export function UsersClient({ users }: { users: UserVM[] }) {
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

      <FadeUp delay={0.05}>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.5)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Access</th>
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
          </div>
        </Card>
      </FadeUp>

      {modal && (
        <UserModal
          key={modal.mode === 'edit' ? modal.user.id : 'create'}
          initial={modal.mode === 'edit' ? modal.user : null}
          onClose={() => setModal(null)}
          onDone={(m) => { setModal(null); setMsg(m); setTimeout(() => setMsg(''), 3500); }}
        />
      )}
    </div>
  );
}

function ToggleActive({ user }: { user: UserVM }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await setUserActive(user.id, !user.is_active); })}
      className="rounded-lg p-2 text-[rgb(var(--text-dim))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] disabled:opacity-50"
      title={user.is_active ? 'Deactivate' : 'Activate'}
    >
      <Shield className="h-4 w-4" />
    </button>
  );
}

function UserModal({ initial, onClose, onDone }: { initial: UserVM | null; onClose: () => void; onDone: (msg: string) => void }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(initial?.role ?? 'MANAGER');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(initial?.permissions ?? ROLE_DEFAULTS['MANAGER']));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

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
    start(async () => {
      const permissions = [...perms];
      const res = isEdit
        ? await updateUser({ id: initial!.id, name, role, permissions })
        : await createUser({ name, email, password, role, permissions });
      if (res.ok) onDone(res.message ?? 'Saved.');
      else setError(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${initial!.name}` : 'Create user'} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ali Finance" /></Field>
          <Field label="Email"><Input type="email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)} placeholder="name@royalgold.pk" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && <Field label="Password" hint="Min 6 characters"><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" /></Field>}
          <Field label="Role" hint="Selecting a role presets its default access">
            <Select value={role} onChange={(e) => applyRoleDefaults(e.target.value as Role)}>
              <option value="OWNER">Owner — full access</option>
              <option value="MANAGER">Manager — operations</option>
              <option value="VIEWER">Viewer — read only</option>
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[rgb(var(--text-muted))]">Access permissions</span>
            <div className="flex gap-3 text-xs">
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
