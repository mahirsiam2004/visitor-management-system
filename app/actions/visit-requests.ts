'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, VisitRequest, PaginatedResult } from '@/types'
import {
  DELIVERY_RESIDENT_REPLY_MINUTES,
  DELIVERY_ACCESS_WINDOW_MINUTES,
  WALK_IN_RESIDENT_REPLY_MINUTES,
  PAGE_SIZE,
} from '@/constants'
import { writeAuditLog } from './audit'
import { writeNotification } from './notifications'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles').select('role, is_active, full_name, apartment_number, delivery_auto_allow_until')
    .eq('id', user.id).single()
  if (!profile) throw new Error('Profile not found')
  if (!profile.is_active) throw new Error('Account deactivated')
  return { supabase, user, profile }
}

// ─── Helper: resolve resident_id from apartment ────────────────────────────
async function getResidentByApartment(supabase: any, apartment: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone_number, delivery_auto_allow_until')
    .eq('apartment_number', apartment)
    .eq('role', 'resident')
    .eq('is_active', true)
    .single()
  return data
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE DELIVERY REQUEST (guard)
// ═══════════════════════════════════════════════════════════════════════════
export async function createDeliveryRequest(input: {
  platform: string
  visitorName: string
  visitorPhone?: string
  destinationApt: string
}): Promise<ActionResult<VisitRequest>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const resident = await getResidentByApartment(supabase, input.destinationApt)
    if (!resident) return { success: false, error: `No resident found for apartment ${input.destinationApt}` }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + DELIVERY_RESIDENT_REPLY_MINUTES * 60 * 1000)

    // Check auto-allow window
    let autoApproved = false
    let entryAllowedUntil: string | null = null
    if (resident.delivery_auto_allow_until && new Date(resident.delivery_auto_allow_until) > now) {
      autoApproved    = true
      entryAllowedUntil = new Date(now.getTime() + DELIVERY_ACCESS_WINDOW_MINUTES * 60 * 1000).toISOString()
    }

    const { data, error } = await supabase
      .from('visit_requests')
      .insert({
        type:              'delivery',
        status:            autoApproved ? 'approved' : 'pending',
        visitor_name:      input.visitorName.trim(),
        visitor_phone:     input.visitorPhone || null,
        destination_apt:   input.destinationApt,
        resident_id:       resident.id,
        guard_id:          user.id,
        platform:          input.platform,
        access_window_min: DELIVERY_ACCESS_WINDOW_MINUTES,
        expires_at:        autoApproved ? null : expiresAt.toISOString(),
        entry_allowed_until: entryAllowedUntil,
        auto_approved:     autoApproved,
        responded_at:      autoApproved ? now.toISOString() : null,
      })
      .select().single()

    if (error) return { success: false, error: error.message }

    // Notify resident (unless auto-approved, still notify)
    await writeNotification(supabase, {
      recipient_id: resident.id,
      type:         'delivery',
      title:        autoApproved ? `✅ Delivery auto-allowed — ${input.platform}` : `📦 Delivery at gate — ${input.platform}`,
      body:         autoApproved
        ? `${input.visitorName} (${input.platform}) auto-allowed. 20 min window.`
        : `${input.visitorName} from ${input.platform} is at the gate for your apartment. Tap to Allow or Reject. (${DELIVERY_RESIDENT_REPLY_MINUTES} min to respond)`,
      metadata: {
        request_id:  data.id,
        platform:    input.platform,
        expires_at:  expiresAt.toISOString(),
        auto_approved: autoApproved,
      },
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'visit_request.created', entity_type: 'visit_request', entity_id: data.id,
      metadata: { type: 'delivery', platform: input.platform, auto_approved: autoApproved },
    })

    revalidatePath('/dashboard/security')
    return { success: true, data }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create delivery request' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE WALK-IN REQUEST (guard)
// ═══════════════════════════════════════════════════════════════════════════
export async function createWalkInRequest(input: {
  visitorName: string
  visitorPhone?: string
  destinationApt: string
  purpose: string
}): Promise<ActionResult<VisitRequest>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const resident = await getResidentByApartment(supabase, input.destinationApt)
    if (!resident) return { success: false, error: `No resident found for apartment ${input.destinationApt}` }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + WALK_IN_RESIDENT_REPLY_MINUTES * 60 * 1000)

    const { data, error } = await supabase
      .from('visit_requests')
      .insert({
        type:            'walk_in',
        status:          'pending',
        visitor_name:    input.visitorName.trim(),
        visitor_phone:   input.visitorPhone || null,
        destination_apt: input.destinationApt,
        resident_id:     resident.id,
        guard_id:        user.id,
        purpose:         input.purpose,
        access_window_min: 30,
        expires_at:      expiresAt.toISOString(),
      })
      .select().single()

    if (error) return { success: false, error: error.message }

    await writeNotification(supabase, {
      recipient_id: resident.id,
      type:         'walk_in',
      title:        `🚪 Unregistered visitor at gate`,
      body:         `${input.visitorName} wants to visit your apartment. Purpose: ${input.purpose}. You have ${WALK_IN_RESIDENT_REPLY_MINUTES} minutes to respond.`,
      metadata: { request_id: data.id, expires_at: expiresAt.toISOString() },
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'visit_request.created', entity_type: 'visit_request', entity_id: data.id,
      metadata: { type: 'walk_in', purpose: input.purpose },
    })

    revalidatePath('/dashboard/security')
    return { success: true, data }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create walk-in request' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPOND TO REQUEST (resident: approve / reject / leave_at_gate)
// ═══════════════════════════════════════════════════════════════════════════
export async function respondToVisitRequest(
  requestId: string,
  response: 'approved' | 'rejected' | 'leave_at_gate'
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAuth()

    const { data: req } = await supabase
      .from('visit_requests')
      .select('*')
      .eq('id', requestId)
      .eq('resident_id', user.id)
      .single()

    if (!req) return { success: false, error: 'Request not found' }
    if (req.status !== 'pending') return { success: false, error: 'Request already resolved' }
    if (req.expires_at && new Date(req.expires_at) < new Date()) {
      return { success: false, error: 'Request has expired' }
    }

    const now = new Date()
    let entryAllowedUntil: string | null = null
    if (response === 'approved') {
      entryAllowedUntil = new Date(now.getTime() + req.access_window_min * 60 * 1000).toISOString()
    }

    const { error } = await supabase
      .from('visit_requests')
      .update({
        status:              response,
        responded_at:        now.toISOString(),
        responded_by:        user.id,
        entry_allowed_until: entryAllowedUntil,
      })
      .eq('id', requestId)

    if (error) return { success: false, error: error.message }

    // Notify the guard
    await writeNotification(supabase, {
      recipient_id: req.guard_id,
      type:         'system',
      title:        response === 'approved'
        ? `✅ ${req.type === 'delivery' ? 'Delivery' : 'Walk-in'} Approved`
        : response === 'leave_at_gate'
        ? `📬 Leave at Gate`
        : `❌ ${req.type === 'delivery' ? 'Delivery' : 'Walk-in'} Rejected`,
      body: response === 'approved'
        ? `${req.visitor_name} approved for Apt ${req.destination_apt}. ${req.access_window_min}-min window.`
        : response === 'leave_at_gate'
        ? `Resident asked to leave package at gate/reception.`
        : `${req.visitor_name} rejected by resident.`,
      metadata: { request_id: requestId, response },
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'resident',
      action: response === 'approved' ? 'visit_request.approved' : 'visit_request.rejected',
      entity_type: 'visit_request', entity_id: requestId,
      metadata: { response, type: req.type },
    })

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/security')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to respond' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMERGENCY ENTRY (guard — instant, no approval wait)
// ═══════════════════════════════════════════════════════════════════════════
export async function createEmergencyEntry(input: {
  visitorName: string
  emergencyType: string
  destinationApt: string
  notes?: string
}): Promise<ActionResult<{ requestId: string; entryLogId: string }>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const resident = await getResidentByApartment(supabase, input.destinationApt)
    const now = new Date()

    // Create request (auto-approved)
    const { data: req, error: reqErr } = await supabase
      .from('visit_requests')
      .insert({
        type:             'emergency',
        status:           'approved',
        visitor_name:     input.visitorName.trim(),
        destination_apt:  input.destinationApt,
        resident_id:      resident?.id ?? user.id,
        guard_id:         user.id,
        emergency_type:   input.emergencyType,
        notes:            input.notes || null,
        access_window_min: 120,
        responded_at:     now.toISOString(),
        auto_approved:    true,
        entry_allowed_until: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      })
      .select('id').single()

    if (reqErr) return { success: false, error: reqErr.message }

    // Create entry log immediately
    const { data: log, error: logErr } = await supabase
      .from('entry_logs')
      .insert({
        visit_request_id:  req.id,
        security_guard_id: user.id,
        entry_time:        now.toISOString(),
        status:            'inside',
        visitor_type:      'emergency',
        identity_verified: false,
        persons_admitted:  1,
        notes:             `Emergency: ${input.emergencyType}${input.notes ? ` — ${input.notes}` : ''}`,
      })
      .select('id').single()

    if (logErr) return { success: false, error: logErr.message }

    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })

    // Notify resident + admins
    if (resident) {
      await writeNotification(supabase, {
        recipient_id: resident.id,
        type:         'emergency',
        title:        `🚨 Emergency entry — ${input.emergencyType}`,
        body:         `${input.visitorName} entered your apartment at ${timeStr}. Emergency type: ${input.emergencyType}.`,
        metadata: { request_id: req.id, entry_log_id: log.id },
      })
    }

    // Notify all active admins
    const { data: admins } = await supabase
      .from('profiles').select('id').eq('role', 'admin').eq('is_active', true)
    for (const admin of admins || []) {
      await writeNotification(supabase, {
        recipient_id: admin.id,
        type:         'emergency',
        title:        `🚨 Emergency entry — Apt ${input.destinationApt}`,
        body:         `${input.visitorName} (${input.emergencyType}) entered at ${timeStr}. Guard: ${profile.full_name}.`,
        metadata: { request_id: req.id, entry_log_id: log.id },
      })
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'emergency.entry', entity_type: 'visit_request', entity_id: req.id,
      metadata: { type: input.emergencyType, apartment: input.destinationApt },
    })

    revalidatePath('/dashboard/security')
    return { success: true, data: { requestId: req.id, entryLogId: log.id } }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Emergency entry failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET PENDING REQUESTS FOR RESIDENT
// ═══════════════════════════════════════════════════════════════════════════
export async function getPendingRequests(): Promise<ActionResult<VisitRequest[]>> {
  try {
    const { supabase, user } = await requireAuth()

    const { data, error } = await supabase
      .from('visit_requests')
      .select('*')
      .eq('resident_id', user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data || []) as VisitRequest[] }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch requests' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET REQUEST STATUS (guard polling)
// ═══════════════════════════════════════════════════════════════════════════
export async function getVisitRequestStatus(requestId: string): Promise<ActionResult<VisitRequest>> {
  try {
    const { supabase, user, profile } = await requireAuth()

    const { data, error } = await supabase
      .from('visit_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error || !data) return { success: false, error: 'Request not found' }

    // Guard can see their own; resident can see theirs
    if (data.guard_id !== user.id && data.resident_id !== user.id && profile.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    return { success: true, data: data as VisitRequest }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch request' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IN via approved visit request (guard)
// ═══════════════════════════════════════════════════════════════════════════
export async function checkInFromRequest(input: {
  requestId: string
  idType: string
  identityVerified: boolean
  entryPhotoUrl?: string
}): Promise<ActionResult<{ entryLogId: string }>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const { data: req } = await supabase
      .from('visit_requests').select('*').eq('id', input.requestId).single()

    if (!req) return { success: false, error: 'Request not found' }
    if (req.status !== 'approved') return { success: false, error: `Request status is "${req.status}" — not approved` }

    const now = new Date()
    if (req.entry_allowed_until && new Date(req.entry_allowed_until) < now) {
      return { success: false, error: 'Access window has expired' }
    }

    const { data: log, error: logErr } = await supabase
      .from('entry_logs')
      .insert({
        visit_request_id:  req.id,
        security_guard_id: user.id,
        entry_time:        now.toISOString(),
        expected_exit_at:  req.entry_allowed_until,
        status:            'inside',
        visitor_type:      req.type === 'delivery' ? 'delivery' : 'walk_in',
        id_type:           input.idType,
        identity_verified: input.identityVerified,
        entry_photo_url:   input.entryPhotoUrl || null,
        persons_admitted:  1,
      })
      .select('id').single()

    if (logErr) return { success: false, error: logErr.message }

    await supabase
      .from('visit_requests')
      .update({ status: 'completed' })
      .eq('id', req.id)

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'checkin.allowed', entity_type: 'entry_log', entity_id: log.id,
      metadata: { request_type: req.type, visitor: req.visitor_name },
    })

    revalidatePath('/dashboard/security')
    return { success: true, data: { entryLogId: log.id } }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Check-in failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOGGLE DELIVERY AUTO-ALLOW (resident)
// ═══════════════════════════════════════════════════════════════════════════
export async function toggleDeliveryAutoAllow(enable: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAuth()
    const until = enable
      ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()  // 2 hours
      : null

    await supabase
      .from('profiles')
      .update({ delivery_auto_allow_until: until })
      .eq('id', user.id)

    revalidatePath('/dashboard/resident')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Update failed' }
  }
}
