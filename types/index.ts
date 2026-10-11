export type UserRole = 'resident' | 'security' | 'admin'

export type GuestPassStatus = 'valid' | 'expired' | 'revoked' | 'used'

/** Computed display status — may differ from stored status when expiry_time has passed */
export type ComputedPassStatus = GuestPassStatus

export type EntryLogStatus = 'inside' | 'completed' | 'overstay'

export type CheckoutType = 'manual' | 'auto_closed' | 'admin_closed'

export type AuditAction =
  | 'pass.created'
  | 'pass.revoked'
  | 'pass.archived'
  | 'pass.status_changed'
  | 'checkin.allowed'
  | 'checkin.denied'
  | 'checkout.manual'
  | 'checkout.admin_closed'
  | 'role.changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.created'
  | 'export.done'
  | 'policy.changed'

export interface Profile {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  apartment_number: string | null
  role: UserRole
  is_active: boolean
  deactivated_at: string | null
  deactivated_by: string | null
  deactivation_reason: string | null
  created_at: string
  updated_at: string
}

export interface GuestPass {
  id: string
  guest_id: string
  guest_name: string
  guest_phone: string | null
  resident_id: string
  apartment_number: string
  visit_date: string
  visit_time: string
  expiry_time: string
  duration_hours: number
  purpose: string
  qr_token: string
  status: GuestPassStatus
  archived_at: string | null
  archived_by: string | null
  archive_reason: string | null
  created_at: string
  updated_at: string
}

export interface GuestPassWithResident extends GuestPass {
  resident: Pick<Profile, 'id' | 'full_name' | 'email' | 'apartment_number' | 'phone_number'>
}

export interface EntryLog {
  id: string
  guest_pass_id: string
  security_guard_id: string
  entry_time: string
  exit_time: string | null
  expected_exit_at: string | null
  overstay_started_at: string | null
  checkout_type: CheckoutType | null
  status: EntryLogStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EntryLogWithDetails extends EntryLog {
  guest_pass: Pick<
    GuestPass,
    'guest_name' | 'guest_id' | 'apartment_number' | 'purpose' | 'guest_phone' |
    'visit_date' | 'visit_time' | 'expiry_time' | 'duration_hours'
  > & {
    resident: Pick<Profile, 'id' | 'full_name' | 'apartment_number' | 'phone_number'>
  }
  security_guard: Pick<Profile, 'id' | 'full_name'>
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_role: string
  action: AuditAction | string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface DashboardStats {
  totalGuests: number
  activeGuests: number
  expiredPasses: number
  revokedPasses: number
  usedPasses: number
  completedVisits: number
  overstayCount: number
}

export interface AdminStats {
  totalResidents: number
  totalSecurityGuards: number
  totalGuestPasses: number
  activeGuests: number
  completedVisits: number
  expiredPasses: number
  revokedPasses: number
  usedPasses: number
  overstayCount: number
}

export interface QRScanResult {
  token: string
}

export interface VerifyTokenResult {
  valid: boolean
  status: 'valid' | 'expired' | 'already_inside' | 'completed' | 'revoked' | 'used' | 'archived' | 'not_found'
  message: string
  guest_pass?: GuestPassWithResident
  resident?: Pick<Profile, 'id' | 'full_name' | 'email' | 'apartment_number' | 'phone_number'>
  entry_log_id?: string
  entry_time?: string
  exit_time?: string
}

export interface GuestSearchResult {
  id: string
  guest_name: string
  guest_phone: string | null
  apartment_number: string
  purpose: string
  visit_date: string
  visit_time: string
  expiry_time: string
  duration_hours: number
  status: GuestPassStatus
  qr_token: string
  resident_name: string | null
  resident_phone: string | null
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FilterParams {
  search?: string
  status?: string
  role?: string
  dateFrom?: string
  dateTo?: string
}

export interface AnalyticsData {
  passesPerDay: { date: string; count: number; isoDate: string }[]
  visitsByPurpose: { purpose: string; count: number }[]
  visitorsByApartment: { apartment: string; count: number }[]
  entryExitByHour: { hour: number; label: string; entries: number; exits: number }[]
  monthlyVisitors: { month: string; count: number }[]
  frequentVisitors: { guest_name: string; guest_phone: string | null; visit_count: number }[]
  totalVisitors: number
  avgStayMinutes: number
  overstayCount: number
  peakDay: { date: string; count: number } | null
  totalEntries: number
  totalExits: number
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
