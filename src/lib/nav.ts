import type { Permission } from './types';

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  perm: Permission;
  mobile?: boolean; // show in bottom bar
}

export const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/app', icon: 'LayoutDashboard', perm: 'bookings.view', mobile: true },
  { label: 'Calendar', href: '/app/calendar', icon: 'CalendarDays', perm: 'bookings.view', mobile: true },
  { label: 'Bookings', href: '/app/bookings', icon: 'BookMarked', perm: 'bookings.view', mobile: true },
  { label: 'Petty Cash', href: '/app/petty-cash', icon: 'Wallet', perm: 'pettycash.view', mobile: true },
  { label: 'Attendance', href: '/app/attendance', icon: 'ClipboardCheck', perm: 'attendance.view', mobile: true },
  { label: 'Manager Float', href: '/app/float', icon: 'HandCoins', perm: 'float.view' },
  { label: 'Monthly Sale', href: '/app/sale', icon: 'Receipt', perm: 'sale.view' },
  { label: 'Income Statement', href: '/app/income', icon: 'TrendingUp', perm: 'income.view' },
  { label: 'Reports', href: '/app/reports', icon: 'FileText', perm: 'reports.generate' },
  { label: 'Leads', href: '/app/leads', icon: 'Sparkles', perm: 'leads.view' },
  { label: 'Halls', href: '/app/halls', icon: 'Building2', perm: 'halls.manage' },
  { label: 'Rules', href: '/app/rules', icon: 'ScrollText', perm: 'rules.manage' },
  { label: 'Users', href: '/app/users', icon: 'Users', perm: 'users.manage' },
  { label: 'Settings', href: '/app/settings', icon: 'Settings', perm: 'settings.manage' },
];
