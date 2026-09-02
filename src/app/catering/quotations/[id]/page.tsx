import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { notFound } from 'next/navigation';
import { getCateringQuotation, getCateringPayments, getCateringProfile } from '@/lib/catering';
import { cateringQuotationText } from '@/lib/whatsapp';
import { fmtMoney, fmtDate } from '@/lib/format';
import { Card, SectionTitle, Button, Badge, TableScroll, FadeUp } from '@/components/ui';
import { CATERING_DOC_META, CATERING_STATUS_META } from '@/lib/types';
import { QuotationActions } from './quotation-actions';
import { ArrowLeft, Printer, Pencil } from 'lucide-react';
import { RaiseInvoice } from '../raise-invoice';
import { SaveAsTemplate } from '../save-as-template';

export const metadata = { title: 'Quotation — Catering' };
export const dynamic = 'force-dynamic';

export default async function CateringQuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('catering.view');
  const { id } = await params;
  const q = await getCateringQuotation(Number(id));
  if (!q) notFound();
  const [payments, profile] = await Promise.all([getCateringPayments(q.id), getCateringProfile()]);
  // Built here, from the same figures the slip prints, so the message and the
  // PDF can never tell different stories.
  const message = cateringQuotationText(
    {
      quotaNo: q.quotaNo, customerName: q.customerName, placeOfFunction: q.placeOfFunction,
      deliveryDate: q.deliveryDate, persons: q.persons,
      itemsTotal: q.itemsTotal, meatTotal: q.meatTotal,
      grandTotal: q.grandTotal, paidAmount: q.paidAmount,
    },
    { name: profile.name, person: profile.person, phone: profile.phone, address: profile.address, terms: profile.terms },
  );
  const canManage = user.permissions.includes('catering.manage') || user.role === 'SUPER_ADMIN';

  const dishes = (q.lines ?? []).filter((l) => l.section === 'DISH');
  const charges = (q.lines ?? []).filter((l) => l.section === 'CHARGE');
  const meat = (q.lines ?? []).filter((l) => l.section === 'MEAT');

  const band = (title: string, rows: typeof dishes, showCols: boolean) => rows.length > 0 && (
    <>
      <tr><td colSpan={5} className="pt-4 pb-1 text-xs uppercase tracking-wider text-gold">{title}</td></tr>
      {rows.map((l) => (
        <tr key={l.id} className="border-b border-[rgb(var(--border)/0.3)]">
          <td className="py-2 pr-3 text-[rgb(var(--text))]">{l.description}</td>
          <td className="py-2 pr-3 text-[rgb(var(--text-dim))]">{showCols ? l.category : ''}</td>
          <td className="py-2 pr-3 text-right tnum text-[rgb(var(--text-muted))]">{showCols && l.qty ? `${l.qty} ${l.unit}` : ''}</td>
          <td className="py-2 pr-3 text-right tnum text-[rgb(var(--text-dim))]">{showCols && l.rate ? fmtMoney(l.rate, false) : ''}</td>
          <td className="py-2 text-right tnum text-[rgb(var(--text))]">{fmtMoney(l.amount, false)}</td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <FadeUp className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={q.docType === 'INVOICE' ? '/catering/invoices' : '/catering/quotations'}
          className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> {q.docType === 'INVOICE' ? 'All invoices' : 'All quotations'}
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone={q.docType === 'INVOICE' ? 'green' : 'gold'}>{CATERING_DOC_META[q.docType].label}</Badge>
          <Badge tone={CATERING_STATUS_META[q.status].tone}>{CATERING_STATUS_META[q.status].label}</Badge>
        </div>
      </FadeUp>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="tnum text-sm text-gold">{q.quotaNo}</div>
            <h1 className="mt-1 font-display text-2xl text-[rgb(var(--text))]">{q.customerName || '—'}</h1>
            <div className="mt-1 text-sm text-[rgb(var(--text-dim))]">{q.contactNo || 'No phone'}{q.placeOfFunction ? ` · ${q.placeOfFunction}` : ''}</div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/print/catering/${q.id}`} className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--gold)/0.4)] px-4 py-2.5 text-sm hover:bg-[rgb(var(--gold)/0.1)]">
              <Printer className="h-4 w-4" /> Print slip
            </Link>
            {canManage && (
              <Link href={`/catering/quotations/${q.id}/edit`}>
                <Button variant="ghost"><Pencil className="mr-1.5 h-4 w-4" /> Edit</Button>
              </Link>
            )}
            {/* Only a quotation can be billed, and only once. */}
            {canManage && q.docType === 'QUOTATION' && <RaiseInvoice quotationId={q.id} />}
            {canManage && (
              <SaveAsTemplate
                quotationId={q.id}
                suggestedName={q.persons ? `${q.customerName || 'Package'} — ${q.persons}` : (q.customerName || 'Package')}
              />
            )}
            <Link href={`/catering/ledger/${q.sourceQuotationId ?? q.id}`}>
              <Button variant="ghost">Event ledger</Button>
            </Link>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[['Quotation date', fmtDate(q.quotationDate)], ['Event date', q.deliveryDate ? fmtDate(q.deliveryDate) : '—'],
            ['Persons', q.persons ? String(q.persons) : '—'], ['Created by', q.createdByName ?? '—']].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-dim))]">{k}</div>
              <div className="mt-0.5 text-sm text-[rgb(var(--text))]">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-2 font-display text-lg text-[rgb(var(--text))]">Items</div>
          <TableScroll>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.6)] text-left text-xs uppercase tracking-wider text-[rgb(var(--text-dim))]">
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 pr-3 text-right font-medium">Rate</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {band('Dishes', dishes, true)}
                {band('Charges', charges, false)}
                {band('Meat supplied', meat, true)}
              </tbody>
            </table>
          </TableScroll>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 font-display text-lg text-gold">Account</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Dishes &amp; charges</span><span className="tnum">{fmtMoney(q.itemsTotal)}</span></div>
              <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Meat supplied</span><span className="tnum">{fmtMoney(q.meatTotal)}</span></div>
              <div className="flex justify-between border-t border-[rgb(var(--border)/0.5)] pt-1.5 font-medium"><span>Grand total</span><span className="tnum">{fmtMoney(q.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Received</span><span className="tnum text-positive">{fmtMoney(q.paidAmount)}</span></div>
              <div className="flex justify-between border-t border-[rgb(var(--border)/0.5)] pt-1.5 font-medium">
                <span className="text-gold">Balance</span>
                <span className={`tnum ${q.balance > 0 ? 'text-negative' : 'text-positive'}`}>{fmtMoney(q.balance)}</span>
              </div>
            </div>
          </Card>

          <QuotationActions
            quotationId={q.id}
            quotaNo={q.quotaNo}
            customerName={q.customerName}
            phone={q.contactNo}
            status={q.status}
            balance={q.balance}
            payments={payments}
            canManage={canManage}
            message={message}
            profileName={profile.name}
          />
        </div>
      </div>
    </div>
  );
}
