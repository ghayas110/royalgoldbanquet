'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, SectionTitle, Button, Badge, EmptyState, Modal } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
import { deleteCateringTemplate, setCateringTemplateActive } from '@/lib/actions/catering';
import type { CateringTemplateRow } from '@/lib/types';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, LayoutTemplate, ArrowRight } from 'lucide-react';

export function TemplatesClient({ templates, canManage }: { templates: CateringTemplateRow[]; canManage: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<CateringTemplateRow | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setNotice(res.ok ? (res.message ?? 'Done.') : (res.error ?? 'Failed.'));
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Catering"
        sub="Saved sets of lines. Start a quotation from one instead of retyping the menu."
        right={canManage ? <Link href="/catering/templates/new"><Button><Plus className="mr-1.5 h-4 w-4" /> New template</Button></Link> : undefined}
      >
        Templates
      </SectionTitle>

      {notice && <Card className="border-positive/30 bg-positive/10 p-3 text-sm text-positive">{notice}</Card>}

      {templates.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<LayoutTemplate className="h-8 w-8" />}
            title="No templates yet"
            sub="Build one here, or open any quotation and choose Save as template."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className={`flex flex-col p-5 ${t.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-[rgb(var(--text))]">{t.name}</h3>
                  {t.description && <p className="mt-0.5 text-sm text-[rgb(var(--text-muted))]">{t.description}</p>}
                </div>
                {!t.isActive && <Badge tone="muted">Archived</Badge>}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[rgb(var(--text-dim))]">
                <span><span className="tnum text-[rgb(var(--text))]">{t.lineCount ?? 0}</span> lines</span>
                {t.persons > 0 && <span><span className="tnum text-[rgb(var(--text))]">{t.persons}</span> persons</span>}
                <span className="tnum text-[rgb(var(--text))]">{fmtMoney(t.value ?? 0)}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border)/0.4)] pt-3">
                {t.isActive && (
                  <Link href={`/catering/quotations/new?template=${t.id}`} className="flex-1">
                    <Button className="w-full">Use template <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                  </Link>
                )}
                {canManage && (
                  <>
                    <Link href={`/catering/templates/${t.id}/edit`}>
                      <Button variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="ghost" disabled={pending} title={t.isActive ? 'Archive' : 'Restore'}
                      onClick={() => act(() => setCateringTemplateActive(t.id, !t.isActive))}>
                      {t.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" title="Delete" onClick={() => setConfirm(t)}>
                      <Trash2 className="h-4 w-4 text-negative" />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Delete template">
        <div className="space-y-4">
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Delete <span className="text-[rgb(var(--text))]">{confirm?.name}</span>? Quotations already made from it are
            unaffected: they took a copy of the lines and do not point back here.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() => { const t = confirm!; setConfirm(null); act(() => deleteCateringTemplate(t.id)); }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
