'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Event, EventGuest, PaginatedResult } from '@/types'
import { EVENT_APPROVAL_THRESHOLD, PAGE_SIZE } from '@/constants'
import { writeAuditLog } from './audit'
import { writeNotification } from './notifications'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id).maybeSingle()
  if (!profile) throw new Error('Profile not found')
  if ((profile as any).is_active === false) throw new Error('Account deactivated')
  return { supabase, user, profile }
}

// ── Generate 6-digit gate code ─────────────────────────────────────────────
function makeGateCode(): string {
  const arr = new Uint32Array(1)
  if (typeof crypto !== 'undefined') crypto.getRandomValues(arr)
  else arr[0] = Math.floor(Math.random() * 900000)
  return String(100000 + (arr[0] % 900000))
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE EVENT
// ═══════════════════════════════════════════════════════════════════════════
export async function createEvent(input: {
  name: string
  eventType: string
  eventDate: string
  startTime: string
  endTime: string
  expectedCount: number
  maxCapacity: number
  notes?: string
}): Promise<ActionResult<Event>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'resident') return { success: false, error: 'Only residents can create events' }
    if (!profile.apartment_number) return { success: false, error: 'Set apartment number in profile first' }

    const requiresApproval = input.expectedCount > EVENT_APPROVAL_THRESHOLD

    const { data, error } = await supabase
      .from('events')
      .insert({
        resident_id:      user.id,
        name:             input.name.trim(),
        event_type:       input.eventType,
        apartment:        profile.apartment_number,
        event_date:       input.eventDate,
        start_time:       input.startTime,
        end_time:         input.endTime,
        expected_count:   input.expectedCount,
        max_capacity:     input.maxCapacity,
        requires_approval: requiresApproval,
        approval_status:  requiresApproval ? 'pending' : 'not_required',
        status:           'upcoming',
        notes:            input.notes || null,
      })
      .select().single()

    if (error) return { success: false, error: error.message }

    // If approval required, notify admins
    if (requiresApproval) {
      const { data: admins } = await supabase
        .from('profiles').select('id').eq('role', 'admin').eq('is_active', true)
      for (const admin of admins || []) {
        await writeNotification(supabase, {
          recipient_id: admin.id,
          type:         'event',
          title:        `Event approval needed: ${input.name}`,
          body:         `${profile.full_name} (Apt ${profile.apartment_number}) planned a ${input.eventType} for ${input.eventDate} with ${input.expectedCount} guests. Requires your approval.`,
          metadata: { event_id: data.id },
        })
      }
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'event.created', entity_type: 'event', entity_id: data.id,
      metadata: { name: input.name, expected_count: input.expectedCount, requires_approval: requiresApproval },
    })

    revalidatePath('/dashboard/resident/events')
    return { success: true, data: data as Event }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create event' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD EVENT GUESTS (individual)
// ═══════════════════════════════════════════════════════════════════════════
export async function addEventGuests(
  eventId: string,
  guests: { name: string; phone?: string }[]
): Promise<ActionResult<EventGuest[]>> {
  try {
    const { supabase, user } = await requireAuth()

    // Verify ownership
    const { data: event } = await supabase
      .from('events').select('id, resident_id, max_capacity').eq('id', eventId).single()
    if (!event) return { success: false, error: 'Event not found' }
    if (event.resident_id !== user.id) return { success: false, error: 'Not your event' }

    // Check capacity
    const { count: current } = await supabase
      .from('event_guests').select('*', { count: 'exact', head: true }).eq('event_id', eventId)
    if ((current ?? 0) + guests.length > event.max_capacity) {
      return { success: false, error: `Adding ${guests.length} guests would exceed max capacity (${event.max_capacity})` }
    }

    const rows = guests.map((g) => ({
      event_id:  eventId,
      name:      g.name.trim(),
      phone:     g.phone || null,
      gate_code: makeGateCode(),
      status:    'invited',
    }))

    const { data, error } = await supabase
      .from('event_guests').insert(rows).select()
    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/resident/events')
    return { success: true, data: data as EventGuest[] }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to add guests' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD EVENT COORDINATOR
// ═══════════════════════════════════════════════════════════════════════════
export async function addEventCoordinator(
  eventId: string,
  name: string,
  phone: string
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAuth()
    const { data: event } = await supabase
      .from('events').select('resident_id').eq('id', eventId).single()
    if (!event || event.resident_id !== user.id) return { success: false, error: 'Not your event' }

    const { error } = await supabase
      .from('event_coordinators').insert({ event_id: eventId, name: name.trim(), phone })
    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/resident/events')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to add coordinator' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN APPROVE / REJECT EVENT
// ═══════════════════════════════════════════════════════════════════════════
export async function reviewEvent(
  eventId: string,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const { data: event } = await supabase
      .from('events').select('name, resident_id').eq('id', eventId).single()
    if (!event) return { success: false, error: 'Event not found' }

    const { error } = await supabase
      .from('events')
      .update({
        approval_status:  decision,
        approved_by:      user.id,
        approved_at:      new Date().toISOString(),
        rejection_reason: decision === 'rejected' ? (reason || null) : null,
      })
      .eq('id', eventId)
    if (error) return { success: false, error: error.message }

    await writeNotification(supabase, {
      recipient_id: event.resident_id,
      type:         'event',
      title:        decision === 'approved' ? `✅ Event approved: ${event.name}` : `❌ Event rejected: ${event.name}`,
      body:         decision === 'approved'
        ? `Your event "${event.name}" has been approved. Guests can now be admitted.`
        : `Your event "${event.name}" was rejected. Reason: ${reason ?? 'No reason given.'}`,
      metadata: { event_id: eventId, decision },
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: decision === 'approved' ? 'event.approved' : 'event.rejected',
      entity_type: 'event', entity_id: eventId,
      metadata: { decision, reason },
    })

    revalidatePath('/dashboard/admin/events')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Review failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MY EVENTS (resident)
// ═══════════════════════════════════════════════════════════════════════════
export async function getMyEvents(): Promise<ActionResult<Event[]>> {
  try {
    const { supabase, user } = await requireAuth()
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        coordinators:event_coordinators(id, name, phone),
        guest_count:event_guests(count)
      `)
      .eq('resident_id', user.id)
      .order('event_date', { ascending: false })
    if (error) return { success: true, data: [] }
    return { success: true, data: (data || []) as any[] }
  } catch (_e: any) {
    return { success: true, data: [] }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET EVENT GUESTS (resident + guard)
// ═══════════════════════════════════════════════════════════════════════════
export async function getEventGuests(eventId: string): Promise<ActionResult<EventGuest[]>> {
  try {
    const { supabase, user, profile } = await requireAuth()

    if (!['security', 'admin'].includes(profile.role)) {
      const { data: event } = await supabase
        .from('events').select('resident_id').eq('id', eventId).single()
      if (event?.resident_id !== user.id) return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', eventId)
      .order('name', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data || []) as EventGuest[] }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch guests' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IN EVENT GUEST (guard — by name, gate_code, or qr_token)
// ═══════════════════════════════════════════════════════════════════════════
export async function checkInEventGuest(input: {
  eventId: string
  guestId?: string     // if already identified
  lookup?: string      // name / gate_code to find guest
  counterMode?: boolean // use counter pass instead of named guest
  personsAdmitted?: number
}): Promise<ActionResult<{ guestId?: string; newCount: number }>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const { data: event } = await supabase
      .from('events')
      .select('*, coordinators:event_coordinators(*)')
      .eq('id', input.eventId).single()
    if (!event) return { success: false, error: 'Event not found' }

    if (event.approval_status === 'pending') {
      return { success: false, error: 'This event is pending admin approval. Entry blocked.' }
    }
    if (event.approval_status === 'rejected') {
      return { success: false, error: 'This event was rejected. Entry denied.' }
    }

    const now = new Date()
    const eventStart = new Date(`${event.event_date}T${event.start_time}+06:00`)
    const eventEnd   = new Date(`${event.event_date}T${event.end_time}+06:00`)
    if (now < eventStart) {
      return { success: false, error: `Event hasn't started yet. Starts at ${event.start_time}` }
    }
    if (now > eventEnd) {
      return { success: false, error: 'Event has ended. Entry denied.' }
    }

    if (input.counterMode) {
      // Counter pass: increment counter_admitted
      const admitted = input.personsAdmitted ?? 1
      if (event.counter_admitted + admitted > event.max_capacity) {
        return { success: false, error: `At capacity (${event.counter_admitted}/${event.max_capacity})` }
      }
      const { error: updErr } = await supabase
        .from('events')
        .update({ counter_admitted: event.counter_admitted + admitted })
        .eq('id', input.eventId)
      if (updErr) return { success: false, error: updErr.message }

      await supabase.from('entry_logs').insert({
        security_guard_id: user.id,
        guard_id:          user.id,
        entry_time:        now.toISOString(),
        expected_exit_at:  eventEnd.toISOString(),
        status:            'inside',
        visitor_type:      'event',
        persons_admitted:  admitted,
        identity_verified: false,
        notes:             `Event counter: ${event.name}`,
      })

      revalidatePath('/dashboard/security/quick-entry/event')
      return { success: true, data: { newCount: event.counter_admitted + admitted } }
    }

    // Named guest lookup
    let guestId = input.guestId
    if (!guestId && input.lookup) {
      const q = input.lookup.trim()
      const { data: found } = await supabase
        .from('event_guests')
        .select('id')
        .eq('event_id', input.eventId)
        .or(`name.ilike.%${q}%,gate_code.eq.${q}`)
        .eq('status', 'invited')
        .limit(1)
        .single()
      guestId = found?.id
    }

    if (!guestId) return { success: false, error: 'Guest not found on the list. Use walk-in request for unlisted guests.' }

    const { data: guest } = await supabase
      .from('event_guests').select('*').eq('id', guestId).single()
    if (!guest) return { success: false, error: 'Guest record not found' }
    if (guest.status === 'arrived') return { success: false, error: `${guest.name} is already checked in` }

    // Check capacity
    const { count: arrivedCount } = await supabase
      .from('event_guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', input.eventId)
      .eq('status', 'arrived')

    const totalInside = (arrivedCount ?? 0) + event.counter_admitted
    if (totalInside >= event.max_capacity) {
      return { success: false, error: `Event at capacity (${totalInside}/${event.max_capacity}). Host approval required for more.` }
    }

    await supabase
      .from('event_guests')
      .update({ status: 'arrived', arrived_at: now.toISOString() })
      .eq('id', guestId)

    await supabase.from('entry_logs').insert({
      security_guard_id: user.id,
      guard_id:          user.id,
      entry_time:        now.toISOString(),
      expected_exit_at:  eventEnd.toISOString(),
      status:            'inside',
      visitor_type:      'event',
      persons_admitted:  1,
      identity_verified: false,
      notes:             `Event: ${event.name}, Guest: ${guest.name}`,
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'event.checkin', entity_type: 'event_guest', entity_id: guestId,
      metadata: { event_id: input.eventId, guest_name: guest.name },
    })

    const { count: newArrived } = await supabase
      .from('event_guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', input.eventId)
      .eq('status', 'arrived')

    revalidatePath('/dashboard/security/quick-entry/event')
    return { success: true, data: { guestId, newCount: (newArrived ?? 0) + event.counter_admitted } }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Check-in failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL EVENTS FOR ADMIN APPROVAL QUEUE
// ═══════════════════════════════════════════════════════════════════════════
export async function getEventsForApproval(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        resident:resident_id(full_name, apartment_number, phone_number)
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })
    if (error) return { success: true, data: [] }
    return { success: true, data: data || [] }
  } catch (_e: any) {
    return { success: true, data: [] }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ACTIVE EVENT FOR GUARD (by apartment or date)
// ═══════════════════════════════════════════════════════════════════════════
export async function getActiveEvents(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        guest_count:event_guests(count),
        arrived_count:event_guests(count)
      `)
      .eq('event_date', today)
      .in('approval_status', ['approved', 'not_required'])
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })
    if (error) return { success: true, data: [] }
    return { success: true, data: data || [] }
  } catch (_e: any) {
    return { success: true, data: [] }
  }
}
