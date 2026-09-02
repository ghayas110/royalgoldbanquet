import { requirePermission } from '@/lib/session';
import { getCateringRules } from '@/lib/catering';
import { RulesClient } from './rules-client';

export const metadata = { title: 'Rules — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringRulesPage() {
  const user = await requirePermission('catering.view');
  const rules = await getCateringRules(false);
  return (
    <RulesClient
      rules={rules}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
