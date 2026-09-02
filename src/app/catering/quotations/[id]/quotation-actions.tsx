'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Field, Input, Select, Modal } from '@/components/ui';
import { InvoiceShareButton } from '@/components/invoice-share';
import { WhatsAppMessageCard } from '@/components/whatsapp-message';
import { cateringQuotationText } from '@/lib/whatsapp';
import { fmtMoney, fmtDate } from '@/lib/format';
import {
  recordCateringPayment, deleteCateringPayment,
  setCateringQuotationStatus, deleteCateringQuotation,
} from '@/lib/actions/catering';
import { CATERING_STATUS_META, type CateringPaymentRow, type CateringStatus } from '@/lib/types';
import { Wallet, Trash2 } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);

export function QuotationActions({
  quotationId, quotaNo, customerName, phone, status, balance, payments, canManage,
  message, profileName,
}: {
  quotationId: number;
  quotaNo: string;
  customerName: string;
  phone: string;
  status: CateringStatus;
  balance: number;
  payments: CateringPaymentRow[];
  canManage: boolean;
  /** Prefilled quotation text, built on the server from the same figures as the slip. */
  message: string;
  profileName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  // Money can only be taken against a live quotation, matching the action.
  const billable = status === 'CONFIRMED' || status === 'COMPLETED';

  function openPay() {
    setAmount(String(Math.max(0, balance)));
    setDate(todayISO()); setMethod('CASH'); setNote(''); setErr(''); setPayOpen(true);
  }

  function submitPay() {
    setErr('');
    start(async () => {
      const res = await recordCateringPayment(quotationId, {
        amount: Number(amount) || 0, paymentDate: date, method, note: note || null,
      });
      if (res.ok) { setPayOpen(false); setMsg(res.message ?? 'Recorded.'); router.refresh(); }
      else setErr(res.error);
    });
  }

  return (
    <>
      <WhatsAppMessageCard
        title="Send quotation on WhatsApp"
        subtitle={<>Opens WhatsApp with the quotation ready to send.{phone ? <span className="ml-1 text-[rgb(var(--text-dim))]">To {phone}.</span> : null}</>}
        template={message}
        phone={phone || null}
        noPhoneLabel="No phone number on this quotation"
        extra={
          <div className="flex flex-wrap items-center gap-3">
            <InvoiceShareButton
              bookingId={quotationId}
              slipNo={quotaNo}
              partyName={customerName}
              phone={phone || null}
              docLabel="Quotation"
              printPath={`/print/catering/${quotationId}`}
            />
            <span className="text-xs text-[rgb(var(--text-dim))]">
              Attaches the printable quotation as a real PDF.
            </span>
          </div>
        }
      />

      <Card className="p-5">
        <div className="mb-3 font-display text-lg text-[rgb(var(--text))]">Status &amp; payments</div>

        <div className="space-y-3">
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border)/0.5)] pt-3">
              <Select
                value={status}
                onChange={(e) => start(async () => {
                  const res = await setCateringQuotationStatus(quotationId, e.target.value as CateringStatus);
                  setMsg(res.ok ? (res.message ?? 'Updated.') : res.error);
                  router.refresh();
                })}
                disabled={pending}
                className="!py-1.5 text-xs"
              >
                {(Object.keys(CATERING_STATUS_META) as CateringStatus[]).map((s) => (
                  <option key={s} value={s}>{CATERING_STATUS_META[s].label}</option>
                ))}
              </Select>
              {billable && balance > 0 && (
                <Button variant="ghost" onClick={openPay} disabled={pending}>
                  <Wallet className="mr-1.5 h-4 w-4" /> Record payment
                </Button>
              )}
              <button
                onClick={() => {
                  if (!confirm(`Delete ${quotaNo}? Its lines and receipts go with it.`)) return;
                  start(async () => {
                    const res = await deleteCateringQuotation(quotationId);
                    if (res.ok) router.push('/catering/quotations'); else setMsg(res.error);
                  });
                }}
                disabled={pending}
                className="ml-auto rounded-lg p-2 text-[rgb(var(--text-dim))] hover:text-negative"
                title="Delete quotation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          {msg && <div className="text-xs text-[rgb(var(--text-muted))]">{msg}</div>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 font-display text-lg text-[rgb(var(--text))]">Payments</div>
        {payments.length === 0 ? (
          <div className="text-sm text-[rgb(var(--text-dim))]">Nothing received yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b border-[rgb(var(--border)/0.3)] pb-2 last:border-0">
                <div>
                  <div className="tnum text-positive">{fmtMoney(p.amount)}</div>
                  <div className="text-xs text-[rgb(var(--text-dim))]">{fmtDate(p.paymentDate)} · {p.method}{p.note ? ` · ${p.note}` : ''}</div>
                </div>
                {canManage && (
                  <button
                    onClick={() => start(async () => {
                      const res = await deleteCateringPayment(p.id);
                      setMsg(res.ok ? (res.message ?? 'Removed.') : res.error);
                      router.refresh();
                    })}
                    disabled={pending}
                    className="rounded-lg p-1.5 text-[rgb(var(--text-dim))] hover:text-negative"
                    title="Remove payment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Payment — ${quotaNo}`}>
        <div className="space-y-4">
          {err && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{err}</div>}
          <div className="rounded-xl bg-[rgb(var(--surface-2))] px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-[rgb(var(--text-dim))]">Outstanding</span><span className="tnum text-negative">{fmtMoney(balance)}</span></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount"><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option><option value="BANK">Bank transfer</option>
              <option value="CHEQUE">Cheque</option><option value="CARD">Card</option>
            </Select>
          </Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPayOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submitPay} disabled={pending}>{pending ? 'Saving…' : 'Record payment'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
