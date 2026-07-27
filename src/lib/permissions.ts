import { type Permission, type Role, ROLE_DEFAULTS } from './types';

/**
 * Resolve the effective permission set for a user.
 * If the user has an explicit `permissions` JSON override, that wins;
 * otherwise fall back to the role defaults.
 */
export function resolvePermissions(role: Role, override: string | string[] | null | undefined): Permission[] {
  if (override) {
    const arr = typeof override === 'string' ? safeParse(override) : override;
    if (Array.isArray(arr) && arr.length > 0) return arr as Permission[];
  }
  return ROLE_DEFAULTS[role] ?? [];
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/** Human-readable label + group for each permission (for the access editor UI). */
export const PERMISSION_META: Record<Permission, { label: string; group: string }> = {
  'bookings.view': { label: 'View bookings', group: 'Bookings' },
  'bookings.create': { label: 'Create bookings', group: 'Bookings' },
  'bookings.edit': { label: 'Edit bookings', group: 'Bookings' },
  'bookings.delete': { label: 'Delete bookings', group: 'Bookings' },
  'payments.record': { label: 'Record payments', group: 'Bookings' },
  'pettycash.view': { label: 'View petty cash', group: 'Petty Cash' },
  'pettycash.edit': { label: 'Edit petty cash', group: 'Petty Cash' },
  'pettycash.lock': { label: 'Lock / unlock months', group: 'Petty Cash' },
  'float.view': { label: 'View manager float', group: 'Manager Float' },
  'float.disburse': { label: 'Disburse float', group: 'Manager Float' },
  'float.reconcile': { label: 'Reconcile / mark returned', group: 'Manager Float' },
  'income.view': { label: 'View income statement', group: 'Financials' },
  'income.adjust': { label: 'Owner adjustments', group: 'Financials' },
  'sale.view': { label: 'View monthly sale', group: 'Financials' },
  'reports.generate': { label: 'Generate reports', group: 'Financials' },
  'profit.view': { label: 'View net profit', group: 'Financials' },
  'leads.view': { label: 'View leads', group: 'Other' },
  'attendance.view': { label: 'View attendance', group: 'Staff' },
  'attendance.mark': { label: 'Mark attendance', group: 'Staff' },
  'employees.manage': { label: 'Manage employees', group: 'Staff' },
  'halls.manage': { label: 'Manage halls', group: 'Admin' },
  'rules.manage': { label: 'Manage rules', group: 'Admin' },
  'users.manage': { label: 'Manage users', group: 'Admin' },
  'settings.manage': { label: 'Manage settings', group: 'Admin' },
};

export function can(perms: Permission[] | undefined, perm: Permission): boolean {
  return !!perms?.includes(perm);
}

export function canAny(perms: Permission[] | undefined, list: Permission[]): boolean {
  return !!perms && list.some((p) => perms.includes(p));
}
