export type UserRole = 'resident' | 'security' | 'admin'

export type GuestPassStatus = 'valid' | 'expired' | 'revoked'

export type EntryLogStatus = 'inside' | 'completed'

export interface Profile {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  apartment_number: string | null
  role: UserRole
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
  created_at: string
  updated_at: string
}

export interface GuestPassWithResident extends GuestPass {
  resident: Pick<Profile, 'id' | 'full_name' | 'email' | 'apartment_number'>
}

export interface EntryLog {
  id: string
  guest_pass_id: string
  security_guard_id: string
  entry_time: string
  exit_time: string | null
  status: EntryLogStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EntryLogWithDetails extends EntryLog {
  guest_pass: Pick<GuestPass, 'guest_name' | 'guest_id' | 'apartment_number' | 'purpose' | 'guest_phone' | 'visit_date' | 'visit_time' | 'expiry_time'>
  security_guard: Pick<Profile, 'id' | 'full_name'>
}

export interface DashboardStats {
  totalGuests: number
  activeGuests: number
  expiredPasses: number
  completedVisits: number
}

export interface AdminStats {
  totalResidents: number
  totalSecurityGuards: number
  totalGuestPasses: number
  activeGuests: number
  completedVisits: number
  expiredPasses: number
}

export interface QRScanResult {
  token: string
}

export interface VerifyTokenResult {
  valid: boolean
  guestPass?: GuestPassWithResident
  entryLog?: EntryLog
  message?: string
  status?: 'valid' | 'expired' | 'already_inside' | 'completed' | 'revoked' | 'not_found'
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

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
