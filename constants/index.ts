export const APP_NAME = 'SecureEntry'
export const APP_DESCRIPTION = 'Secure Visitor Management System for Residential Buildings'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  SIGN_UP: '/auth/sign-up',
  SIGN_UP_SUCCESS: '/auth/sign-up-success',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_ERROR: '/auth/error',

  RESIDENT_DASHBOARD: '/dashboard/resident',
  RESIDENT_CREATE_PASS: '/dashboard/resident/create-pass',
  RESIDENT_GUEST_HISTORY: '/dashboard/resident/history',
  RESIDENT_PROFILE: '/dashboard/resident/profile',
  RESIDENT_SETTINGS: '/dashboard/resident/settings',

  SECURITY_DASHBOARD: '/dashboard/security',
  SECURITY_SCANNER: '/dashboard/security/scanner',
  SECURITY_LOGS: '/dashboard/security/logs',
  SECURITY_VISITORS: '/dashboard/security/visitors',

  ADMIN_DASHBOARD: '/dashboard/admin',
  ADMIN_RESIDENTS: '/dashboard/admin/residents',
  ADMIN_SECURITY: '/dashboard/admin/security',
  ADMIN_GUEST_PASSES: '/dashboard/admin/guest-passes',
  ADMIN_ENTRY_LOGS: '/dashboard/admin/entry-logs',
  ADMIN_ANALYTICS: '/dashboard/admin/analytics',

  VERIFY: '/verify',
} as const

export const ROLE_ROUTES: Record<string, string> = {
  resident: ROUTES.RESIDENT_DASHBOARD,
  security: ROUTES.SECURITY_DASHBOARD,
  admin: ROUTES.ADMIN_DASHBOARD,
}

export const DURATION_OPTIONS = [
  { value: 1, label: '1 Hour' },
  { value: 2, label: '2 Hours' },
  { value: 4, label: '4 Hours' },
  { value: 8, label: '8 Hours' },
  { value: 12, label: '12 Hours' },
  { value: 24, label: '24 Hours' },
] as const

export const VISIT_PURPOSES = [
  'Delivery',
  'Repair & Maintenance',
  'Family Visit',
  'Friend Visit',
  'House Cleaning',
  'Medical Visit',
  'Business Meeting',
  'Moving',
  'Other',
] as const

export const PAGE_SIZE = 10

export const PASS_STATUS_LABELS: Record<string, string> = {
  valid: 'Valid',
  expired: 'Expired',
  revoked: 'Revoked',
}

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  inside: 'Inside',
  completed: 'Completed',
}

export const PASS_STATUS_COLORS: Record<string, string> = {
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  revoked: 'bg-red-50 text-red-700 border-red-200',
}

export const ENTRY_STATUS_COLORS: Record<string, string> = {
  inside: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-slate-50 text-slate-600 border-slate-200',
}

export const ROLE_COLORS: Record<string, string> = {
  resident: 'bg-blue-50 text-blue-700 border-blue-200',
  security: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-slate-50 text-slate-700 border-slate-200',
}
