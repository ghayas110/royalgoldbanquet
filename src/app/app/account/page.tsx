import { requireUser } from '@/lib/session';
import { query } from '@/lib/db';
import { resolvePermissions, PERMISSION_META } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Card, SectionTitle, Badge, FadeUp } from '@/components/ui';
import { Mail, Shield, Clock, User as UserIcon } from 'lucide-react';

export const metadata = { title: 'My Account — Royal Gold Banquet' };

export default async function AccountPage() {
  const user = await requireUser();
  const perms = resolvePermissions(user.role, null); // display role defaults; overrides not needed here
  const effective = user.permissions.length ? user.permissions : perms;

  const activity = await query<any>(
    `SELECT action, entity, entity_id, created_at FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 12`,
    [user.id],
  );

  // group permissions
  const groups: Record<string, string[]> = {};
  for (const p of effective) {
    const meta = PERMISSION_META[p as keyof typeof PERMISSION_META];
    if (!meta) continue;
    (groups[meta.group] ??= []).push(meta.label);
  }

  return (
    <div className="space-y-6">
      <FadeUp><SectionTitle sub="Your profile & access">My Account</SectionTitle></FadeUp>

      <FadeUp delay={0.03}>
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold text-2xl font-semibold text-ink ring-1 ring-inset ring-white/15">{(user.name ?? 'U').slice(0, 1)}</div>
            <div>
              <h1 className="font-display text-2xl text-[rgb(var(--text))]">{user.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[rgb(var(--text-dim))]">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
                <Badge tone={user.role === 'OWNER' ? 'gold' : user.role === 'MANAGER' ? 'green' : 'muted'}><Shield className="mr-1 h-3 w-3" /> {user.role}</Badge>
              </div>
            </div>
          </div>
        </Card>
      </FadeUp>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeUp delay={0.05}>
          <Card className="p-5">
            <SectionTitle sub={`${effective.length} permissions granted`}>Access</SectionTitle>
            <div className="space-y-3">
              {Object.entries(groups).map(([g, list]) => (
                <div key={g}>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gold/80">{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((l) => <span key={l} className="rounded-lg bg-[rgb(var(--surface-2))] px-2 py-1 text-xs text-[rgb(var(--text-muted))]">{l}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </FadeUp>

        <FadeUp delay={0.08}>
          <Card className="p-5">
            <SectionTitle sub="Your latest actions">Recent activity</SectionTitle>
            {activity.length === 0 ? (
              <div className="py-6 text-center text-sm text-[rgb(var(--text-dim))]">No recorded activity yet.</div>
            ) : (
              <ul className="space-y-2">
                {activity.map((a: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-2 border-b border-[rgb(var(--border)/0.25)] pb-2 text-sm last:border-0">
                    <span className="text-[rgb(var(--text-muted))]"><span className="text-gold">{a.action}</span> · {a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</span>
                    <span className="flex items-center gap-1 text-xs text-[rgb(var(--text-dim))]"><Clock className="h-3 w-3" /> {fmtDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </FadeUp>
      </div>
    </div>
  );
}
