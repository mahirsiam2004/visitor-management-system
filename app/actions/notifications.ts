'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ActionResult, Notification, NotificationType,
  NotificationPreferences,
} from '@/types'
import { sendSms } from '@/lib/sms'
import { revokeGuestPass } from './guest-passes'

// ─── VAPID Web Push helper ─────────────────────────────────────────────────
async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  // Web Push requires the `web-push` npm package.
  // It is NOT installed yet; guard the import so build never breaks.
  try {
    const webpush = await import('web-push').catch(() => null)
    if (!webpush) return  // package not installed → skip silently

    const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidSubject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'
    if (!vapidPublicKey || !vapidPrivateKey) return

    webpush.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    await webpush.default.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload),
      { TTL: 3600 }
    )
  } catch (err) {
    console.error('[push] send error:', err)
  }
}

// ─── Preference key for a notification type ────────────────────────────────
function prefKey(type: NotificationType): keyof NotificationPreferences | null {
  const MAP: Partial<Record<NotificationType, keyof NotificationPreferences>> = {
    checkin:            'notify_checkin',
    checkout:           'notify_checkout',
    overstay:           'notify_overstay',
    ending_soon:        'notify_ending_soon',
    delivery:           'notify_delivery',
    walk_in:            'notify_walk_in',
    extension_request:  'notify_extension',
    extension_approved: 'notify_extension',
    extension_rejected: 'notify_extension',
    penalty_created:    'notify_penalty',
    penalty_waived:     'notify_penalty',
    revoked:            'notify_revoked',
    event:              'notify_event',
    emergency:          'notify_emergency',
  }
  return MAP[type] ?? null
}

// ─── SMS-critical types (only these bypass sms_critical_only flag) ─────────
const SMS_CRITICAL_TYPES: NotificationType[] = [
  'delivery', 'overstay', 'emergency', 'revoked',
]

// ═══════════════════════════════════════════════════════════════════════════
// notify() — the single dispatcher for all channels
// ═══════════════════════════════════════════════════════════════════════════
export async function notify(
  supabase: SupabaseClient,
  params: {
    recipient_id: string
    type: NotificationType
    title: string
    body: string
    metadata?: Record<string, unknown>
    // If provided, used for SMS. Otherwise looked up from profiles.phone_number
    phoneNumber?: string
  }
): Promise<void> {
  try {
    // 1. Always write in-app notification (Supabase Realtime broadcasts it)
    await supabase.from('notifications').insert({
      recipient_id: params.recipient_id,
      type:         params.type,
      title:        params.title,
      body:         params.body,
      metadata:     params.metadata ?? {},
    })

    // 2. Load user preferences (non-fatal if missing)
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', params.recipient_id)
      .single()

    // Check per-event preference toggle
    const key = prefKey(params.type)
    if (key && prefs && prefs[key] === false) return  // user disabled this type

    // 3. Web Push
    if (prefs?.push_enabled && prefs.push_endpoint && prefs.push_p256dh && prefs.push_auth) {
      await sendWebPush(
        prefs.push_endpoint,
        prefs.push_p256dh,
        prefs.push_auth,
        { title: params.title, body: params.body, data: params.metadata }
      )
    }

    // 4. SMS
    if (prefs?.sms_enabled) {
      // Check sms_critical_only policy
      const { data: policy } = await supabase
        .from('policy_settings').select('sms_critical_only').single()

      const isCritical = SMS_CRITICAL_TYPES.includes(params.type)
      const criticalOnly: boolean = policy?.sms_critical_only ?? true

      if (!criticalOnly || isCritical) {
        // Get phone number
        let phone = params.phoneNumber
        if (!phone) {
          const { data: profile } = await supabase
            .from('profiles').select('phone_number').eq('id', params.recipient_id).single()
          phone = profile?.phone_number ?? undefined
        }

        if (phone) {
          await sendSms(supabase, params.recipient_id, phone, `${params.title}\n${params.body}`)
        }
      }
    }
  } catch (err) {
    console.error('[notify] error:', err)
  }
}

// Backward-compat alias (used throughout the codebase)
export const writeNotification = notify

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function getNotificationPreferences(): Promise<ActionResult<NotificationPreferences>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Row doesn't exist yet — return defaults
      return {
        success: true,
        data: {
          user_id: user.id, inapp_enabled: true,
          push_enabled: false, push_endpoint: null, push_p256dh: null, push_auth: null,
          sms_enabled: false,
          notify_checkin: true, notify_checkout: true, notify_overstay: true,
          notify_ending_soon: true, notify_delivery: true, notify_walk_in: true,
          notify_extension: true, notify_penalty: true, notify_revoked: true,
          notify_event: true, notify_emergency: true,
          sms_sent_today: 0, sms_last_reset_date: null,
          updated_at: new Date().toISOString(),
        } as NotificationPreferences,
      }
    }
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as NotificationPreferences }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function updateNotificationPreferences(
  updates: Partial<Omit<NotificationPreferences, 'user_id' | 'sms_sent_today' | 'sms_last_reset_date' | 'updated_at'>>
): Promise<ActionResult<NotificationPreferences>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() })
      .select().single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as NotificationPreferences }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// Register Web Push subscription
export async function registerPushSubscription(sub: {
  endpoint: string; p256dh: string; auth: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    await supabase.from('notification_preferences').upsert({
      user_id:       user.id,
      push_enabled:  true,
      push_endpoint: sub.endpoint,
      push_p256dh:   sub.p256dh,
      push_auth:     sub.auth,
      updated_at:    new Date().toISOString(),
    })
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET NOTIFICATIONS for the current user
// ═══════════════════════════════════════════════════════════════════════════
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
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function getUnreadCount(): Promise<ActionResult<number>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: true, data: 0 }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)

    if (error) return { success: true, data: 0 }
    return { success: true, data: count ?? 0 }
  } catch {
    return { success: true, data: 0 }
  }
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', user.id)
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null)
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── revokeAndAlert ─────────────────────────────────────────────────────────
export async function revokeAndAlert(params: {
  passId: string; entryLogId?: string; reason?: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const revokeResult = await revokeGuestPass({
      passId: params.passId,
      reason: params.reason ?? 'Revoked by resident: not my guest',
    })
    if (!revokeResult.success) return revokeResult

    const { data: pass } = await supabase
      .from('guest_passes').select('guest_name, apartment_number').eq('id', params.passId).single()

    if (pass && params.entryLogId) {
      const { data: logRow } = await supabase
        .from('entry_logs').select('security_guard_id').eq('id', params.entryLogId).single()
      if (logRow?.security_guard_id) {
        await notify(supabase, {
          recipient_id: logRow.security_guard_id,
          type:         'revoked',
          title:        '⚠️ Pass Revoked — Escort out immediately',
          body:         `Resident revoked pass for ${pass.guest_name} (Apt ${pass.apartment_number}).`,
          metadata:     { pass_id: params.passId, entry_log_id: params.entryLogId },
        })
      }
    }
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
