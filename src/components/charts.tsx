'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart,
} from 'recharts';
import { fmtMoney } from '@/lib/format';

const GOLD = '#C9A227';
const GOLD_LIGHT = '#F0D67B';
const PALETTE = ['#C9A227', '#F0D67B', '#A6841C', '#8A867B', '#6B5D2E', '#E4C766', '#B89530', '#5BBF8A'];

const axisStyle = { fill: '#8A867B', fontSize: 11 };

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[rgb(var(--gold)/0.3)] bg-[rgb(var(--surface))] px-3 py-2 text-xs shadow-lift">
      {label && <div className="mb-1 font-medium text-[rgb(var(--text))]">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 tnum text-[rgb(var(--text-muted))]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="text-gold">{fmtMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueTrend({ data }: { data: { label: string; sale: number; expenses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gSale" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(138,134,123,0.15)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<TooltipBox />} />
        <Area type="monotone" dataKey="sale" name="Sale" stroke={GOLD} strokeWidth={2.5} fill="url(#gSale)" />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#D98A8A" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ExpenseDonut({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[260px] w-full items-center justify-center text-sm text-[rgb(var(--text-muted))]">
        No expenses recorded yet.
      </div>
    );
  }
  const top = [...data].sort((a, b) => b.value - a.value).slice(0, 7);
  const rest = data.slice(7).reduce((s, d) => s + d.value, 0);
  const chartData = rest > 0 ? [...top, { name: 'Other', value: rest }] : top;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none">
          {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip content={<TooltipBox />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BookingsBar({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD_LIGHT} />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(138,134,123,0.15)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(201,162,39,0.08)' }} />
        <Bar dataKey="count" name="Bookings" fill="url(#gBar)" radius={[6, 6, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutLegend({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) return null;
  const top = [...data].sort((a, b) => b.value - a.value).slice(0, 8);
  return (
    <ul className="space-y-1.5">
      {top.map((d, i) => (
        <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2 text-[rgb(var(--text-muted))] truncate">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="truncate">{d.name}</span>
          </span>
          <span className="tnum shrink-0 text-[rgb(var(--text))]">{fmtMoney(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}
