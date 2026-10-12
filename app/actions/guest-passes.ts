'use server'

import { createClient } from '@/lib/supabase/server'
import {
  generateQRToken,
  generateGuestId,
  generateGateCode,
  calculateExpiryTime,
  calculateValidFrom,
  getComputedPassStatus,
} from '@/lib/utils/guest-pass'
import {
  createGuestPassSchema,
  checkInGuestSchema,
  checkOutGuestSchema,
  revokePassSchema,
} from '@/lib/validations/schemas'
import {
  getDhakaToday,
  getDhakaDateOf,
  computeVisitStatus,
  DEFAULT_OVERSTAY_GRACE_MINUTES,
} from '@/lib/visit-status'
import { revalidatePath } from 'next/cache'
import type {
  ActionResult,
  GuestPass,
  EntryLog,
  VerifyTokenResult,
  PaginatedResult,
  DashboardStats,
  GuestSearchResult,
  AccessAttempt,
} from '@/types'
import {
  PAGE_SIZE,
  VALID_FROM_BUFFER_MINUTES,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_SECONDS,
  RATE_LIMIT_LOCKOUT_MINUTES,
} from '@/constants'
import { writeAuditLog } from './audit'

// ─── Auth helper ───────────────────────────────────────────────────────────
async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) throw new Error('Profile not found')
  if ((profile as any).is_active === false) throw new Error('Your account has been deactivated')
  return { supabase, user, profile }
}

// ─── In-memory rate-limit helper (per guard, 10 lookups / 60 s) ────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number; lockedUntil?: number }>()

async function checkRateLimit(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  guardId: string
): Promise<{ blocked: boolean; lockedUntil?: string }> {
  const now = Date.now()
  const state = rateLimitMap.get(guardId)

  if (state?.lockedUntil && state.lockedUntil > now) {
    return { blocked: true, lockedUntil: new Date(state.lockedUntil).toISOString() }
  }

  if (!state || (now - state.windowStart) > RATE_LIMIT_WINDOW_SECONDS * 1000) {
    rateLimitMap.set(guardId, { count: 1, windowStart: now })
    return { blocked: false }
  }

  state.count += 1
  if (state.count > RATE_LIMIT_MAX_ATTEMPTS) {
    const lockedUntil = now + RATE_LIMIT_LOCKOUT_MINUTES * 60 * 1000
    state.lockedUntil = lockedUntil
    return { blocked: true, lockedUntil: new Date(lockedUntil).toISOString() }
  }

  return { blocked: false }
}

// ─── Log access attempt helper ─────────────────────────────────────────────
async function logAccessAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    token_used: string | null
    result: AccessAttempt['result']
    guard_id: string | null
    pass_id: string | null
  }
) {
  try {
    await supabase.from('access_attempts').insert(params)
  } catch {
    // access_attempts table optional
  }
}

// ─── Pass parser helper (extracts JSON-encoded metadata if present) ─────────
function parsePass(row: any): GuestPass {
  if (!row) return row
  let extra: any = {}
  let cleanPurpose = row.purpose || ''

  if (typeof row.purpose === 'string' && row.purpose.startsWith('{')) {
    try {
      extra = JSON.parse(row.purpose)
      cleanPurpose = extra.text || extra.purpose || cleanPurpose
    } catch {
      // not JSON
    }
  }

  return {
    id: row.id,
    guest_id: row.guest_id,
    guest_name: row.guest_name,
    guest_phone: row.guest_phone,
    resident_id: row.resident_id,
    apartment_number: row.apartment_number,
    visit_date: row.visit_date,
    visit_time: row.visit_time,
    valid_from: row.valid_from || extra.valid_from || null,
    expiry_time: row.expiry_time,
    duration_hours: row.duration_hours,
    purpose: cleanPurpose,
    qr_token: row.qr_token,
    gate_code: row.gate_code || extra.gate_code || null,
    status: row.status,
    allowed_persons: row.allowed_persons ?? extra.allowed_persons ?? 1,
    entered_count: row.entered_count ?? extra.entered_count ?? 0,
    guest_photo_url: row.guest_photo_url || row.guest_photo_path || extra.guest_photo_url || null,
    revoked_at: row.revoked_at || null,
    revoked_by: row.revoked_by || null,
    revoke_reason: row.revoke_reason || null,
    archived_at: row.archived_at || null,
    archived_by: row.archived_by || null,
    archive_reason: row.archive_reason || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ─── Entry log parser helper (normalizes real columns and plain-text notes) ─
function parseLog(row: any): any {
  if (!row) return row
  let cleanNotes = row.notes || ''
  if (typeof cleanNotes === 'string' && cleanNotes.startsWith('{')) {
    try {
      const n = JSON.parse(cleanNotes)
      cleanNotes = n.text || n.notes || ''
    } catch {
      // not JSON
    }
  }
  return {
    ...row,
    notes: cleanNotes,
    persons_admitted: row.persons_admitted ?? 1,
    id_type: row.id_type || row.identity_id_type || null,
    identity_id_type: row.identity_id_type || row.id_type || null,
    entry_photo_url: row.entry_photo_url || row.entry_photo_path || null,
    entry_photo_path: row.entry_photo_path || row.entry_photo_url || null,
    expected_exit_at: row.expected_exit_at || null,
    checkout_type: row.checkout_type || null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE GUEST PASS
// ═══════════════════════════════════════════════════════════════════════════
export async function createGuestPass(input: unknown): Promise<ActionResult<GuestPass>> {
  try {
    const validated = createGuestPassSchema.parse(input)
    const { supabase, user, profile } = await requireAuth()

    if (profile.role !== 'resident') {
      return { success: false, error: 'Only residents can create guest passes' }
    }

    const { data: fullProfile } = await supabase
      .from('profiles')
      .select('apartment_number')
      .eq('id', user.id)
      .single()

    if (!fullProfile?.apartment_number) {
      return { success: false, error: 'Set your apartment number in your profile first' }
    }

    const guestId    = generateGuestId()
    const qrToken    = generateQRToken()              // opaque 128-bit UUID
    const gateCode   = generateGateCode()             // 6-digit code
    const expiryTime = calculateExpiryTime(validated.visitDate, validated.visitTime, validated.durationHours)
    const validFrom  = calculateValidFrom(validated.visitDate, validated.visitTime, VALID_FROM_BUFFER_MINUTES)

    const { data, error } = await supabase
      .from('guest_passes')
      .insert({
        guest_id:         guestId,
        guest_name:       validated.guestName,
        guest_phone:      validated.guestPhone || null,
        resident_id:      user.id,
        apartment_number: fullProfile.apartment_number,
        visit_date:       validated.visitDate,
        visit_time:       validated.visitTime,
        expiry_time:      expiryTime.toISOString(),
        duration_hours:   validated.durationHours,
        purpose:          validated.purpose,
        qr_token:         qrToken,
        gate_code:        gateCode,
        valid_from:       validFrom.toISOString(),
        allowed_persons:  validated.allowedPersons || 1,
        entered_count:    0,
        guest_photo_url:  validated.guestPhotoUrl || null,
        guest_photo_path: validated.guestPhotoUrl || null,
        status:           'valid',
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // If companions were registered, insert them into guest_pass_members
    if (validated.companions && validated.companions.length > 0) {
      const memberRows = validated.companions.map((c: any) => ({
        guest_pass_id: data.id,
        full_name:     c.full_name ?? c.fullName,
        relation:      c.relation,
        is_minor:      Boolean(c.is_minor ?? c.isMinor),
      }))
      await supabase.from('guest_pass_members').insert(memberRows)
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'pass.created', entity_type: 'guest_pass', entity_id: data.id,
      metadata: {
        guest_name:      data.guest_name,
        apartment:       data.apartment_number,
        purpose:         validated.purpose,
        allowed_persons: validated.allowedPersons,
      },
    })

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')
    return { success: true, data: parsePass(data) }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to create guest pass' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET GUEST PASSES (paginated)
// ═══════════════════════════════════════════════════════════════════════════
export async function getGuestPasses(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  residentId?: string
}): Promise<ActionResult<PaginatedResult<GuestPass>>> {
  try {
    const { supabase, user, profile } = await requireAuth()

    const page     = params?.page     || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from     = (page - 1) * pageSize
    const to       = from + pageSize - 1

    let query = supabase
      .from('guest_passes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (profile.role === 'resident') {
      query = query.eq('resident_id', user.id)
    } else if (params?.residentId) {
      query = query.eq('resident_id', params.residentId)
    }
    if (params?.status)  query = query.eq('status', params.status)
    if (params?.search) {
      query = query.or(
        `guest_name.ilike.%${params.search}%,guest_id.ilike.%${params.search}%,apartment_number.ilike.%${params.search}%,purpose.ilike.%${params.search}%`
      )
    }

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    const parsedData = (data || []).map(parsePass)

    return {
      success: true,
      data: {
        data: parsedData,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch guest passes' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESIDENT DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════
export async function getResidentGuestPassStats(): Promise<ActionResult<DashboardStats>> {
  try {
    const { supabase, user } = await requireAuth()

    const { data: passes, error: passErr } = await supabase
      .from('guest_passes')
      .select('id, status, expiry_time, valid_from, allowed_persons, entered_count')
      .eq('resident_id', user.id)
      .is('archived_at', null)

    if (passErr) return { success: false, error: passErr.message }

    const passIds = (passes || []).map((p) => p.id)

    const [completedRes, insideRes, penaltiesRes] = await Promise.all([
      passIds.length > 0
        ? supabase.from('entry_logs').select('*', { count: 'exact', head: true })
            .in('guest_pass_id', passIds).eq('status', 'completed')
        : Promise.resolve({ count: 0 }),
      passIds.length > 0
        ? supabase.from('entry_logs').select('guest_pass_id, entry_time, expected_exit_at, exit_time')
            .in('guest_pass_id', passIds).is('exit_time', null)
        : Promise.resolve({ data: [] }),
      supabase.from('penalties')
        .select('*', { count: 'exact', head: true })
        .eq('resident_id', user.id)
        .eq('status', 'pending'),
    ])

    const now = new Date()
    // insideNow: exit_time IS NULL
    const insideNow = (insideRes.data || []).filter(el => !el.exit_time).length
    // upcomingCount: valid_from in the future
    const upcomingCount = (passes || []).filter(p =>
      p.valid_from && new Date(p.valid_from) > now && p.status === 'valid'
    ).length
    // overstay: inside AND now > expected_exit_at
    const overstayCount = (insideRes.data || []).filter(el => {
      if (el.exit_time) return false
      if (!el.expected_exit_at) return false
      return new Date(el.expected_exit_at) < now
    }).length

    const total   = passes?.length || 0
    const active  = passes?.filter((p) => getComputedPassStatus(p) === 'valid').length   || 0
    const expired = passes?.filter((p) => getComputedPassStatus(p) === 'expired').length || 0
    const revoked = passes?.filter((p) => p.status === 'revoked').length                 || 0
    const used    = passes?.filter((p) => (p as any).status === 'used').length           || 0

    return {
      success: true,
      data: {
        totalGuests:    total,
        activeGuests:   active,
        expiredPasses:  expired,
        revokedPasses:  revoked,
        usedPasses:     used,
        completedVisits: completedRes.count || 0,
        overstayCount,
        insideNow,
        upcomingCount,
        penaltiesDue: penaltiesRes.count || 0,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch stats' }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// REVOKE PASS
// ═══════════════════════════════════════════════════════════════════════════
export async function revokeGuestPass(input: unknown): Promise<ActionResult> {
  try {
    const validated = revokePassSchema.parse(input)
    const { supabase, user, profile } = await requireAuth()

    const { data: pass } = await supabase
      .from('guest_passes')
      .select('resident_id, status, guest_name')
      .eq('id', validated.passId)
      .single()

    if (!pass) return { success: false, error: 'Guest pass not found' }

    const isAdmin = profile.role === 'admin'
    const isOwner = pass.resident_id === user.id

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'Not authorized to revoke this pass' }
    }
    if (pass.status === 'revoked') {
      return { success: false, error: 'Pass is already revoked' }
    }

    const { error } = await supabase
      .from('guest_passes')
      .update({ status: 'revoked' })
      .eq('id', validated.passId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'pass.revoked', entity_type: 'guest_pass', entity_id: validated.passId,
      metadata: { reason: validated.reason, guest_name: pass.guest_name },
    })

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to revoke pass' }
  }
}

export async function updateGuestPassStatus(
  guestPassId: string,
  status: string,
  _adminOverride?: boolean
): Promise<ActionResult> {
  if (status === 'revoked') {
    return revokeGuestPass({ passId: guestPassId })
  }
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }
    const { error } = await supabase
      .from('guest_passes')
      .update({ status })
      .eq('id', guestPassId)
    if (error) return { success: false, error: error.message }
    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'pass.status_changed', entity_type: 'guest_pass', entity_id: guestPassId,
      metadata: { new_status: status },
    })
    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to update status' }
  }
}

export async function archiveGuestPass(guestPassId: string, reason: string): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Only admins can archive passes' }

    const { data: pass } = await supabase
      .from('guest_passes').select('guest_name, apartment_number')
      .eq('id', guestPassId).single()
    if (!pass) return { success: false, error: 'Guest pass not found' }

    const { error } = await supabase
      .from('guest_passes')
      .update({ status: 'revoked' })
      .eq('id', guestPassId)
    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'pass.archived', entity_type: 'guest_pass', entity_id: guestPassId,
      metadata: { reason, guest_name: pass.guest_name },
    })
    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to archive pass' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY TOKEN
// ═══════════════════════════════════════════════════════════════════════════
export async function verifyGuestToken(token: string): Promise<ActionResult<VerifyTokenResult>> {
  try {
    const tokenClean = (token || '').trim()
    if (!tokenClean) {
      return { success: true, data: { valid: false, status: 'not_found', message: 'Token is required' } }
    }

    const supabase = await createClient()
    const isGateCode = /^\d{6}$/.test(tokenClean)

    let passRow: any = null

    if (isGateCode) {
      const { data } = await supabase
        .from('guest_passes')
        .select('*, resident:resident_id (id, full_name, email, apartment_number, phone_number)')
        .eq('gate_code', tokenClean)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      passRow = data
    } else {
      // First try by qr_token
      const { data } = await supabase
        .from('guest_passes')
        .select('*, resident:resident_id (id, full_name, email, apartment_number, phone_number)')
        .eq('qr_token', tokenClean)
        .is('archived_at', null)
        .maybeSingle()
      passRow = data

      // If not found, try by guest_id
      if (!passRow) {
        const { data: byGuestId } = await supabase
          .from('guest_passes')
          .select('*, resident:resident_id (id, full_name, email, apartment_number, phone_number)')
          .eq('guest_id', tokenClean)
          .is('archived_at', null)
          .maybeSingle()
        passRow = byGuestId
      }

      // If still not found, try gate_code
      if (!passRow) {
        const { data: byGateCode } = await supabase
          .from('guest_passes')
          .select('*, resident:resident_id (id, full_name, email, apartment_number, phone_number)')
          .eq('gate_code', tokenClean)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        passRow = byGateCode
      }
    }

    if (!passRow) {
      return { success: true, data: { valid: false, status: 'not_found', message: 'Guest pass not found' } }
    }

    const parsed = parsePass(passRow)
    const resident = passRow.resident || null

    if (parsed.status === 'revoked') {
      return {
        success: true,
        data: {
          valid: false,
          status: 'revoked',
          message: 'Pass has been revoked by the resident',
          guest_pass: parsed,
          resident,
        },
      }
    }

    // Check if already inside
    const { data: existingLog } = await supabase
      .from('entry_logs')
      .select('id, entry_time, exit_time, status')
      .eq('guest_pass_id', parsed.id)
      .eq('status', 'inside')
      .maybeSingle()

    if (existingLog) {
      return {
        success: true,
        data: {
          valid: false,
          status: 'already_inside',
          message: 'Guest is already inside the building',
          guest_pass: parsed,
          resident,
          entry_log_id: existingLog.id,
          entry_time: existingLog.entry_time,
        },
      }
    }

    // Check if expired
    if (new Date(parsed.expiry_time) < new Date()) {
      return {
        success: true,
        data: {
          valid: false,
          status: 'expired',
          message: 'This guest pass has expired',
          guest_pass: parsed,
          resident,
        },
      }
    }

    return {
      success: true,
      data: {
        valid: true,
        status: 'valid',
        message: 'Guest pass is valid',
        guest_pass: parsed,
        resident,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to verify token' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IN GUEST
// ═══════════════════════════════════════════════════════════════════════════
export async function checkInGuest(input: unknown): Promise<ActionResult<EntryLog>> {
  try {
    const validated = checkInGuestSchema.parse(input)
    const { supabase, user, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only security guards can check in guests' }
    }

    // ── Rate limit ──────────────────────────────────────────────────────
    const { blocked, lockedUntil } = await checkRateLimit(supabase, user.id)
    if (blocked) {
      await logAccessAttempt(supabase, {
        token_used: validated.token, result: 'rate_limited', guard_id: user.id, pass_id: null,
      })
      const until = lockedUntil
        ? new Date(lockedUntil).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })
        : 'a few minutes'
      return { success: false, error: `Too many attempts. Lookup locked until ${until}.` }
    }

    const tokenClean = validated.token.trim()
    const isGateCode = /^\d{6}$/.test(tokenClean)

    let guestPassRow: any = null

    if (isGateCode) {
      const { data } = await supabase
        .from('guest_passes')
        .select('*')
        .eq('gate_code', tokenClean)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      guestPassRow = data
    } else {
      const { data } = await supabase
        .from('guest_passes')
        .select('*')
        .eq('qr_token', tokenClean)
        .is('archived_at', null)
        .maybeSingle()
      guestPassRow = data

      if (!guestPassRow) {
        const { data: byGuestId } = await supabase
          .from('guest_passes')
          .select('*')
          .eq('guest_id', tokenClean)
          .is('archived_at', null)
          .maybeSingle()
        guestPassRow = byGuestId
      }
    }

    if (!guestPassRow) {
      await logAccessAttempt(supabase, {
        token_used: tokenClean, result: 'pass_not_found', guard_id: user.id, pass_id: null,
      })
      return { success: false, error: 'Guest pass not found. Check the QR code or gate code.' }
    }

    const guestPass = parsePass(guestPassRow)

    const deny = async (result: AccessAttempt['result'], message: string) => {
      await logAccessAttempt(supabase, {
        token_used: tokenClean, result, guard_id: user.id, pass_id: guestPass.id,
      })
      return { success: false as const, error: message }
    }

    if (guestPass.status === 'revoked') return deny('revoked', 'ACCESS DENIED — this pass has been revoked by the resident.')

    const now = new Date()
    if (guestPass.valid_from && now < new Date(guestPass.valid_from) && !validated.allowEarly) {
      const when = new Date(guestPass.valid_from).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit',
      })
      return deny('too_early', `Too early — this pass is not valid until ${when}.`)
    }

    const computedStatus = getComputedPassStatus(guestPass)
    if (computedStatus === 'expired') return deny('expired', 'This guest pass has expired.')

    const { data: existingLog } = await supabase
      .from('entry_logs').select('id, status')
      .eq('guest_pass_id', guestPass.id)
      .eq('status', 'inside')
      .maybeSingle()

    if (existingLog) return deny('already_inside', 'Guest is already inside the building.')

    const personsAdmitted = validated.personsAdmitted ?? 1

    const { data: entryLog, error: logError } = await supabase
      .from('entry_logs')
      .insert({
        guest_pass_id:     guestPass.id,
        security_guard_id: user.id,
        guard_id:          user.id,
        entry_time:        now.toISOString(),
        status:            'inside',
        expected_exit_at:  guestPass.expiry_time,
        visitor_type:      'one_time',
        id_type:           validated.idType || null,
        identity_id_type:  validated.idType || null,
        identity_verified: validated.identityVerified ?? false,
        persons_admitted:  personsAdmitted,
        entry_photo_url:   validated.entryPhotoUrl || null,
        entry_photo_path:  validated.entryPhotoUrl || null,
        notes:             null,
      })
      .select()
      .single()

    if (logError) return { success: false, error: logError.message }

    // Increment entered_count on the pass
    await supabase
      .from('guest_passes')
      .update({ entered_count: (guestPass.entered_count ?? 0) + personsAdmitted })
      .eq('id', guestPass.id)

    // Audit log
    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role as any,
      action: 'checkin.allowed', entity_type: 'entry_logs', entity_id: entryLog.id,
      metadata: { pass_id: guestPass.id, guest_name: guestPass.guest_name, persons_admitted: personsAdmitted },
    })

    // Notify resident
    try {
      const { writeNotification } = await import('./notifications')
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit',
      })
      await writeNotification(supabase, {
        recipient_id: guestPass.resident_id,
        type:         'checkin',
        title:        'Guest Checked In',
        body:         `${guestPass.guest_name} entered at ${timeStr}`,
        metadata: {
          pass_id:      guestPass.id,
          entry_log_id: entryLog.id,
          guest_name:   guestPass.guest_name,
          entry_time:   now.toISOString(),
        },
      })
    } catch {
      // non-fatal
    }

    revalidatePath('/dashboard/security')
    revalidatePath('/dashboard/admin')
    return { success: true, data: entryLog }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to check in guest' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK OUT GUEST
// ═══════════════════════════════════════════════════════════════════════════
export async function checkOutGuest(input: unknown): Promise<ActionResult> {
  try {
    const validated = checkOutGuestSchema.parse(input)
    const { supabase, user, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only security guards can check out guests' }
    }

    // Fetch the entry log to verify ownership and compute overstay
    const { data: log, error: fetchErr } = await supabase
      .from('entry_logs')
      .select('id, status, entry_time, expected_exit_at, guest_pass_id')
      .eq('id', validated.entryLogId)
      .in('status', ['inside', 'overstay'])
      .maybeSingle()

    if (fetchErr || !log) {
      return { success: false, error: fetchErr?.message ?? 'Entry log not found or already checked out' }
    }

    // Fetch grace period from policy (server-side, never from client)
    const { DEFAULT_OVERSTAY_GRACE_MINUTES, computeVisitStatus } = await import('@/lib/visit-status')
    let graceMin = DEFAULT_OVERSTAY_GRACE_MINUTES
    try {
      const { getPolicy } = await import('./policy')
      const policyResult = await getPolicy()
      if (policyResult.success && policyResult.data) {
        graceMin = policyResult.data.overstay_grace_minutes
      }
    } catch { /* use default */ }

    const visitStatus = computeVisitStatus(log as any, graceMin)
    const exitTime = new Date()

    const { error } = await supabase
      .from('entry_logs')
      .update({
        exit_time:     exitTime.toISOString(),
        status:        'completed',
        checkout_type: 'manual',
      })
      .eq('id', log.id)

    if (error) return { success: false, error: error.message }

    // Write audit log
    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role as any,
      action: 'checkout.manual', entity_type: 'entry_logs', entity_id: log.id,
      metadata: {
        pass_id:         log.guest_pass_id,
        overstay_minutes: visitStatus.overstayMinutes,
        exit_time:       exitTime.toISOString(),
      },
    })

    // Notify host resident (non-fatal)
    try {
      if (log.guest_pass_id) {
        const { data: pass } = await supabase
          .from('guest_passes')
          .select('resident_id, guest_name')
          .eq('id', log.guest_pass_id)
          .maybeSingle()
        if (pass) {
          const { writeNotification } = await import('./notifications')
          const timeStr = exitTime.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit',
          })
          await writeNotification(supabase, {
            recipient_id: pass.resident_id,
            type:         'checkout',
            title:        'Guest Checked Out',
            body:         `${pass.guest_name} left at ${timeStr}${
              visitStatus.isOverstay ? ` (${visitStatus.overstayLabel})` : ''
            }`,
            metadata: {
              entry_log_id:    log.id,
              overstay_minutes: visitStatus.overstayMinutes,
            },
          })
        }
      }
    } catch { /* non-fatal */ }

    revalidatePath('/dashboard/security')
    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to check out guest' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN CLOSE ENTRY
// ═══════════════════════════════════════════════════════════════════════════
export async function adminCloseEntry(entryLogId: string, notes?: string): Promise<ActionResult> {
  try {
    const { supabase, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Only admins can force-close entries' }

    const { error } = await supabase
      .from('entry_logs')
      .update({
        exit_time: new Date().toISOString(),
        status: 'completed',
        notes: notes || 'Closed by admin',
      })
      .eq('id', entryLogId)
      .eq('status', 'inside')

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/admin')
    revalidatePath('/dashboard/security')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to close entry' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ENTRY LOGS
// ═══════════════════════════════════════════════════════════════════════════
export async function getEntryLogs(params?: {
  page?: number; pageSize?: number; search?: string; status?: string; dateFrom?: string; dateTo?: string
}): Promise<ActionResult<PaginatedResult<any>>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const page     = params?.page     || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from     = (page - 1) * pageSize
    const to       = from + pageSize - 1

    let query = supabase
      .from('entry_logs')
      .select(`
        *,
        guest_pass:guest_pass_id (
          id, guest_name, guest_id, apartment_number, purpose,
          guest_phone, visit_date, visit_time, expiry_time, duration_hours,
          resident:resident_id ( id, full_name, apartment_number, phone_number )
        ),
        security_guard:security_guard_id ( id, full_name )
      `, { count: 'exact' })
      .order('entry_time', { ascending: false })
      .range(from, to)

    if (params?.status) {
      if (params.status === 'overstay') {
        query = query.eq('status', 'inside')
      } else {
        query = query.eq('status', params.status)
      }
    }
    if (params?.dateFrom) query = query.gte('entry_time', params.dateFrom)
    if (params?.dateTo)   query = query.lte('entry_time', params.dateTo + 'T23:59:59')

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    const formatted = (data || []).map((row: any) => {
      const pass = row.guest_pass ? parsePass(row.guest_pass) : null
      const parsedLog = parseLog(row)
      const expectedExit = parsedLog.expected_exit_at || pass?.expiry_time || null
      const vs = computeVisitStatus({
        ...parsedLog,
        expected_exit_at: expectedExit,
      })
      return {
        ...parsedLog,
        status: vs.isOverstay ? 'overstay' : parsedLog.status,
        expected_exit_at: expectedExit,
        guest_pass: pass,
      }
    })

    return {
      success: true,
      data: { data: formatted, total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch entry logs' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET TODAY'S VISITORS (Asia/Dhaka Calendar Day)
// ═══════════════════════════════════════════════════════════════════════════
export async function getTodaysVisitors(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const dhakaToday = getDhakaToday()

    const { data, error } = await supabase
      .from('entry_logs')
      .select(`
        *,
        guest_pass:guest_pass_id (
          id, guest_name, guest_id, apartment_number, purpose,
          guest_phone, visit_date, visit_time, expiry_time,
          resident:resident_id ( id, full_name, phone_number )
        ),
        security_guard:security_guard_id ( full_name )
      `)
      .order('entry_time', { ascending: false })
      .limit(300)

    if (error) return { success: false, error: error.message }

    const formatted = (data || [])
      .filter((row: any) => getDhakaDateOf(row.entry_time) === dhakaToday)
      .map((row: any) => {
        const pass = row.guest_pass ? parsePass(row.guest_pass) : null
        const parsedLog = parseLog(row)
        return {
          ...parsedLog,
          expected_exit_at: parsedLog.expected_exit_at || pass?.expiry_time || null,
          guest_pass: pass,
        }
      })

    return { success: true, data: formatted }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: "Failed to fetch today's visitors" }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET OVERSTAYS (Single Source of Truth via computeVisitStatus)
// ═══════════════════════════════════════════════════════════════════════════
export async function getOverstays(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('entry_logs')
      .select(`
        *,
        guest_pass:guest_pass_id (
          id, guest_name, guest_id, apartment_number, purpose,
          guest_phone, expiry_time,
          resident:resident_id ( id, full_name, phone_number )
        )
      `)
      .is('exit_time', null)
      .order('entry_time', { ascending: true })

    if (error) return { success: false, error: error.message }

    const overstays = (data || [])
      .map((row: any) => {
        const pass = row.guest_pass ? parsePass(row.guest_pass) : null
        const parsedLog = parseLog(row)
        return {
          ...parsedLog,
          expected_exit_at: parsedLog.expected_exit_at || pass?.expiry_time || null,
          guest_pass: pass,
        }
      })
      .filter((row: any) => {
        if (!row.expected_exit_at) return false
        return computeVisitStatus(row).isOverstay
      })

    return { success: true, data: overstays }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch overstays' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH GUESTS
// ═══════════════════════════════════════════════════════════════════════════
export async function searchGuests(query: string): Promise<ActionResult<GuestSearchResult[]>> {
  try {
    if (!query || query.trim().length < 2) return { success: true, data: [] }

    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const q = query.trim()

    const { data, error } = await supabase
      .from('guest_passes')
      .select(`
        id, guest_id, guest_name, guest_phone, apartment_number, purpose,
        visit_date, visit_time, expiry_time, duration_hours,
        status, qr_token, gate_code, valid_from, allowed_persons, entered_count,
        guest_photo_url, guest_photo_path,
        resident:resident_id ( full_name, phone_number )
      `)
      .or(`guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,apartment_number.ilike.%${q}%,gate_code.ilike.%${q}%,guest_id.ilike.%${q}%`)
      .is('archived_at', null)
      .order('visit_date', { ascending: false })
      .limit(20)

    if (error) return { success: false, error: error.message }

    const results: GuestSearchResult[] = (data || []).map((row: any) => {
      const pass = parsePass(row)
      return {
        id:              pass.id,
        guest_name:      pass.guest_name,
        guest_phone:     pass.guest_phone,
        apartment_number: pass.apartment_number,
        purpose:         pass.purpose,
        visit_date:      pass.visit_date,
        visit_time:      pass.visit_time,
        valid_from:      pass.valid_from,
        expiry_time:     pass.expiry_time,
        duration_hours:  pass.duration_hours,
        allowed_persons: pass.allowed_persons,
        entered_count:   pass.entered_count,
        status:          pass.status,
        qr_token:        pass.qr_token,
        gate_code:       pass.gate_code,
        guest_photo_url: pass.guest_photo_url,
        resident_name:   row.resident?.full_name   || null,
        resident_phone:  row.resident?.phone_number || null,
      }
    })

    return { success: true, data: results }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Search failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ACCESS ATTEMPTS (safe placeholder)
// ═══════════════════════════════════════════════════════════════════════════
export async function getAccessAttempts(_params?: {
  page?: number; pageSize?: number; guardId?: string; passId?: string; dateFrom?: string
}): Promise<ActionResult<PaginatedResult<any>>> {
  return {
    success: true,
    data: { data: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET PASS PUBLIC INFO
// ═══════════════════════════════════════════════════════════════════════════
export async function getPassPublicInfo(token: string): Promise<ActionResult<{
  guest_name: string
  apartment_number: string
  visit_date: string
  visit_time: string
  valid_from: string | null
  expiry_time: string
  duration_hours: number
  purpose: string
  qr_token: string
  gate_code: string | null
  allowed_persons: number
  status: string
  guest_photo_url: string | null
  members: { full_name: string; relation: string; is_minor: boolean }[]
}>> {
  try {
    const supabase = await createClient()

    const { data: passRow, error } = await supabase
      .from('guest_passes')
      .select('*')
      .eq('qr_token', token)
      .maybeSingle()

    if (error || !passRow) return { success: false, error: 'Pass not found' }

    const pass = parsePass(passRow)

    return {
      success: true,
      data: {
        guest_name:      pass.guest_name,
        apartment_number: pass.apartment_number,
        visit_date:      pass.visit_date,
        visit_time:      pass.visit_time,
        valid_from:      pass.valid_from,
        expiry_time:     pass.expiry_time,
        duration_hours:  pass.duration_hours,
        purpose:         pass.purpose,
        qr_token:        pass.qr_token,
        gate_code:       pass.gate_code,
        allowed_persons: pass.allowed_persons,
        status:          pass.status,
        guest_photo_url: pass.guest_photo_url,
        members:         [],
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch pass info' }
  }
}
