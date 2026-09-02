import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format phone numbers with +92 country code (e.g. 03001234567 -> +92 300 1234567). */
export function fmtPhone(input: string | null | undefined): string {
  if (!input) return '—';
  const cleaned = input.trim();
  if (!cleaned || cleaned === '—') return '—';
  if (cleaned.startsWith('+')) return cleaned;

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('03')) {
    return `+92 ${digits.slice(1, 4)} ${digits.slice(4)}`;
  }
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+92 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  if (digits.length === 12 && digits.startsWith('923')) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  if (cleaned.startsWith('3')) return `+92 ${cleaned}`;
  if (cleaned.startsWith('03')) return `+92 ${cleaned.slice(1)}`;

  return cleaned;
}

/** Format a money amount as PKR: Rs. 1,20,000 -> we use standard grouping. */
export function fmtMoney(n: number | null | undefined, withSymbol = true): string {
  const v = Number(n ?? 0);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${sign}${withSymbol ? 'Rs. ' : ''}${formatted}`;
}

/** Format with 2 decimals for exact ledgers. */
export function fmtMoney2(n: number | null | undefined, withSymbol = true): string {
  const v = Number(n ?? 0);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${withSymbol ? 'Rs. ' : ''}${formatted}`;
}

const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Return full weekday name e.g. "Saturday" for YYYY-MM-DD or Date. Returns '' if invalid. */
export function getWeekday(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? parseDate(input) : input;
  if (!d || isNaN(d.getTime())) return '';
  return WEEKDAYS_FULL[d.getDay()];
}

/** DD-MMM-YY e.g. 21-Mar-26 */
export function fmtDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? parseDate(input) : input;
  if (!d || isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

/** DD-MMM-YY (Day) e.g. 21-Mar-26 (Saturday) */
export function fmtDateWithDay(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const base = fmtDate(input);
  if (base === '—') return '—';
  const day = getWeekday(input);
  return day ? `${base} (${day})` : base;
}

/** Long form e.g. 21 March 2026 */
export function fmtDateLong(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? parseDate(input) : input;
  if (!d || isNaN(d.getTime())) return '—';
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${full[d.getMonth()]} ${d.getFullYear()}`;
}

/** Parse a 'YYYY-MM-DD' or ISO string into a local-safe Date. */
export function parseDate(s: string): Date {
  // Handle 'YYYY-MM-DD' and 'YYYY-MM-DD HH:mm:ss'
  const datePart = s.split(/[ T]/)[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  return new Date(s);
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function monthLabelFull(year: number, month: number): string {
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${full[month - 1]} ${year}`;
}

/** First and last day (YYYY-MM-DD) of a given month. */
export function monthRange(year: number, month: number): { from: string; to: string; days: number } {
  const days = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(days)}`,
    days,
  };
}

/** Resolve ?y=&m= search params with a fallback. Server-safe (pure). */
export function resolvePeriod(searchParams: Record<string, string | string[] | undefined>, fallback: { year: number; month: number }) {
  const y = Number(Array.isArray(searchParams.y) ? searchParams.y[0] : searchParams.y);
  const m = Number(Array.isArray(searchParams.m) ? searchParams.m[0] : searchParams.m);
  return {
    year: Number.isInteger(y) && y > 2000 ? y : fallback.year,
    month: Number.isInteger(m) && m >= 1 && m <= 12 ? m : fallback.month,
  };
}

export { MONTHS };
