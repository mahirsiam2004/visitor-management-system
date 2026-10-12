'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  ActionResult, RecurringVisitor, RecurringVisitorApartment,
  RecurringVisitorSchedule, PaginatedResult,
} from '@/types'
import { isOnSchedule } from '@/lib/utils/schedule'
import { PAGE_SIZE, WEEKDAYS } from '@/constants'
import { writeAuditLog } from './audit'
import { writeNotification } from './notifications'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles').select('*')
    .eq('id', user.id).maybeSingle()
  if (!profile) throw new Error('Profile not found')
  if ((profile as any).is_active === false) throw new Error('Account deactivated')
  return { supabase, user, profile }
}

// ── Generate short_id via DB function ─────────────────────────────────────
async function getShortId(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('generate_rv_short_id')
  return data as string
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE RECURRING VISITOR
// ═══════════════════════════════════════════════════════════════════════════
export async function createRecurringVisitor(input: {
  fullName: string
  role: string
  phone?: string
  photoUrl?: string
  validUntil?: string
  apartment: string
  schedule: RecurringVisitorSchedule
}): Promise<ActionResult<RecurringVisitor>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'resident') return { success: false, error: 'Only residents can register staff' }

    const shortId = await getShortId(supabase)

    const { data: visitor, error } = await supabase
      .from('recurring_visitors')
      .insert({
        short_id:    shortId,
        full_name:   input.fullName.trim(),
        role:        input.role,
        phone:       input.phone || null,
        photo_url:   input.photoUrl || null,
        valid_until: input.validUntil || null,
        added_by:    user.id,
        status:      'active',
      })
      .select().single()

    if (error) return { success: false, error: error.message }

    // Link to apartment
    await supabase.from('recurring_visitor_apartments').insert({
      visitor_id:  visitor.id,
      apartment:   input.apartment,
      resident_id: user.id,
      schedule:    input.schedule,
      is_active:   true,
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'recurring.created', entity_type: 'recurring_visitor', entity_id: visitor.id,
      metadata: { name: visitor.full_name, role: visitor.role, short_id: shortId },
    })

    revalidatePath('/dashboard/resident/staff')
    return { success: true, data: visitor }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create staff' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MY RECURRING VISITORS (resident)
// ═══════════════════════════════════════════════════════════════════════════
export async function getMyRecurringVisitors(): Promise<ActionResult<RecurringVisitor[]>> {
  try {
    const { supabase, user } = await requireAuth()

    const { data, error } = await supabase
      .from('recurring_visitor_apartments')
      .select(`
        *,
        visitor:visitor_id (
          id, short_id, full_name, photo_url, phone, role,
          status, valid_until, added_by, created_at, updated_at
        )
      `)
      .eq('resident_id', user.id)

    if (error) return { success: true, data: [] }

    const visitors: RecurringVisitor[] = (data || []).map((row: any) => ({
      ...row.visitor,
      apartments: [{ ...row, visitor: undefined }],
    }))

    return { success: true, data: visitors }
  } catch (_e: any) {
    return { success: true, data: [] }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH RECURRING VISITORS (guard)
// ═══════════════════════════════════════════════════════════════════════════
export async function searchRecurringVisitors(query: string, apartment?: string): Promise<ActionResult<any[]>> {
  try {
    if (!query || query.trim().length < 2) return { success: true, data: [] }
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const q = query.trim()

    let dbQuery = supabase
      .from('recurring_visitors')
      .select(`
        id, short_id, full_name, photo_url, phone, role, status, valid_until,
        apartments:recurring_visitor_apartments (
          id, apartment, resident_id, schedule, is_active,
          resident:resident_id ( full_name, phone_number )
        )
      `)
      .eq('status', 'active')
      .or(`full_name.ilike.%${q}%,short_id.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(15)

    const { data, error } = await dbQuery
    if (error) return { success: false, error: error.message }

    // Filter by apartment if provided
    let results = data || []
    if (apartment) {
      results = results.filter((v: any) =>
        v.apartments?.some((a: any) => a.apartment === apartment && a.is_active)
      )
    }

    return { success: true, data: results }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Search failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IN RECURRING VISITOR (guard)
// ═══════════════════════════════════════════════════════════════════════════
export async function checkInRecurringVisitor(input: {
  visitorId: string
  apartment: string
  idType: string
  identityVerified: boolean
  entryPhotoUrl?: string
  overrideSchedule?: boolean  // guard confirmed despite schedule warning
}): Promise<ActionResult<{ entryLogId: string; warning?: string }>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    // Fetch visitor + apartment link
    const { data: visitor, error: vErr } = await supabase
      .from('recurring_visitors')
      .select(`
        *, apartments:recurring_visitor_apartments (
          id, apartment, resident_id, schedule, is_active,
          resident:resident_id ( id, full_name, phone_number )
        )
      `)
      .eq('id', input.visitorId)
      .single()

    if (vErr || !visitor) return { success: false, error: 'Visitor not found' }
    if (visitor.status === 'suspended') return { success: false, error: 'This visitor has been suspended by the resident.' }
    if (visitor.status === 'blacklisted') return { success: false, error: 'This visitor is blacklisted. Entry denied.' }

    const aptLink = visitor.apartments?.find(
      (a: any) => a.apartment === input.apartment && a.is_active
    )
    if (!aptLink) return { success: false, error: `No active registration for apartment ${input.apartment}` }

    // Check valid_until
    if (visitor.valid_until && new Date(visitor.valid_until) < new Date()) {
      return { success: false, error: `Registration expired on ${visitor.valid_until}` }
    }

    // Schedule check
    let warning: string | undefined
    const scheduleCheck = isOnSchedule(aptLink.schedule as RecurringVisitorSchedule)
    if (!scheduleCheck.onSchedule) {
      if (!input.overrideSchedule) {
        // Return a warning; guard decides whether to proceed
        return {
          success: false,
          error: `SCHEDULE_WARNING:${scheduleCheck.reason ?? 'Outside approved schedule'}`,
        }
      }
      warning = scheduleCheck.reason
    }

    // Create entry log
    const { data: log, error: logErr } = await supabase
      .from('entry_logs')
      .insert({
        recurring_visitor_id: visitor.id,
        security_guard_id:    user.id,
        guard_id:             user.id,
        entry_time:           new Date().toISOString(),
        expected_exit_at:     new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        status:               'inside',
        visitor_type:         'recurring',
        id_type:              input.idType,
        identity_id_type:     input.idType,
        identity_verified:    input.identityVerified,
        entry_photo_url:      input.entryPhotoUrl || null,
        entry_photo_path:     input.entryPhotoUrl || null,
        persons_admitted:     1,
        notes:                warning ? `Schedule override: ${warning}` : null,
      })
      .select('id').single()

    if (logErr) return { success: false, error: logErr.message }

    // Notify resident
    const timeStr = new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit',
    })
    await writeNotification(supabase, {
      recipient_id: aptLink.resident_id,
      type:         'checkin',
      title:        `${visitor.full_name} arrived`,
      body:         `Your ${visitor.role} (${visitor.short_id}) entered at ${timeStr}${warning ? ' — outside schedule' : ''}`,
      metadata: { visitor_id: visitor.id, entry_log_id: log.id, warning },
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'recurring.checkin', entity_type: 'recurring_visitor', entity_id: visitor.id,
      metadata: { apartment: input.apartment, schedule_warning: warning },
    })

    revalidatePath('/dashboard/security')
    return { success: true, data: { entryLogId: log.id, warning } }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Check-in failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUSPEND / REACTIVATE STAFF (resident)
// ═══════════════════════════════════════════════════════════════════════════
export async function updateRecurringVisitorStatus(
  visitorId: string,
  status: 'active' | 'suspended',
  apartment?: string
): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()

    // Verify ownership
    const { data: link } = await supabase
      .from('recurring_visitor_apartments')
      .select('id')
      .eq('visitor_id', visitorId)
      .eq('resident_id', user.id)
      .single()

    if (!link && profile.role !== 'admin') return { success: false, error: 'Not authorized' }

    if (apartment) {
      // Only deactivate for this apartment
      await supabase
        .from('recurring_visitor_apartments')
        .update({ is_active: status === 'active' })
        .eq('visitor_id', visitorId)
        .eq('resident_id', user.id)
    } else {
      await supabase
        .from('recurring_visitors')
        .update({ status })
        .eq('id', visitorId)
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'recurring.suspended', entity_type: 'recurring_visitor', entity_id: visitorId,
      metadata: { status },
    })

    revalidatePath('/dashboard/resident/staff')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Update failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET STAFF TIMELINE (resident — today's arrivals/departures)
// ═══════════════════════════════════════════════════════════════════════════
export async function getStaffTimeline(days = 7): Promise<ActionResult<any[]>> {
  try {
    const { supabase, user } = await requireAuth()

    // Get visitor IDs for this resident
    const { data: myVisitors } = await supabase
      .from('recurring_visitor_apartments')
      .select('visitor_id')
      .eq('resident_id', user.id)

    const visitorIds = (myVisitors || []).map((v: any) => v.visitor_id)
    if (visitorIds.length === 0) return { success: true, data: [] }

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('entry_logs')
      .select(`
        id, entry_time, exit_time, status, notes,
        visitor:recurring_visitor_id ( short_id, full_name, role )
      `)
      .in('recurring_visitor_id', visitorIds)
      .gte('entry_time', since.toISOString())
      .order('entry_time', { ascending: false })

    if (error) return { success: true, data: [] }
    return { success: true, data: data || [] }
  } catch (_e: any) {
    return { success: true, data: [] }
  }
}
