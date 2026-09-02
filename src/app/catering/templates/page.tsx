import { requirePermission } from '@/lib/session';
import { getCateringTemplates } from '@/lib/catering';
import { TemplatesClient } from './templates-client';

export const metadata = { title: 'Templates — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringTemplatesPage() {
  const user = await requirePermission('catering.view');
  const templates = await getCateringTemplates(false);
  return (
    <TemplatesClient
      templates={templates}
      canManage={user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN'}
    />
  );
}
