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
  // Super Admin only by default — `livecooking.view` is carved out of the
  // Owner's implicit grant, so this row simply never renders for them.
  { label: 'Live Cooking', href: '/app/live-cooking', icon: 'ChefHat', perm: 'livecooking.view' },
  { label: 'Income Statement', href: '/app/income', icon: 'TrendingUp', perm: 'income.view' },
  { label: 'Reports', href: '/app/reports', icon: 'FileText', perm: 'reports.generate' },
  { label: 'Leads', href: '/app/leads', icon: 'Sparkles', perm: 'leads.view' },
  { label: 'Halls', href: '/app/halls', icon: 'Building2', perm: 'halls.manage' },
  { label: 'Stock', href: '/app/stock', icon: 'Package', perm: 'stock.view' },
  { label: 'Rules', href: '/app/rules', icon: 'ScrollText', perm: 'rules.manage' },
  { label: 'Reviews', href: '/app/reviews', icon: 'MessageSquareQuote', perm: 'reviews.manage' },
  { label: 'Users', href: '/app/users', icon: 'Users', perm: 'users.manage' },
  { label: 'Settings', href: '/app/settings', icon: 'Settings', perm: 'settings.manage' },
];


/**
 * The catering portal's own sidebar.
 *
 * Catering is a separate business, so it gets a separate navigation rather
 * than extra rows in the ballroom sidebar — a Catering user never sees a hall,
 * a booking or a petty-cash sheet.
 */
export const CATERING_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/catering', icon: 'LayoutDashboard', perm: 'catering.view', mobile: true },
  { label: 'Quotations', href: '/catering/quotations', icon: 'FileText', perm: 'catering.view', mobile: true },
  { label: 'Invoices', href: '/catering/invoices', icon: 'ReceiptText', perm: 'catering.view', mobile: true },
  { label: 'Templates', href: '/catering/templates', icon: 'LayoutTemplate', perm: 'catering.view', mobile: true },
  { label: 'Event Ledger', href: '/catering/ledger', icon: 'Scale', perm: 'catering.reports', mobile: true },
  { label: 'Customers', href: '/catering/customers', icon: 'Users', perm: 'catering.view' },
  { label: 'Vendors', href: '/catering/vendors', icon: 'Truck', perm: 'catering.view' },
  { label: 'Vendor Bills', href: '/catering/bills', icon: 'Receipt', perm: 'catering.reports' },
  { label: 'Menu & Rates', href: '/catering/menu', icon: 'UtensilsCrossed', perm: 'catering.view', mobile: true },
  { label: 'Categories', href: '/catering/categories', icon: 'Tags', perm: 'catering.view' },
  { label: 'Meat Rates', href: '/catering/meat', icon: 'Beef', perm: 'catering.view' },
  { label: 'Rules', href: '/catering/rules', icon: 'ScrollText', perm: 'catering.view' },
  { label: 'Reports', href: '/catering/reports', icon: 'TrendingUp', perm: 'catering.reports', mobile: true },
  { label: 'Settings', href: '/catering/settings', icon: 'Settings', perm: 'catering.manage' },
];
