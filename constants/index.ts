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
  ADMIN_EVENTS: '/dashboard/admin/events',
  ADMIN_BLACKLIST: '/dashboard/admin/blacklist',
  RESIDENT_STAFF: '/dashboard/resident/staff',
  RESIDENT_EVENTS: '/dashboard/resident/events',
  SECURITY_QUICK_ENTRY: '/dashboard/security/quick-entry',

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
  used: 'Used',
}

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  inside: 'Inside',
  completed: 'Completed',
  overstay: 'Overstay',
}

export const PASS_STATUS_COLORS: Record<string, string> = {
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  revoked: 'bg-red-50 text-red-700 border-red-200',
  used: 'bg-slate-50 text-slate-600 border-slate-200',
}

export const ENTRY_STATUS_COLORS: Record<string, string> = {
  inside: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-slate-50 text-slate-600 border-slate-200',
  overstay: 'bg-red-50 text-red-700 border-red-200',
}

export const OVERSTAY_GRACE_MINUTES      = 15   // default; real value comes from policy_settings
export const ENDING_SOON_WARN_MINUTES    = 10   // warn resident N min before expiry
export const MAX_EXTENSIONS_RESIDENT     = 1    // >=2 requires admin approval
export const MAX_TOTAL_STAY_HOURS        = 48   // hard ceiling

export const EXTENSION_HOUR_OPTIONS: { value: number; label: string }[] = [
  { value: 1,  label: '+1 Hour' },
  { value: 2,  label: '+2 Hours' },
  { value: 4,  label: '+4 Hours' },
  { value: 24, label: '+24 Hours' },
]

export const PENALTY_STATUS_LABELS: Record<string, string> = {
  pending:      'Pending',
  waived:       'Waived',
  added_to_bill: 'Added to Bill',
}

export const EXTENSION_STATUS_LABELS: Record<string, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const NOTIFY_EVENT_LABELS: Record<string, string> = {
  notify_checkin:     'Guest checked in',
  notify_checkout:    'Guest checked out',
  notify_overstay:    'Guest overstaying',
  notify_ending_soon: 'Pass ending soon (10 min)',
  notify_delivery:    'Delivery at gate',
  notify_walk_in:     'Unregistered visitor',
  notify_extension:   'Extension requested/approved',
  notify_penalty:     'Penalty created',
  notify_revoked:     'Pass revoked alert',
  notify_event:       'Event updates',
  notify_emergency:   'Emergency entry',
}
export const VALID_FROM_BUFFER_MINUTES = 30   // pass opens 30 min before visit_time
export const GATE_CODE_EXPIRY_MINUTES  = 0    // gate_code expires when pass expires
export const RATE_LIMIT_MAX_ATTEMPTS   = 10   // per guard per minute
export const RATE_LIMIT_WINDOW_SECONDS = 60
export const RATE_LIMIT_LOCKOUT_MINUTES = 5

export const ID_TYPE_LABELS: Record<string, string> = {
  nid:               'National ID (NID)',
  driving_license:   'Driving License',
  student_id:        'Student ID',
  known_to_resident: 'Known to Resident',
  none:              'No ID shown',
}

export const RELATION_OPTIONS = [
  'Parent',
  'Sibling',
  'Spouse / Partner',
  'Child',
  'Relative',
  'Friend',
  'Colleague',
  'Househelp',
  'Other',
] as const

export const ACCESS_ATTEMPT_LABELS: Record<string, string> = {
  invalid:           'Invalid token',
  expired:           'Pass expired',
  revoked:           'Pass revoked',
  limit_exceeded:    'Visitor limit exceeded',
  too_early:         'Too early',
  outside_schedule:  'Outside schedule',
  already_inside:    'Already inside',
  rate_limited:      'Rate limited',
  pass_not_found:    'Pass not found',
  archived:          'Pass archived',
  used:              'Pass already used',
}

export const BUILDING_ADDRESS = 'SecureEntry Residential Complex, Dhaka, Bangladesh'

// ── Visitor types ──────────────────────────────────────────────────────────
export const VISITOR_TYPE_LABELS: Record<string, string> = {
  one_time:     'One-Time Guest',
  recurring:    'Recurring Staff',
  delivery:     'Delivery',
  minor_family: 'Minor / Family',
  event:        'Event Guest',
  walk_in:      'Walk-in',
  emergency:    'Emergency',
}

export const RECURRING_VISITOR_ROLES = [
  'Maid / বুয়া',
  'Driver',
  'Cook',
  'Tutor',
  'Caretaker',
  'Gardener',
  'Security (private)',
  'Other',
] as const

export const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const

export const DELIVERY_PLATFORMS = [
  'Foodpanda',
  'Pathao Food',
  'Shohoz Food',
  'Daraz',
  'Pathao Courier',
  'Steadfast',
  'RedX',
  'eCourier',
  'Other',
] as const

export const EMERGENCY_TYPES = [
  'Doctor',
  'Ambulance',
  'Fire Service',
  'Police',
  'Gas Emergency',
  'Plumber / Electrician (urgent)',
  'Other',
] as const

export const EVENT_TYPES = [
  { value: 'wedding',       label: 'Wedding / Biye' },
  { value: 'birthday',      label: 'Birthday Party' },
  { value: 'puja',          label: 'Puja / Religious' },
  { value: 'eid_gathering', label: 'Eid Gathering' },
  { value: 'corporate',     label: 'Corporate Event' },
  { value: 'other',         label: 'Other' },
] as const

export const EVENT_APPROVAL_THRESHOLD = 50  // events with >50 guests need admin approval

export const DELIVERY_RESIDENT_REPLY_MINUTES = 2    // resident has 2 min to respond
export const DELIVERY_ACCESS_WINDOW_MINUTES  = 20   // delivery gets 20 min after approval
export const WALK_IN_RESIDENT_REPLY_MINUTES  = 5    // walk-in gets 5 min

export const VISIT_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending:       'Waiting for Resident',
  approved:      'Approved',
  rejected:      'Rejected',
  expired:       'Timed Out',
  completed:     'Completed',
  leave_at_gate: 'Leave at Gate',
}

export const EVENT_STATUS_LABELS: Record<string, string> = {
  upcoming:   'Upcoming',
  active:     'Active',
  completed:  'Ended',
  cancelled:  'Cancelled',
}

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending:      'Pending Approval',
  approved:     'Approved',
  rejected:     'Rejected',
  not_required: 'No Approval Needed',
}

export const EVENT_GUEST_STATUS_LABELS: Record<string, string> = {
  invited:  'Invited',
  arrived:  'Arrived',
  no_show:  'No Show',
}

export const ROLE_COLORS: Record<string, string> = {
  resident: 'bg-blue-50 text-blue-700 border-blue-200',
  security: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-slate-50 text-slate-700 border-slate-200',
}
