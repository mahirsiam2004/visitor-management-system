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
  AuditAction,
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
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.is_active === false) throw new Error('Your account has been deactivated')
  return { supabase, user, profile }
}

// ─── Rate-limit helper (per guard, 10 lookups / 60 s) ─────────────────────
async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guardId: string
): Promise<{ blocked: boolean; lockedUntil?: string }> {
  const now = new Date()

  const { data: row } = await supabase
    .from('guard_rate_limits')
    .select('*')
    .eq('guard_id', guardId)
    .single()

  if (row?.locked_until && new Date(row.locked_until) > now) {
    return { blocked: true, lockedUntil: row.locked_until }
  }

  const windowStart = row?.window_start ? new Date(row.window_start) : now
  const windowAgeSeconds = (now.getTime() - windowStart.getTime()) / 1000

  if (windowAgeSeconds > RATE_LIMIT_WINDOW_SECONDS || !row) {
    // Reset window
    await supabase.from('guard_rate_limits').upsert({
      guard_id: guardId,
      attempt_count: 1,
      window_start: now.toISOString(),
      locked_until: null,
    })
    return { blocked: false }
  }

  const newCount = (row.attempt_count || 0) + 1
  if (newCount > RATE_LIMIT_MAX_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + RATE_LIMIT_LOCKOUT_MINUTES * 60 * 1000).toISOString()
    await supabase.from('guard_rate_limits').upsert({
      guard_id: guardId,
      attempt_count: newCount,
      window_start: row.window_start,
      locked_until: lockedUntil,
    })
    return { blocked: true, lockedUntil }
  }

  await supabase.from('guard_rate_limits').upsert({
    guard_id: guardId,
    attempt_count: newCount,
    window_start: row.window_start,
    locked_until: null,
  })
  return { blocked: false }
}

// ─── Log access attempt ────────────────────────────────────────────────────
async function logAccessAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    token_used: string | null
    result: AccessAttempt['result']
    guard_id: string | null
    pass_id: string | null
  }
) {
  await supabase.from('access_attempts').insert(params).select('id').single()
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
        guest_id:        guestId,
        guest_name:      validated.guestName,
        guest_phone:     validated.guestPhone || null,
        resident_id:     user.id,
        apartment_number: fullProfile.apartment_number,
        visit_date:      validated.visitDate,
        visit_time:      validated.visitTime,
        valid_from:      validFrom.toISOString(),
        expiry_time:     expiryTime.toISOString(),
        duration_hours:  validated.durationHours,
        purpose:         validated.purpose,
        qr_token:        qrToken,
        gate_code:       gateCode,
        status:          'valid',
        allowed_persons: validated.allowedPersons,
        entered_count:   0,
        guest_photo_url: validated.guestPhotoUrl || null,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Insert companions
    if (validated.companions && validated.companions.length > 0) {
      const members = validated.companions.map((c) => ({
        guest_pass_id: data.id,
        full_name:     c.full_name,
        relation:      c.relation,
        is_minor:      c.is_minor,
      }))
      const { error: memberErr } = await supabase
        .from('guest_pass_members')
        .insert(members)
      if (memberErr) console.error('[createGuestPass] companion insert error:', memberErr.message)
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'pass.created', entity_type: 'guest_pass', entity_id: data.id,
      metadata: {
        guest_name:      data.guest_name,
        apartment:       data.apartment_number,
        purpose:         data.purpose,
        allowed_persons: validated.allowedPersons,
        companions:      validated.companions?.length ?? 0,
      },
    })

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')
    return { success: true, data }
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
      .is('archived_at', null)
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

    return {
      success: true,
      data: {
        data: data || [],
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
      .select('id, status, expiry_time')
      .eq('resident_id', user.id)
      .is('archived_at', null)

    if (passErr) return { success: false, error: passErr.message }

    const passIds = (passes || []).map((p) => p.id)

    const [completedRes, overstayRes] = await Promise.all([
      passIds.length > 0
        ? supabase.from('entry_logs').select('*', { count: 'exact', head: true })
            .in('guest_pass_id', passIds).eq('status', 'completed')
        : Promise.resolve({ count: 0 }),
      passIds.length > 0
        ? supabase.from('entry_logs').select('*', { count: 'exact', head: true })
            .in('guest_pass_id', passIds).eq('status', 'overstay')
        : Promise.resolve({ count: 0 }),
    ])

    const total   = passes?.length || 0
    const active  = passes?.filter((p) => getComputedPassStatus(p) === 'valid').length   || 0
    const expired = passes?.filter((p) => getComputedPassStatus(p) === 'expired').length || 0
    const revoked = passes?.filter((p) => p.status === 'revoked').length                 || 0
    const used    = passes?.filter((p) => p.status === 'used').length                    || 0

    return {
      success: true,
      data: {
        totalGuests:    total,
        activeGuests:   active,
        expiredPasses:  expired,
        revokedPasses:  revoked,
        usedPasses:     used,
        completedVisits: completedRes.count || 0,
        overstayCount:  overstayRes.count  || 0,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch stats' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REVOKE PASS (resident — with reason + provenance)
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

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('guest_passes')
      .update({
        status:       'revoked',
        revoked_at:   now,
        revoked_by:   user.id,
        revoke_reason: validated.reason?.trim() || null,
      })
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

// Keep old name as alias for backward compat in admin pages
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

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE PASS (admin)
// ═══════════════════════════════════════════════════════════════════════════
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
      .update({ archived_at: new Date().toISOString(), archived_by: user.id, archive_reason: reason.trim() || 'Archived by admin' })
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
// VERIFY TOKEN (public — no auth, used by /verify/[token] page)
// ═══════════════════════════════════════════════════════════════════════════
export async function verifyGuestToken(token: string): Promise<ActionResult<VerifyTokenResult>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('verify_guest_token', { p_token: token })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as VerifyTokenResult }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to verify token' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IN GUEST — with time window, headcount, id_type, access_attempts
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

    // ── Identify pass (UUID token or 6-digit gate code) ─────────────────
    const tokenClean = validated.token.trim()
    const isGateCode = /^\d{6}$/.test(tokenClean)

    let passQuery = supabase.from('guest_passes').select('*')
    if (isGateCode) {
      passQuery = passQuery.eq('gate_code', tokenClean)
    } else {
      passQuery = passQuery.eq('qr_token', tokenClean)
    }

    const { data: guestPass, error: passError } = await passQuery.single()

    if (passError || !guestPass) {
      await logAccessAttempt(supabase, {
        token_used: tokenClean, result: 'pass_not_found', guard_id: user.id, pass_id: null,
      })
      await writeAuditLog({
        supabase, actor_id: user.id, actor_role: profile.role,
        action: 'checkin.denied', entity_type: 'guest_pass', entity_id: null,
        metadata: { reason: 'pass_not_found', token: tokenClean },
      })
      return { success: false, error: 'Guest pass not found. Check the QR code or gate code.' }
    }

    const deny = async (result: AccessAttempt['result'], message: string) => {
      await logAccessAttempt(supabase, {
        token_used: tokenClean, result, guard_id: user.id, pass_id: guestPass.id,
      })
      await writeAuditLog({
        supabase, actor_id: user.id, actor_role: profile.role,
        action: 'checkin.denied', entity_type: 'guest_pass', entity_id: guestPass.id,
        metadata: { reason: result, guest_name: guestPass.guest_name },
      })
      return { success: false as const, error: message }
    }

    // ── Archived ────────────────────────────────────────────────────────
    if (guestPass.archived_at) return deny('archived', 'This guest pass has been archived.')

    // ── Revoked ─────────────────────────────────────────────────────────
    if (guestPass.status === 'revoked') return deny('revoked', 'ACCESS DENIED — this pass has been revoked by the resident.')

    // ── Used ────────────────────────────────────────────────────────────
    if (guestPass.status === 'used') return deny('used', 'This pass has already been used.')

    // ── Time window: too early ──────────────────────────────────────────
    const now = new Date()
    if (guestPass.valid_from && now < new Date(guestPass.valid_from)) {
      const when = new Date(guestPass.valid_from).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit',
      })
      return deny('too_early', `Too early — this pass is not valid until ${when}.`)
    }

    // ── Expired ─────────────────────────────────────────────────────────
    const computedStatus = getComputedPassStatus(guestPass)
    if (computedStatus === 'expired') return deny('expired', 'This guest pass has expired.')

    // ── Headcount ───────────────────────────────────────────────────────
    const personsAdmitted = validated.personsAdmitted ?? 1
    if (guestPass.entered_count + personsAdmitted > guestPass.allowed_persons) {
      return deny(
        'limit_exceeded',
        `Visitor limit exceeded. ${guestPass.entered_count}/${guestPass.allowed_persons} already admitted.`
      )
    }

    // ── Already inside ──────────────────────────────────────────────────
    const { data: existingLog } = await supabase
      .from('entry_logs').select('id, status')
      .eq('guest_pass_id', guestPass.id)
      .in('status', ['inside', 'overstay'])
      .single()
    if (existingLog) return deny('already_inside', 'Guest is already inside the building.')

    // ── No duplicate completed (if single-person pass) ──────────────────
    if (guestPass.allowed_persons === 1) {
      const { data: completedLog } = await supabase
        .from('entry_logs').select('id')
        .eq('guest_pass_id', guestPass.id).eq('status', 'completed').single()
      if (completedLog) return deny('used', 'Guest has already completed their visit.')
    }

    // ── Insert entry log ────────────────────────────────────────────────
    const { data: entryLog, error: logError } = await supabase
      .from('entry_logs')
      .insert({
        guest_pass_id:     guestPass.id,
        security_guard_id: user.id,
        entry_time:        now.toISOString(),
        expected_exit_at:  guestPass.expiry_time,
        status:            'inside',
        id_type:           validated.idType,
        identity_verified: validated.identityVerified,
        persons_admitted:  personsAdmitted,
        entry_photo_url:   validated.entryPhotoUrl || null,
      })
      .select()
      .single()

    if (logError) return { success: false, error: logError.message }

    // ── Increment entered_count ─────────────────────────────────────────
    await supabase
      .from('guest_passes')
      .update({ entered_count: guestPass.entered_count + personsAdmitted })
      .eq('id', guestPass.id)

    // ── Notify resident ─────────────────────────────────────────────────
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
    } catch (notifErr) {
      console.error('[checkInGuest] notification error:', notifErr)
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'checkin.allowed', entity_type: 'entry_log', entity_id: entryLog.id,
      metadata: {
        guest_name:      guestPass.guest_name,
        apartment:       guestPass.apartment_number,
        id_type:         validated.idType,
        persons_admitted: personsAdmitted,
      },
    })

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

    const { data: logRow } = await supabase
      .from('entry_logs').select('id, guest_pass_id, status, entry_time')
      .eq('id', validated.entryLogId).single()

    const { error } = await supabase
      .from('entry_logs')
      .update({ exit_time: new Date().toISOString(), status: 'completed', checkout_type: 'manual' })
      .eq('id', validated.entryLogId)
      .in('status', ['inside', 'overstay'])

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'checkout.manual', entity_type: 'entry_log', entity_id: validated.entryLogId,
      metadata: { was_overstay: logRow?.status === 'overstay', entry_time: logRow?.entry_time },
    })

    revalidatePath('/dashboard/security')
    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to check out guest' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN CLOSE STALE ENTRY
// ═══════════════════════════════════════════════════════════════════════════
export async function adminCloseEntry(entryLogId: string, notes?: string): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Only admins can force-close entries' }

    const { data: logRow } = await supabase
      .from('entry_logs').select('entry_time, status, guest_pass_id').eq('id', entryLogId).single()
    if (!logRow) return { success: false, error: 'Entry log not found' }

    const { error } = await supabase
      .from('entry_logs')
      .update({ exit_time: new Date().toISOString(), status: 'completed', checkout_type: 'admin_closed', notes: notes || 'Closed by admin' })
      .eq('id', entryLogId)
    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'checkout.admin_closed', entity_type: 'entry_log', entity_id: entryLogId,
      metadata: { notes, was_overstay: logRow.status === 'overstay' },
    })

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
          guest_name, guest_id, apartment_number, purpose,
          guest_phone, visit_date, visit_time, expiry_time, duration_hours,
          allowed_persons, entered_count,
          resident:resident_id ( id, full_name, apartment_number, phone_number )
        ),
        security_guard:security_guard_id ( id, full_name )
      `, { count: 'exact' })
      .order('entry_time', { ascending: false })
      .range(from, to)

    if (params?.status)  query = query.eq('status', params.status)
    if (params?.dateFrom) query = query.gte('entry_time', params.dateFrom)
    if (params?.dateTo)   query = query.lte('entry_time', params.dateTo + 'T23:59:59')

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { data: data || [], total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch entry logs' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET TODAY'S VISITORS
// ═══════════════════════════════════════════════════════════════════════════
export async function getTodaysVisitors(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const now = new Date()
    const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const endOfDayUTC   = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000 - 1)

    const { data, error } = await supabase
      .from('entry_logs')
      .select(`
        *,
        guest_pass:guest_pass_id (
          guest_name, guest_id, apartment_number, purpose,
          guest_phone, visit_date, visit_time, expiry_time, allowed_persons, entered_count,
          resident:resident_id ( id, full_name, phone_number )
        ),
        security_guard:security_guard_id ( full_name )
      `)
      .gte('entry_time', startOfDayUTC.toISOString())
      .lte('entry_time', endOfDayUTC.toISOString())
      .order('entry_time', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: "Failed to fetch today's visitors" }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET OVERSTAYS
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
          guest_name, guest_id, apartment_number, purpose,
          guest_phone, expiry_time,
          resident:resident_id ( id, full_name, phone_number )
        )
      `)
      .eq('status', 'overstay')
      .order('overstay_started_at', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch overstays' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH GUESTS (name / phone / apartment / gate_code)
// ═══════════════════════════════════════════════════════════════════════════
export async function searchGuests(query: string): Promise<ActionResult<GuestSearchResult[]>> {
  try {
    if (!query || query.trim().length < 2) return { success: true, data: [] }

    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const q = query.trim()
    const isGateCode = /^\d{6}$/.test(q)

    let dbQuery = supabase
      .from('guest_passes')
      .select(`
        id, guest_name, guest_phone, apartment_number, purpose,
        visit_date, visit_time, valid_from, expiry_time, duration_hours,
        allowed_persons, entered_count, status, qr_token, gate_code, guest_photo_url,
        resident:resident_id ( full_name, phone_number )
      `)
      .is('archived_at', null)
      .order('visit_date', { ascending: false })
      .limit(20)

    if (isGateCode) {
      dbQuery = dbQuery.eq('gate_code', q)
    } else {
      dbQuery = dbQuery.or(
        `guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,apartment_number.ilike.%${q}%`
      )
    }

    const { data, error } = await dbQuery
    if (error) return { success: false, error: error.message }

    const results: GuestSearchResult[] = (data || []).map((row: any) => ({
      id:              row.id,
      guest_name:      row.guest_name,
      guest_phone:     row.guest_phone,
      apartment_number: row.apartment_number,
      purpose:         row.purpose,
      visit_date:      row.visit_date,
      visit_time:      row.visit_time,
      valid_from:      row.valid_from,
      expiry_time:     row.expiry_time,
      duration_hours:  row.duration_hours,
      allowed_persons: row.allowed_persons,
      entered_count:   row.entered_count,
      status:          row.status,
      qr_token:        row.qr_token,
      gate_code:       row.gate_code,
      guest_photo_url: row.guest_photo_url,
      resident_name:   row.resident?.full_name   || null,
      resident_phone:  row.resident?.phone_number || null,
    }))

    return { success: true, data: results }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Search failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ACCESS ATTEMPTS (admin / security)
// ═══════════════════════════════════════════════════════════════════════════
export async function getAccessAttempts(params?: {
  page?: number; pageSize?: number; guardId?: string; passId?: string; dateFrom?: string
}): Promise<ActionResult<PaginatedResult<any>>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const page     = params?.page     || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from     = (page - 1) * pageSize
    const to       = from + pageSize - 1

    let query = supabase
      .from('access_attempts')
      .select(`
        *,
        guard:guard_id ( full_name ),
        pass:pass_id ( guest_name, apartment_number )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params?.guardId)  query = query.eq('guard_id', params.guardId)
    if (params?.passId)   query = query.eq('pass_id', params.passId)
    if (params?.dateFrom) query = query.gte('created_at', params.dateFrom)

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { data: data || [], total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch access attempts' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET PASS WITH MEMBERS (for public pass page / verify page)
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
  members: { full_name: string; relation: string; is_minor: boolean }[]
}>> {
  try {
    const supabase = await createClient()

    const { data: pass, error } = await supabase
      .from('guest_passes')
      .select(`
        guest_name, apartment_number, visit_date, visit_time,
        valid_from, expiry_time, duration_hours, purpose,
        qr_token, gate_code, allowed_persons, status,
        guest_pass_members ( full_name, relation, is_minor )
      `)
      .eq('qr_token', token)
      .is('archived_at', null)
      .single()

    if (error || !pass) return { success: false, error: 'Pass not found' }

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
        members:         (pass as any).guest_pass_members || [],
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch pass info' }
  }
}
