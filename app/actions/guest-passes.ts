'use server'

import { createClient } from '@/lib/supabase/server'
import {
  generateQRToken,
  generateGuestId,
  calculateExpiryTime,
  isPassExpired,
  getComputedPassStatus,
} from '@/lib/utils/guest-pass'
import {
  createGuestPassSchema,
  checkInGuestSchema,
  checkOutGuestSchema,
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
  AuditAction,
} from '@/types'
import { PAGE_SIZE, OVERSTAY_GRACE_MINUTES } from '@/constants'
import { writeAuditLog } from './audit'

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// Create guest pass
// ----------------------------------------------------------------
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
      return { success: false, error: 'Please set your apartment number in your profile before creating a guest pass' }
    }

    const guestId = generateGuestId()
    const qrToken = generateQRToken()
    const expiryTime = calculateExpiryTime(
      validated.visitDate,
      validated.visitTime,
      validated.durationHours
    )

    const { data, error } = await supabase
      .from('guest_passes')
      .insert({
        guest_id: guestId,
        guest_name: validated.guestName,
        guest_phone: validated.guestPhone || null,
        resident_id: user.id,
        apartment_number: fullProfile.apartment_number,
        visit_date: validated.visitDate,
        visit_time: validated.visitTime,
        expiry_time: expiryTime.toISOString(),
        duration_hours: validated.durationHours,
        purpose: validated.purpose,
        qr_token: qrToken,
        status: 'valid',
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: profile.role,
      action: 'pass.created',
      entity_type: 'guest_pass',
      entity_id: data.id,
      metadata: { guest_name: data.guest_name, apartment: data.apartment_number, purpose: data.purpose },
    })

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')

    return { success: true, data }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to create guest pass' }
  }
}

// ----------------------------------------------------------------
// Get guest passes (paginated, filtered)
// ----------------------------------------------------------------
export async function getGuestPasses(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  residentId?: string
}): Promise<ActionResult<PaginatedResult<GuestPass>>> {
  try {
    const { supabase, user, profile } = await requireAuth()

    const page = params?.page || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('guest_passes')
      .select('*', { count: 'exact' })
      .is('archived_at', null)          // exclude archived
      .order('created_at', { ascending: false })
      .range(from, to)

    if (profile.role === 'resident') {
      query = query.eq('resident_id', user.id)
    } else if (params?.residentId) {
      query = query.eq('resident_id', params.residentId)
    }

    if (params?.status) {
      query = query.eq('status', params.status)
    }

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

// ----------------------------------------------------------------
// Resident dashboard stats — computed from expiry_time at read time
// ----------------------------------------------------------------
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

    // Count completed visits scoped to this resident's pass IDs
    const { count: completedVisits } = passIds.length > 0
      ? await supabase
          .from('entry_logs')
          .select('*', { count: 'exact', head: true })
          .in('guest_pass_id', passIds)
          .eq('status', 'completed')
      : { count: 0 }

    // Count overstays
    const { count: overstayCount } = passIds.length > 0
      ? await supabase
          .from('entry_logs')
          .select('*', { count: 'exact', head: true })
          .in('guest_pass_id', passIds)
          .eq('status', 'overstay')
      : { count: 0 }

    const total = passes?.length || 0
    // Compute status client-side using expiry_time (never stale)
    const active   = passes?.filter((p) => getComputedPassStatus(p) === 'valid').length   || 0
    const expired  = passes?.filter((p) => getComputedPassStatus(p) === 'expired').length || 0
    const revoked  = passes?.filter((p) => p.status === 'revoked').length                 || 0
    const used     = passes?.filter((p) => p.status === 'used').length                    || 0

    return {
      success: true,
      data: {
        totalGuests: total,
        activeGuests: active,
        expiredPasses: expired,
        revokedPasses: revoked,
        usedPasses: used,
        completedVisits: completedVisits || 0,
        overstayCount: overstayCount || 0,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch stats' }
  }
}

// ----------------------------------------------------------------
// Update pass status (revoke only for residents; admin can do more)
// ----------------------------------------------------------------
export async function updateGuestPassStatus(
  guestPassId: string,
  status: 'revoked'        // residents can only revoke
): Promise<ActionResult>
export async function updateGuestPassStatus(
  guestPassId: string,
  status: 'revoked' | 'valid' | 'expired' | 'used',
  adminOverride: true
): Promise<ActionResult>
export async function updateGuestPassStatus(
  guestPassId: string,
  status: string,
  adminOverride?: boolean
): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()

    const { data: guestPass } = await supabase
      .from('guest_passes')
      .select('resident_id, status, guest_name')
      .eq('id', guestPassId)
      .single()

    if (!guestPass) return { success: false, error: 'Guest pass not found' }

    const isAdmin = profile.role === 'admin'
    const isOwner = guestPass.resident_id === user.id

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'Not authorized to update this pass' }
    }

    // Residents may only revoke
    if (!isAdmin && status !== 'revoked') {
      return { success: false, error: 'Residents can only revoke passes' }
    }

    const { error } = await supabase
      .from('guest_passes')
      .update({ status })
      .eq('id', guestPassId)

    if (error) return { success: false, error: error.message }

    const action: AuditAction = status === 'revoked' ? 'pass.revoked' : 'pass.status_changed'
    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: profile.role,
      action,
      entity_type: 'guest_pass',
      entity_id: guestPassId,
      metadata: { new_status: status, guest_name: guestPass.guest_name },
    })

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to update guest pass' }
  }
}

// ----------------------------------------------------------------
// Archive pass (replaces hard-delete for admin)
// ----------------------------------------------------------------
export async function archiveGuestPass(
  guestPassId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()

    if (profile.role !== 'admin') {
      return { success: false, error: 'Only admins can archive guest passes' }
    }

    const { data: pass } = await supabase
      .from('guest_passes')
      .select('guest_name, apartment_number')
      .eq('id', guestPassId)
      .single()

    if (!pass) return { success: false, error: 'Guest pass not found' }

    const { error } = await supabase
      .from('guest_passes')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user.id,
        archive_reason: reason.trim() || 'Archived by admin',
      })
      .eq('id', guestPassId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: profile.role,
      action: 'pass.archived',
      entity_type: 'guest_pass',
      entity_id: guestPassId,
      metadata: { reason, guest_name: pass.guest_name },
    })

    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to archive guest pass' }
  }
}

// ----------------------------------------------------------------
// Verify guest token (public — no auth required)
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// Check in guest
// ----------------------------------------------------------------
export async function checkInGuest(input: unknown): Promise<ActionResult<EntryLog>> {
  try {
    const validated = checkInGuestSchema.parse(input)
    const { supabase, user, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only security guards can check in guests' }
    }

    const { data: guestPass, error: passError } = await supabase
      .from('guest_passes')
      .select('*')
      .eq('qr_token', validated.token)
      .single()

    if (passError || !guestPass) {
      await writeAuditLog({
        supabase, actor_id: user.id, actor_role: profile.role,
        action: 'checkin.denied', entity_type: 'guest_pass', entity_id: null,
        metadata: { reason: 'pass_not_found', token: validated.token },
      })
      return { success: false, error: 'Invalid QR token. Guest pass not found.' }
    }

    if (guestPass.archived_at) {
      await writeAuditLog({
        supabase, actor_id: user.id, actor_role: profile.role,
        action: 'checkin.denied', entity_type: 'guest_pass', entity_id: guestPass.id,
        metadata: { reason: 'archived', guest_name: guestPass.guest_name },
      })
      return { success: false, error: 'This guest pass has been archived.' }
    }

    const computedStatus = getComputedPassStatus(guestPass)

    if (computedStatus === 'revoked') {
      await writeAuditLog({
        supabase, actor_id: user.id, actor_role: profile.role,
        action: 'checkin.denied', entity_type: 'guest_pass', entity_id: guestPass.id,
        metadata: { reason: 'revoked', guest_name: guestPass.guest_name },
      })
      return { success: false, error: 'This guest pass has been revoked.' }
    }

    if (computedStatus === 'expired') {
      await writeAuditLog({
        supabase, actor_id: user.id, actor_role: profile.role,
        action: 'checkin.denied', entity_type: 'guest_pass', entity_id: guestPass.id,
        metadata: { reason: 'expired', guest_name: guestPass.guest_name },
      })
      return { success: false, error: 'This guest pass has expired.' }
    }

    if (computedStatus === 'used') {
      return { success: false, error: 'This pass has already been used.' }
    }

    // Block duplicate active entries
    const { data: existingLog } = await supabase
      .from('entry_logs')
      .select('id, status')
      .eq('guest_pass_id', guestPass.id)
      .in('status', ['inside', 'overstay'])
      .single()

    if (existingLog) return { success: false, error: 'Guest is already inside the building.' }

    const { data: completedLog } = await supabase
      .from('entry_logs')
      .select('id')
      .eq('guest_pass_id', guestPass.id)
      .eq('status', 'completed')
      .single()

    if (completedLog) return { success: false, error: 'Guest has already completed their visit.' }

    const expectedExitAt = guestPass.expiry_time

    const { data: entryLog, error: logError } = await supabase
      .from('entry_logs')
      .insert({
        guest_pass_id: guestPass.id,
        security_guard_id: user.id,
        entry_time: new Date().toISOString(),
        expected_exit_at: expectedExitAt,
        status: 'inside',
      })
      .select()
      .single()

    if (logError) return { success: false, error: logError.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'checkin.allowed', entity_type: 'entry_log', entity_id: entryLog.id,
      metadata: {
        guest_name: guestPass.guest_name,
        apartment: guestPass.apartment_number,
        expected_exit_at: expectedExitAt,
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

// ----------------------------------------------------------------
// Check out guest (manual)
// ----------------------------------------------------------------
export async function checkOutGuest(input: unknown): Promise<ActionResult> {
  try {
    const validated = checkOutGuestSchema.parse(input)
    const { supabase, user, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only security guards can check out guests' }
    }

    // Fetch the log to get guest info for audit
    const { data: logRow } = await supabase
      .from('entry_logs')
      .select('id, guest_pass_id, status, entry_time')
      .eq('id', validated.entryLogId)
      .single()

    const { error } = await supabase
      .from('entry_logs')
      .update({
        exit_time: new Date().toISOString(),
        status: 'completed',
        checkout_type: 'manual',
      })
      .eq('id', validated.entryLogId)
      .in('status', ['inside', 'overstay'])

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'checkout.manual', entity_type: 'entry_log', entity_id: validated.entryLogId,
      metadata: {
        was_overstay: logRow?.status === 'overstay',
        entry_time: logRow?.entry_time,
      },
    })

    revalidatePath('/dashboard/security')
    revalidatePath('/dashboard/admin')

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to check out guest' }
  }
}

// ----------------------------------------------------------------
// Admin close stale entry (checkout_type = 'admin_closed')
// ----------------------------------------------------------------
export async function adminCloseEntry(
  entryLogId: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()

    if (profile.role !== 'admin') {
      return { success: false, error: 'Only admins can force-close entries' }
    }

    const { data: logRow } = await supabase
      .from('entry_logs')
      .select('entry_time, status, guest_pass_id')
      .eq('id', entryLogId)
      .single()

    if (!logRow) return { success: false, error: 'Entry log not found' }

    const { error } = await supabase
      .from('entry_logs')
      .update({
        exit_time: new Date().toISOString(),
        status: 'completed',
        checkout_type: 'admin_closed',
        notes: notes || 'Closed by admin',
      })
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

// ----------------------------------------------------------------
// Get entry logs (paginated)
// ----------------------------------------------------------------
export async function getEntryLogs(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}): Promise<ActionResult<PaginatedResult<any>>> {
  try {
    const { supabase, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('entry_logs')
      .select(
        `
        *,
        guest_pass:guest_pass_id (
          guest_name, guest_id, apartment_number, purpose,
          guest_phone, visit_date, visit_time, expiry_time, duration_hours,
          resident:resident_id ( id, full_name, apartment_number, phone_number )
        ),
        security_guard:security_guard_id ( id, full_name )
        `,
        { count: 'exact' }
      )
      .order('entry_time', { ascending: false })
      .range(from, to)

    if (params?.status) query = query.eq('status', params.status)
    if (params?.dateFrom) query = query.gte('entry_time', params.dateFrom)
    if (params?.dateTo) query = query.lte('entry_time', params.dateTo + 'T23:59:59')

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
    return { success: false, error: 'Failed to fetch entry logs' }
  }
}

// ----------------------------------------------------------------
// Get today's visitors
// ----------------------------------------------------------------
export async function getTodaysVisitors(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    // Use UTC midnight boundaries; Supabase stores as TIMESTAMPTZ
    const now = new Date()
    const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const endOfDayUTC = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000 - 1)

    const { data, error } = await supabase
      .from('entry_logs')
      .select(
        `
        *,
        guest_pass:guest_pass_id (
          guest_name, guest_id, apartment_number, purpose,
          guest_phone, visit_date, visit_time, expiry_time,
          resident:resident_id ( id, full_name, phone_number )
        ),
        security_guard:security_guard_id ( full_name )
        `
      )
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

// ----------------------------------------------------------------
// Get current overstays
// ----------------------------------------------------------------
export async function getOverstays(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('entry_logs')
      .select(
        `
        *,
        guest_pass:guest_pass_id (
          guest_name, guest_id, apartment_number, purpose,
          guest_phone, expiry_time,
          resident:resident_id ( id, full_name, phone_number )
        )
        `
      )
      .eq('status', 'overstay')
      .order('overstay_started_at', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch overstays' }
  }
}

// ----------------------------------------------------------------
// Unified guest search (name / phone / apartment)
// ----------------------------------------------------------------
export async function searchGuests(query: string): Promise<ActionResult<GuestSearchResult[]>> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, data: [] }
    }
    const { supabase, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const q = query.trim()

    const { data, error } = await supabase
      .from('guest_passes')
      .select(
        `
        id, guest_name, guest_phone, apartment_number, purpose,
        visit_date, visit_time, expiry_time, duration_hours, status, qr_token,
        resident:resident_id ( full_name, phone_number )
        `
      )
      .is('archived_at', null)
      .or(
        `guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,apartment_number.ilike.%${q}%`
      )
      .order('visit_date', { ascending: false })
      .limit(20)

    if (error) return { success: false, error: error.message }

    const results: GuestSearchResult[] = (data || []).map((row: any) => ({
      id: row.id,
      guest_name: row.guest_name,
      guest_phone: row.guest_phone,
      apartment_number: row.apartment_number,
      purpose: row.purpose,
      visit_date: row.visit_date,
      visit_time: row.visit_time,
      expiry_time: row.expiry_time,
      duration_hours: row.duration_hours,
      status: row.status,
      qr_token: row.qr_token,
      resident_name: row.resident?.full_name || null,
      resident_phone: row.resident?.phone_number || null,
    }))

    return { success: true, data: results }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Search failed' }
  }
}
