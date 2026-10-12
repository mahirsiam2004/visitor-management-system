// ─── Roles ────────────────────────────────────────────────────────────────
export type UserRole = 'resident' | 'security' | 'admin'

// ─── Pass status ──────────────────────────────────────────────────────────
export type GuestPassStatus    = 'valid' | 'expired' | 'revoked' | 'used'
export type ComputedPassStatus = GuestPassStatus

// ─── Entry log ────────────────────────────────────────────────────────────
export type EntryLogStatus = 'inside' | 'completed' | 'overstay'
export type CheckoutType   = 'manual' | 'auto_closed' | 'admin_closed'

// ─── Visitor types ────────────────────────────────────────────────────────
export type VisitorType =
  | 'one_time' | 'recurring' | 'delivery' | 'minor_family'
  | 'event' | 'walk_in' | 'emergency'

// ─── Identity ─────────────────────────────────────────────────────────────
export type IdType =
  | 'nid' | 'driving_license' | 'student_id' | 'known_to_resident' | 'none'

// ─── Visit request ────────────────────────────────────────────────────────
export type VisitRequestType   = 'delivery' | 'walk_in' | 'emergency'
export type VisitRequestStatus =
  | 'pending' | 'approved' | 'rejected' | 'expired' | 'completed' | 'leave_at_gate'

// ─── Recurring visitor ────────────────────────────────────────────────────
export type RecurringVisitorStatus = 'active' | 'suspended' | 'blacklisted'

// ─── Event ────────────────────────────────────────────────────────────────
export type EventType        = 'wedding' | 'birthday' | 'puja' | 'eid_gathering' | 'corporate' | 'other'
export type EventStatus      = 'upcoming' | 'active' | 'completed' | 'cancelled'
export type ApprovalStatus   = 'pending' | 'approved' | 'rejected' | 'not_required'
export type EventGuestStatus = 'invited' | 'arrived' | 'no_show'

// ─── Extension ────────────────────────────────────────────────────────────
export type ExtensionStatus   = 'pending' | 'approved' | 'rejected'
export type ExtensionApprovalLevel = 'resident' | 'admin'
export type ExtendHours       = 1 | 2 | 4 | 24

// ─── Penalty ──────────────────────────────────────────────────────────────
export type PenaltyStatus = 'pending' | 'waived' | 'added_to_bill'

// ─── Access attempt ───────────────────────────────────────────────────────
export type AccessAttemptResult =
  | 'invalid' | 'expired' | 'revoked' | 'limit_exceeded'
  | 'too_early' | 'outside_schedule' | 'already_inside'
  | 'rate_limited' | 'pass_not_found' | 'archived' | 'used'

// ─── Notification ─────────────────────────────────────────────────────────
export type NotificationType =
  | 'checkin' | 'checkout' | 'overstay' | 'ending_soon' | 'revoked'
  | 'system' | 'delivery' | 'walk_in' | 'event' | 'emergency'
  | 'extension_request' | 'extension_approved' | 'extension_rejected'
  | 'penalty_created' | 'penalty_waived'

export type NotificationChannel = 'inapp' | 'push' | 'sms'

// ─── Audit ────────────────────────────────────────────────────────────────
export type AuditAction =
  | 'pass.created' | 'pass.revoked' | 'pass.archived' | 'pass.status_changed'
  | 'checkin.allowed' | 'checkin.denied' | 'checkout.manual' | 'checkout.admin_closed'
  | 'role.changed' | 'user.deactivated' | 'user.reactivated' | 'user.created'
  | 'export.done' | 'policy.changed'
  | 'recurring.created' | 'recurring.checkin' | 'recurring.suspended'
  | 'visit_request.created' | 'visit_request.approved' | 'visit_request.rejected'
  | 'event.created' | 'event.approved' | 'event.checkin' | 'event.rejected'
  | 'emergency.entry' | 'blacklist.added' | 'blacklist.removed'
  | 'extension.requested' | 'extension.approved' | 'extension.rejected'
  | 'penalty.created' | 'penalty.waived' | 'penalty.bill_added'

// ─── Interfaces ───────────────────────────────────────────────────────────

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
  delivery_auto_allow_until: string | null
  created_at: string
  updated_at: string
}

export interface PolicySettings {
  id: string
  overstay_grace_minutes: number
  overstay_penalty_rate_bdt: number
  overstay_notify_admin_after_minutes: number
  ending_soon_warn_minutes: number
  max_pass_duration_hours: number
  max_extensions_resident: number
  max_total_stay_hours: number
  delivery_reply_minutes: number
  delivery_access_window_min: number
  walk_in_reply_minutes: number
  event_approval_threshold: number
  max_sms_per_resident_per_day: number
  sms_critical_only: boolean
  photo_retention_days: number
  penalty_enabled: boolean
  updated_by: string | null
  updated_at: string
}

export interface PassExtension {
  id: string
  pass_id: string
  entry_log_id: string | null
  old_expiry: string
  new_expiry: string
  extend_hours: ExtendHours
  status: ExtensionStatus
  requested_by: string
  approved_by: string | null
  approval_level: ExtensionApprovalLevel
  reason: string | null
  resolved_at: string | null
  was_overstay: boolean
  created_at: string
}

export interface Penalty {
  id: string
  resident_id: string
  entry_log_id: string | null
  pass_id: string | null
  minutes_over: number
  amount_bdt: number
  status: PenaltyStatus
  waived_by: string | null
  waive_reason: string | null
  waived_at: string | null
  month_year: string      // 'YYYY-MM'
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  user_id: string
  inapp_enabled: boolean
  push_enabled: boolean
  push_endpoint: string | null
  push_p256dh: string | null
  push_auth: string | null
  sms_enabled: boolean
  notify_checkin: boolean
  notify_checkout: boolean
  notify_overstay: boolean
  notify_ending_soon: boolean
  notify_delivery: boolean
  notify_walk_in: boolean
  notify_extension: boolean
  notify_penalty: boolean
  notify_revoked: boolean
  notify_event: boolean
  notify_emergency: boolean
  sms_sent_today: number
  sms_last_reset_date: string | null
  updated_at: string
}

export interface GuestPassMember {
  id: string
  guest_pass_id: string
  full_name: string
  relation: string
  is_minor: boolean
  created_at: string
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
  valid_from: string | null
  expiry_time: string
  duration_hours: number
  purpose: string
  qr_token: string
  gate_code: string | null
  status: GuestPassStatus
  allowed_persons: number
  entered_count: number
  guest_photo_url: string | null
  revoked_at: string | null
  revoked_by: string | null
  revoke_reason: string | null
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
  guest_pass_id: string | null
  visit_request_id: string | null
  recurring_visitor_id: string | null
  security_guard_id: string
  entry_time: string
  exit_time: string | null
  expected_exit_at: string | null
  overstay_started_at: string | null
  checkout_type: CheckoutType | null
  id_type: IdType | null
  identity_verified: boolean
  entry_photo_url: string | null
  persons_admitted: number
  visitor_type: VisitorType
  status: EntryLogStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EntryLogWithDetails extends EntryLog {
  guest_pass?: Pick<
    GuestPass,
    'guest_name' | 'guest_id' | 'apartment_number' | 'purpose' | 'guest_phone' |
    'visit_date' | 'visit_time' | 'expiry_time' | 'duration_hours' |
    'allowed_persons' | 'entered_count'
  > & { resident: Pick<Profile, 'id' | 'full_name' | 'apartment_number' | 'phone_number'> }
  security_guard: Pick<Profile, 'id' | 'full_name'>
}

export interface RecurringVisitorSchedule {
  days: string[]
  start: string
  end: string
}

export interface RecurringVisitorApartment {
  id: string
  visitor_id: string
  apartment: string
  resident_id: string
  schedule: RecurringVisitorSchedule
  is_active: boolean
  approved_at: string
}

export interface RecurringVisitor {
  id: string
  short_id: string
  full_name: string
  photo_url: string | null
  phone: string | null
  role: string
  status: RecurringVisitorStatus
  valid_until: string | null
  added_by: string
  created_at: string
  updated_at: string
  apartments?: RecurringVisitorApartment[]
}

export interface VisitRequest {
  id: string
  type: VisitRequestType
  status: VisitRequestStatus
  visitor_name: string
  visitor_phone: string | null
  destination_apt: string
  resident_id: string
  guard_id: string
  purpose: string | null
  notes: string | null
  platform: string | null
  emergency_type: string | null
  responded_at: string | null
  responded_by: string | null
  access_window_min: number
  expires_at: string | null
  entry_allowed_until: string | null
  auto_approved: boolean
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  resident_id: string
  name: string
  event_type: EventType
  apartment: string
  event_date: string
  start_time: string
  end_time: string
  expected_count: number
  max_capacity: number
  requires_approval: boolean
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  counter_token: string
  counter_admitted: number
  status: EventStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EventGuest {
  id: string
  event_id: string
  name: string
  phone: string | null
  qr_token: string
  gate_code: string | null
  status: EventGuestStatus
  arrived_at: string | null
  created_at: string
}

export interface EventCoordinator {
  id: string
  event_id: string
  name: string
  phone: string
  created_at: string
}

export interface BlacklistEntry {
  id: string
  name: string
  phone: string | null
  photo_url: string | null
  reason: string
  scope: 'building' | 'apartment'
  added_by: string
  apartment: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  title: string
  body: string
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface AccessAttempt {
  id: string
  token_used: string | null
  result: AccessAttemptResult
  guard_id: string | null
  pass_id: string | null
  ip_address: string | null
  created_at: string
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
  insideNow: number
  upcomingCount: number
  penaltiesDue: number
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

export interface QRScanResult { token: string }

export interface VerifyTokenResult {
  valid: boolean
  status:
    | 'valid' | 'expired' | 'already_inside' | 'completed'
    | 'revoked' | 'used' | 'archived' | 'not_found'
    | 'too_early' | 'limit_exceeded' | 'rate_limited'
  message: string
  guest_pass?: GuestPass
  resident?: Pick<Profile, 'id' | 'full_name' | 'email' | 'apartment_number' | 'phone_number'>
  members?: GuestPassMember[]
  entry_log_id?: string
  entry_time?: string
  exit_time?: string
  valid_from?: string
  persons_remaining?: number
}

export interface GuestSearchResult {
  id: string
  guest_name: string
  guest_phone: string | null
  apartment_number: string
  purpose: string
  visit_date: string
  visit_time: string
  valid_from: string | null
  expiry_time: string
  duration_hours: number
  allowed_persons: number
  entered_count: number
  status: GuestPassStatus
  qr_token: string
  gate_code: string | null
  guest_photo_url: string | null
  resident_name: string | null
  resident_phone: string | null
}

export interface PaginationParams   { page: number; pageSize: number }
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
export interface FilterParams {
  search?: string; status?: string; role?: string; dateFrom?: string; dateTo?: string
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
