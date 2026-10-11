'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionResult, Notification, NotificationType } from '@/types'
import { revokeGuestPass } from './guest-passes'

// ─── Internal helper (called from other server actions, not RPC) ───────────
export async function writeNotification(
  supabase: SupabaseClient,
  params: {
    recipient_id: string
    type: NotificationType
    title: string
    body: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      recipient_id: params.recipient_id,
      type:         params.type,
      title:        params.title,
      body:         params.body,
      metadata:     params.metadata ?? {},
    })
    // Supabase Realtime picks this up automatically via postgres_changes
    // on the notifications table — no extra broadcast needed.
  } catch (err) {
    console.error('[writeNotification] failed:', err)
  }
}

// ─── Get notifications for the current user ────────────────────────────────
export async function getNotifications(params?: {
  unreadOnly?: boolean
  limit?: number
}): Promise<ActionResult<Notification[]>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(params?.limit ?? 50)

    if (params?.unreadOnly) query = query.is('read_at', null)

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    return { success: true, data: (data || []) as Notification[] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch notifications' }
  }
}

// ─── Mark one notification as read ────────────────────────────────────────
export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', user.id)  // RLS double-check

    if (error) return { success: false, error: error.message }
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to mark notification as read' }
  }
}

// ─── Mark ALL notifications as read ───────────────────────────────────────
export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null)

    if (error) return { success: false, error: error.message }
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to mark notifications as read' }
  }
}

// ─── "Not my guest — Revoke now" action ──────────────────────────────────
// Called from the resident notification bell when they tap "Not my guest".
// Revokes the pass AND notifies the guard on duty via a new notification.
export async function revokeAndAlert(params: {
  passId: string
  entryLogId?: string
  reason?: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Revoke the pass
    const revokeResult = await revokeGuestPass({
      passId: params.passId,
      reason: params.reason ?? 'Revoked by resident: not my guest',
    })
    if (!revokeResult.success) return revokeResult

    // Fetch the pass + current guard on duty (if an active entry exists)
    const { data: pass } = await supabase
      .from('guest_passes')
      .select('guest_name, apartment_number, resident_id')
      .eq('id', params.passId)
      .single()

    if (pass && params.entryLogId) {
      const { data: logRow } = await supabase
        .from('entry_logs')
        .select('security_guard_id')
        .eq('id', params.entryLogId)
        .single()

      if (logRow?.security_guard_id) {
        await writeNotification(supabase, {
          recipient_id: logRow.security_guard_id,
          type:         'revoked',
          title:        '⚠️ Pass Revoked — Escort out immediately',
          body:         `Resident revoked pass for ${pass.guest_name} (Apt ${pass.apartment_number}). Please escort them out.`,
          metadata: {
            pass_id:      params.passId,
            entry_log_id: params.entryLogId,
            guest_name:   pass.guest_name,
          },
        })
      }
    }

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to revoke and alert' }
  }
}
