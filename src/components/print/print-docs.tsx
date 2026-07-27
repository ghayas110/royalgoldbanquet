import { fmtMoney, fmtDate, parseDate, monthLabelFull } from '@/lib/format';
import { BRAND } from '@/lib/brand-info';

// ── Shared bits ────────────────────────────────────────
function Flourish({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 240 24" width="150" height="15" className="rgb-flourish" style={{ display: 'block', margin: '0 auto', transform: flip ? 'rotate(180deg)' : undefined }} fill="none" aria-hidden>
      <path d="M120 4 l7 8 -7 8 -7 -8 z" fill="currentColor" />
      <rect x="62" y="11.1" width="44" height="1.8" rx="0.9" fill="currentColor" />
      <rect x="134" y="11.1" width="44" height="1.8" rx="0.9" fill="currentColor" />
      <path d="M106 12 c-6 -3.4 -12 -3.4 -18 0 c6 3.4 12 3.4 18 0 z" fill="currentColor" opacity="0.85" />
      <path d="M134 12 c6 -3.4 12 -3.4 18 0 c-6 3.4 -12 3.4 -18 0 z" fill="currentColor" opacity="0.85" />
      <path d="M62 12 c-8 0 -12 -6 -20 -6 c-6 0 -10 4 -10 8 c0 3 2 5 5 5 c4 0 5 -4 2 -6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M178 12 c8 0 12 -6 20 -6 c6 0 10 4 10 8 c0 3 -2 5 -5 5 c-4 0 -5 -4 -2 -6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LogoBand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const word = size === 'lg' ? '40px' : '32px';
  const sub = size === 'lg' ? '17px' : '14px';
  return (
    <div className="rgb-band">
      <Flourish />
      <div className="rgb-logo-word rgb-logo-gold" style={{ fontSize: word, lineHeight: 1, marginTop: '4px' }}>
        Royal<span style={{ marginLeft: '0.05em' }}>Gold</span>
      </div>
      <div className="rgb-logo-sub" style={{ fontSize: sub, marginTop: '3px' }}>Banquet</div>
      <div style={{ marginTop: '4px' }}><Flourish flip /></div>
    </div>
  );
}

function FooterBand() {
  return (
    <div className="rgb-band-footer">
      <span>fb / {BRAND.facebook}</span>
      <span>☎ {BRAND.phone}</span>
      <span>📍 {BRAND.address}</span>
    </div>
  );
}

function Contact() {
  return (
    <div className="rgb-contact">
      {BRAND.address}<br />
      Ph: {BRAND.phone} &nbsp;·&nbsp; fb/{BRAND.facebook}
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekday(s: string) { const d = parseDate(s); return isNaN(d.getTime()) ? '—' : WEEKDAYS[d.getDay()]; }

// ── Invoice ────────────────────────────────────────────
export interface InvoiceData {
  slip_no: string; party_name: string; bride_name: string | null; groom_name: string | null;
  phone: string | null; hall: string; event_date: string; booking_date: string; shift: string;
  guest_count: number; balance_amount: number; banquet_amount: number; total_amount: number; paid_amount: number;
  items: { label: string; qty: number; rate: number; subtotal: number }[];
  payments: { amount: number; payment_date: string; method: string; note: string | null }[];
}

export function InvoiceDoc({ b }: { b: InvoiceData }) {
  const due = b.total_amount - b.paid_amount;
  const badge = due <= 0 ? { c: 'rgb-badge-paid', t: 'Paid' } : b.paid_amount > 0 ? { c: 'rgb-badge-partial', t: 'Partially Paid' } : { c: 'rgb-badge-due', t: 'Outstanding' };

  return (
    <div className="rgb-sheet rgb-onepage">
      <LogoBand />
      <div className="rgb-body">
        <div className="rgb-meta">
          <Contact />
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">Booking Invoice</div>
            <div className="rgb-slipno">Slip # {b.slip_no}</div>
            <div style={{ marginTop: '6px' }}><span className={`rgb-badge ${badge.c}`}>{badge.t}</span></div>
          </div>
        </div>

        {/* Client & event details */}
        <table className="rgb-kv"><tbody>
          <tr><td className="k">Party Name</td><td>{b.party_name}</td><td className="k">Event Date</td><td>{fmtDate(b.event_date)}</td></tr>
          <tr><td className="k">Bride &amp; Groom</td><td>{[b.bride_name, b.groom_name].filter(Boolean).join(' & ') || '—'}</td><td className="k">Function Day</td><td>{weekday(b.event_date)}</td></tr>
          <tr><td className="k">Phone</td><td>{b.phone ?? '—'}</td><td className="k">Shift</td><td>{b.shift}</td></tr>
          <tr><td className="k">Booking Date</td><td>{fmtDate(b.booking_date)}</td><td className="k">Hall / Lawn</td><td>{b.hall}</td></tr>
          <tr><td className="k">Guests</td><td>{b.guest_count}</td><td className="k">Slip No.</td><td>{b.slip_no}</td></tr>
        </tbody></table>

        {/* Services */}
        <div className="rgb-sec">Banquet Services</div>
        <table className="rgb-table">
          <thead><tr><th style={{ width: '8%' }}>S.No</th><th>Description</th><th className="r" style={{ width: '10%' }}>Qty</th><th className="r" style={{ width: '18%' }}>Rate</th><th className="r" style={{ width: '20%' }}>Amount</th></tr></thead>
          <tbody>
            {b.items.length === 0
              ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8a8574' }}>Hall booking only — no additional services.</td></tr>
              : b.items.map((it, i) => (
                <tr key={i}><td>{i + 1}</td><td>{it.label}</td><td className="r">{it.qty}</td><td className="r">{fmtMoney(it.rate, false)}</td><td className="r">{fmtMoney(it.subtotal, false)}</td></tr>
              ))}
          </tbody>
          <tfoot><tr><td colSpan={4} className="r">Banquet Amount</td><td className="r">{fmtMoney(b.banquet_amount, false)}</td></tr></tfoot>
        </table>

        {/* Payments + Account summary */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
          <div style={{ flex: 1 }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Payment History</div>
            {b.payments.length === 0
              ? <div style={{ fontSize: '10px', color: '#a49c88', padding: '4px 0' }}>No payments recorded.</div>
              : (
                <table className="rgb-table">
                  <thead><tr><th>Date</th><th>Method</th><th>Note</th><th className="r">Amount</th></tr></thead>
                  <tbody>{b.payments.map((p, i) => (
                    <tr key={i}><td>{fmtDate(p.payment_date)}</td><td>{p.method}</td><td>{p.note ?? '—'}</td><td className="r">{fmtMoney(p.amount, false)}</td></tr>
                  ))}</tbody>
                </table>
              )}
          </div>
          <div style={{ width: '42%' }}>
            <div className="rgb-sec" style={{ marginTop: 0 }}>Account Summary</div>
            <table className="rgb-sum"><tbody>
              <tr><td className="lbl">Balance (Hall) Amount</td><td className="val">{fmtMoney(b.balance_amount, false)}</td></tr>
              <tr><td className="lbl">Banquet Amount</td><td className="val">{fmtMoney(b.banquet_amount, false)}</td></tr>
              <tr className="total"><td>Total</td><td className="val">{fmtMoney(b.total_amount, false)}</td></tr>
              <tr><td className="lbl">Advance Paid</td><td className="val" style={{ color: '#2E7D32' }}>{fmtMoney(b.paid_amount, false)}</td></tr>
              <tr className="grand"><td>Balance Due</td><td className="val" style={{ color: due > 0 ? '#C62828' : '#2E7D32' }}>{fmtMoney(due, false)}</td></tr>
            </tbody></table>
          </div>
        </div>

        <div className={`rgb-banner ${due > 0 ? 'rgb-banner-due' : 'rgb-banner-paid'}`}>
          {due > 0 ? `BALANCE DUE:  ${fmtMoney(due)}` : '✓  FULLY PAID — THANK YOU'}
        </div>

        <div className="rgb-terms">
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Terms &amp; Conditions</strong><br />
          1. Advance payment is non-refundable. &nbsp; 2. Balance must be settled on or before the event date. &nbsp;
          3. Menu / service changes must be communicated 48 hours prior. &nbsp; 4. Management is not responsible for guests&apos; valuables. &nbsp;
          5. Event timings must be strictly observed.
        </div>

        <div className="rgb-signs">
          <div className="rgb-sign-line">Customer Signature</div>
          <div className="rgb-stamp">STAMP</div>
          <div className="rgb-sign-line">Authorised Signature</div>
        </div>
      </div>
      <FooterBand />
    </div>
  );
}

// ── Income Statement ───────────────────────────────────
export interface IncomeData {
  dateFrom: string; dateTo: string;
  balanceAmount: number; banquetAmount: number; advanceBookingSale: number; total: number;
  lines: { name: string; total: number; qty_note?: string | null }[];
  totalExpenses: number; showProfit: boolean;
  footer: { sale: number; expenses: number; total: number; naseemReturn: number; naseemReturn2: number; totalNetProfit: number };
}

export function IncomeDoc({ d }: { d: IncomeData }) {
  const active = d.lines.filter((l) => l.total !== 0);
  const mid = Math.ceil(active.length / 2);
  const cols = [active.slice(0, mid), active.slice(mid)];

  return (
    <div className="rgb-sheet rgb-onepage">
      <LogoBand />
      <div className="rgb-body">
        <div className="rgb-meta">
          <Contact />
          <div style={{ textAlign: 'right' }}>
            <div className="rgb-doc-title">Income Statement</div>
            <div className="rgb-slipno">{fmtDate(d.dateFrom)} — {fmtDate(d.dateTo)}</div>
          </div>
        </div>

        <div className="rgb-kpis">
          <div className="rgb-kpi"><div className="rgb-kpi-lbl">Balance Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(d.balanceAmount)}</div></div>
          <div className="rgb-kpi"><div className="rgb-kpi-lbl">Banquet Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(d.banquetAmount)}</div></div>
          <div className="rgb-kpi"><div className="rgb-kpi-lbl">Advance Booking</div><div className="rgb-kpi-val tnum2">{fmtMoney(d.advanceBookingSale)}</div></div>
          <div className="rgb-kpi rgb-kpi-gold"><div className="rgb-kpi-lbl">Total Sale</div><div className="rgb-kpi-val tnum2" style={{ color: '#8a6d15' }}>{fmtMoney(d.total)}</div></div>
        </div>

        <div className="rgb-sec">Expenses by Head</div>
        <div style={{ display: 'flex', gap: '14px' }}>
          {cols.map((col, ci) => (
            <table key={ci} className="rgb-table" style={{ flex: 1 }}>
              <tbody>
                {col.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}{l.qty_note ? <span style={{ color: '#a49c88' }}> ({l.qty_note})</span> : ''}</td>
                    <td className="r" style={{ width: '34%' }}>{fmtMoney(l.total, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        <table className="rgb-table" style={{ marginTop: '8px' }}>
          <tfoot><tr><td style={{ fontWeight: 700 }}>TOTAL EXPENSES</td><td className="r" style={{ width: '20%' }}>{fmtMoney(d.totalExpenses, false)}</td></tr></tfoot>
        </table>

        {d.showProfit && (
          <>
            <div className="rgb-sec">Summary</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <table className="rgb-sum" style={{ width: '55%' }}><tbody>
                <tr><td className="lbl">SALE</td><td className="val">{fmtMoney(d.footer.sale, false)}</td></tr>
                <tr><td className="lbl">EXPENSES</td><td className="val" style={{ color: '#C62828' }}>-{fmtMoney(d.footer.expenses, false)}</td></tr>
                <tr className="total"><td>TOTAL</td><td className="val">{fmtMoney(d.footer.total, false)}</td></tr>
                <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(float held)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(d.footer.naseemReturn, false)}</td></tr>
                <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(returned)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(d.footer.naseemReturn2, false)}</td></tr>
                <tr className="grand"><td>TOTAL NET PROFIT</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(d.footer.totalNetProfit, false)}</td></tr>
              </tbody></table>
            </div>
          </>
        )}

        <div className="rgb-signs" style={{ justifyContent: 'flex-end' }}>
          <div className="rgb-sign-line" style={{ flex: 'none', width: '200px' }}>Owner Signature</div>
        </div>
      </div>
      <FooterBand />
    </div>
  );
}


// ── Monthly Report (4 pages: cover · petty cash · income · sale) ──
export interface ReportData {
  label: string; generated: string; showProfit: boolean;
  kpis: { totalSale: number; totalExpenses: number; netProfit: number; bookings: number };
  petty: { days: number; heads: { id: number; name: string }[]; cells: Record<string, number> };
  income: IncomeData;
  saleRows: { sNo: number; date: string; party: string; slip: string; balance: number; banquet: number; total: number }[];
  saleTotals: { balance: number; banquet: number; total: number };
  newBookingRows: { sNo: number; date: string; party: string; slip: string; eventDate: string; advance: number }[];
  newBookingTotal: number;
  pnl: { balanceAmount: number; banquetAmount: number; advanceBookingAmount: number; totalSale: number; expenses: number; total: number; naseemReturn: number; totalNetProfit: number };
  recon: { slip: string; disbursed: number; recorded: number; returned: number; outstanding: number; status: string }[];
}

export function ReportDoc({ r }: { r: ReportData }) {
  const days = Array.from({ length: r.petty.days }, (_, i) => i + 1);
  const cell = (day: number, hid: number) => r.petty.cells[`${day}|${hid}`] ?? 0;
  const rowTotal = (hid: number) => days.reduce((s, d) => s + cell(d, hid), 0);
  const colTotal = (day: number) => r.petty.heads.reduce((s, h) => s + cell(day, h.id), 0);
  const grand = r.petty.heads.reduce((s, h) => s + rowTotal(h.id), 0);
  const inc = r.income;
  const active = inc.lines.filter((l) => l.total !== 0);
  const mid = Math.ceil(active.length / 2);
  const incCols = [active.slice(0, mid), active.slice(mid)];

  return (
    <>
      {/* ── Page 1 — Cover ── */}
      <div className="rgb-sheet rgb-report-sheet">
        <LogoBand size="lg" />
        <div className="rgb-body" style={{ display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
          <div style={{ marginTop: '30mm' }}>
            <div style={{ letterSpacing: '0.35em', fontSize: '11px', color: '#8a6d15', textTransform: 'uppercase' }}>Monthly Report</div>
            <div className="rgb-display" style={{ fontSize: '42px', color: '#1a1a1a', margin: '8px 0' }}>{r.label}</div>
            <div style={{ fontSize: '11px', color: '#6b6455' }}>Generated {r.generated} &nbsp;·&nbsp; Prepared for Owner</div>
          </div>
          <div className="rgb-kpis" style={{ maxWidth: '160mm', margin: '26px auto 0' }}>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Total Sale</div><div className="rgb-kpi-val tnum2">{fmtMoney(r.kpis.totalSale)}</div></div>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Total Expenses</div><div className="rgb-kpi-val tnum2">{fmtMoney(r.kpis.totalExpenses)}</div></div>
            {r.showProfit
              ? <div className="rgb-kpi rgb-kpi-gold"><div className="rgb-kpi-lbl">Net Profit</div><div className="rgb-kpi-val tnum2" style={{ color: '#8a6d15' }}>{fmtMoney(r.kpis.netProfit)}</div></div>
              : <div className="rgb-kpi"><div className="rgb-kpi-lbl">Advance</div><div className="rgb-kpi-val tnum2">{fmtMoney(r.newBookingTotal)}</div></div>}
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Bookings</div><div className="rgb-kpi-val tnum2">{r.kpis.bookings}</div></div>
          </div>
          <div style={{ marginTop: 'auto', fontSize: '9.5px', color: '#8a8574', letterSpacing: '0.05em' }}>
            CONTENTS &nbsp; 1. Summary &nbsp;·&nbsp; 2. Petty Cash Sheet &nbsp;·&nbsp; 3. Income Statement &nbsp;·&nbsp; 4. Monthly Sale
          </div>
        </div>
        <FooterBand />
      </div>

      {/* ── Page 2 — Petty Cash matrix (landscape) ── */}
      <div className="rgb-sheet rgb-sheet-land rgb-report-sheet">
        <LogoBand />
        <div className="rgb-body">
          <div className="rgb-meta"><Contact /><div style={{ textAlign: 'right' }}><div className="rgb-doc-title">Petty Cash Sheet</div><div className="rgb-slipno">{r.label}</div></div></div>
          <table className="rgb-table" style={{ fontSize: '6px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '34mm', fontSize: '6px' }}>Expense Head</th>
                {days.map((d) => <th key={d} className="r" style={{ padding: '3px 1px', fontSize: '6px' }}>{d}</th>)}
                <th className="r" style={{ width: '14mm', fontSize: '6px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {r.petty.heads.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontSize: '6.5px', padding: '2px 4px' }}>{h.name}</td>
                  {days.map((d) => { const v = cell(d, h.id); return <td key={d} className="r" style={{ padding: '2px 1px', fontSize: '6px' }}>{v ? Math.round(v / 1000) + 'k' : ''}</td>; })}
                  <td className="r" style={{ padding: '2px 3px', fontSize: '6.5px', fontWeight: 700 }}>{rowTotal(h.id) ? fmtMoney(rowTotal(h.id), false) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontSize: '6.5px', fontWeight: 700 }}>TOTAL</td>
                {days.map((d) => <td key={d} className="r" style={{ padding: '2px 1px', fontSize: '6px' }}>{colTotal(d) ? Math.round(colTotal(d) / 1000) + 'k' : ''}</td>)}
                <td className="r" style={{ fontSize: '7px', fontWeight: 800 }}>{fmtMoney(grand, false)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="rgb-note" style={{ textAlign: 'left', marginTop: '6px' }}>Daily cells shown in thousands (k). Row &amp; column totals in full rupees. Grand total: {fmtMoney(grand)}.</div>
        </div>
        <FooterBand />
      </div>

      {/* ── Page 3 — Income Statement ── */}
      <div className="rgb-sheet rgb-report-sheet">
        <LogoBand />
        <div className="rgb-body">
          <div className="rgb-meta"><Contact /><div style={{ textAlign: 'right' }}><div className="rgb-doc-title">Income Statement</div><div className="rgb-slipno">{fmtDate(inc.dateFrom)} — {fmtDate(inc.dateTo)}</div></div></div>
          <div className="rgb-kpis">
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Balance Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(inc.balanceAmount)}</div></div>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Banquet Amount</div><div className="rgb-kpi-val tnum2">{fmtMoney(inc.banquetAmount)}</div></div>
            <div className="rgb-kpi"><div className="rgb-kpi-lbl">Advance Booking</div><div className="rgb-kpi-val tnum2">{fmtMoney(inc.advanceBookingSale)}</div></div>
            <div className="rgb-kpi rgb-kpi-gold"><div className="rgb-kpi-lbl">Total Sale</div><div className="rgb-kpi-val tnum2" style={{ color: '#8a6d15' }}>{fmtMoney(inc.total)}</div></div>
          </div>
          <div className="rgb-sec">Expenses by Head</div>
          <div style={{ display: 'flex', gap: '14px' }}>
            {incCols.map((col, ci) => (
              <table key={ci} className="rgb-table" style={{ flex: 1 }}><tbody>
                {col.map((l, i) => (
                  <tr key={i}><td>{l.name}{l.qty_note ? <span style={{ color: '#a49c88' }}> ({l.qty_note})</span> : ''}</td><td className="r" style={{ width: '34%' }}>{fmtMoney(l.total, false)}</td></tr>
                ))}
              </tbody></table>
            ))}
          </div>
          <table className="rgb-table" style={{ marginTop: '8px' }}><tfoot><tr><td style={{ fontWeight: 700 }}>TOTAL EXPENSES</td><td className="r" style={{ width: '20%' }}>{fmtMoney(inc.totalExpenses, false)}</td></tr></tfoot></table>
          {inc.showProfit && (
            <>
              <div className="rgb-sec">Summary</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <table className="rgb-sum" style={{ width: '55%' }}><tbody>
                  <tr><td className="lbl">SALE</td><td className="val">{fmtMoney(inc.footer.sale, false)}</td></tr>
                  <tr><td className="lbl">EXPENSES</td><td className="val" style={{ color: '#C62828' }}>-{fmtMoney(inc.footer.expenses, false)}</td></tr>
                  <tr className="total"><td>TOTAL</td><td className="val">{fmtMoney(inc.footer.total, false)}</td></tr>
                  <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(float held)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(inc.footer.naseemReturn, false)}</td></tr>
                  <tr><td className="lbl">NASEEM RETURN <span style={{ color: '#a49c88' }}>(returned)</span></td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(inc.footer.naseemReturn2, false)}</td></tr>
                  <tr className="grand"><td>TOTAL NET PROFIT</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(inc.footer.totalNetProfit, false)}</td></tr>
                </tbody></table>
              </div>
            </>
          )}
        </div>
        <FooterBand />
      </div>

      {/* ── Page 4 — Monthly Sale ── */}
      <div className="rgb-sheet rgb-report-sheet">
        <LogoBand />
        <div className="rgb-body">
          <div className="rgb-meta"><Contact /><div style={{ textAlign: 'right' }}><div className="rgb-doc-title">Monthly Sale</div><div className="rgb-slipno">{r.label}</div></div></div>
          <div className="rgb-sec" style={{ marginTop: 0 }}>Settled Events</div>
          <table className="rgb-table">
            <thead><tr><th style={{ width: '6%' }}>#</th><th>Date</th><th>Party</th><th>Slip</th><th className="r">Balance</th><th className="r">Banquet</th><th className="r">Total</th></tr></thead>
            <tbody>{r.saleRows.map((s) => (
              <tr key={s.slip}><td>{s.sNo}</td><td>{fmtDate(s.date)}</td><td>{s.party}</td><td>{s.slip}</td><td className="r">{fmtMoney(s.balance, false)}</td><td className="r">{fmtMoney(s.banquet, false)}</td><td className="r">{fmtMoney(s.total, false)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={4}>TOTAL</td><td className="r">{fmtMoney(r.saleTotals.balance, false)}</td><td className="r">{fmtMoney(r.saleTotals.banquet, false)}</td><td className="r">{fmtMoney(r.saleTotals.total, false)}</td></tr></tfoot>
          </table>
          <div className="rgb-sec">New Bookings (Advances Received)</div>
          <table className="rgb-table">
            <thead><tr><th style={{ width: '6%' }}>#</th><th>Booked</th><th>Party</th><th>Slip</th><th>Event</th><th className="r">Advance</th></tr></thead>
            <tbody>{r.newBookingRows.map((s) => (
              <tr key={s.slip}><td>{s.sNo}</td><td>{fmtDate(s.date)}</td><td>{s.party}</td><td>{s.slip}</td><td>{fmtDate(s.eventDate)}</td><td className="r">{fmtMoney(s.advance, false)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={5}>TOTAL ADVANCE</td><td className="r">{fmtMoney(r.newBookingTotal, false)}</td></tr></tfoot>
          </table>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            {r.showProfit && (
              <div style={{ flex: 1 }}>
                <div className="rgb-sec">Profit &amp; Loss</div>
                <table className="rgb-sum"><tbody>
                  <tr><td className="lbl">Balance Amount</td><td className="val">{fmtMoney(r.pnl.balanceAmount, false)}</td></tr>
                  <tr><td className="lbl">Banquet Amount</td><td className="val">{fmtMoney(r.pnl.banquetAmount, false)}</td></tr>
                  <tr><td className="lbl">Advance Booking</td><td className="val">{fmtMoney(r.pnl.advanceBookingAmount, false)}</td></tr>
                  <tr className="total"><td>Total Sale</td><td className="val">{fmtMoney(r.pnl.totalSale, false)}</td></tr>
                  <tr><td className="lbl">Expenses</td><td className="val" style={{ color: '#C62828' }}>-{fmtMoney(r.pnl.expenses, false)}</td></tr>
                  <tr><td className="lbl">Naseem Return</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(r.pnl.naseemReturn, false)}</td></tr>
                  <tr className="grand"><td>Net Profit</td><td className="val" style={{ color: '#8a6d15' }}>{fmtMoney(r.pnl.totalNetProfit, false)}</td></tr>
                </tbody></table>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div className="rgb-sec">Manager Reconciliation</div>
              {r.recon.length === 0 ? <div style={{ fontSize: '10px', color: '#a49c88' }}>No float disbursed this month.</div> : (
                <table className="rgb-table">
                  <thead><tr><th>Slip</th><th className="r">Disbursed</th><th className="r">Recorded</th><th className="r">Outstanding</th></tr></thead>
                  <tbody>{r.recon.map((x, i) => (
                    <tr key={i}><td>{x.slip}</td><td className="r">{fmtMoney(x.disbursed, false)}</td><td className="r">{fmtMoney(x.recorded, false)}</td><td className="r">{fmtMoney(x.outstanding, false)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
          <div className="rgb-signs" style={{ justifyContent: 'space-between' }}>
            <div className="rgb-sign-line" style={{ flex: 'none', width: '200px' }}>Manager (Naseem)</div>
            <div className="rgb-sign-line" style={{ flex: 'none', width: '200px' }}>Owner (Usama)</div>
          </div>
        </div>
        <FooterBand />
      </div>
    </>
  );
}
