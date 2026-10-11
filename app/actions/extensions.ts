'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, PassExtension, ExtendHours } from '@/types'
import { writeAuditLog } from './audit'
import { notify } from './notifications'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) throw new Error('Profile not found')
  if ((profile as any).is_active === false) throw new Error('Account deactivated')
  return { supabase, user, profile }
}

// ─── Load policy values ────────────────────────────────────────────────────
async function loadPolicy(supabase: any) {
  const { data } = await supabase
    .from('policy_settings')
    .select('max_extensions_resident, max_total_stay_hours')
    .maybeSingle()
  return {
    maxResidentExtensions: data?.max_extensions_resident ?? 1,
    maxTotalStayHours:     data?.max_total_stay_hours ?? 48,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST EXTENSION (resident)
// ═══════════════════════════════════════════════════════════════════════════
export async function requestExtension(input: {
  passId: string
  extendHours: ExtendHours
  reason?: string
}): Promise<ActionResult<PassExtension>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'resident') return { success: false, error: 'Only residents can request extensions' }

    // Fetch pass
    const { data: pass } = await supabase
      .from('guest_passes')
      .select('id, resident_id, expiry_time, status, guest_name, apartment_number, duration_hours')
      .eq('id', input.passId)
      .single()

    if (!pass) return { success: false, error: 'Pass not found' }
    if (pass.resident_id !== user.id) return { success: false, error: 'Not your pass' }
    if (pass.status === 'revoked') return { success: false, error: 'Revoked passes cannot be extended' }
    if (pass.status === 'archived') return { success: false, error: 'Archived passes cannot be extended' }

    // Policy checks
    const { maxResidentExtensions, maxTotalStayHours } = await loadPolicy(supabase)

    // Count existing approved/pending extensions
    const { count: existingCount } = await supabase
      .from('pass_extensions')
      .select('*', { count: 'exact', head: true })
      .eq('pass_id', input.passId)
      .neq('status', 'rejected')

    const numExisting = existingCount ?? 0

    // Determine approval level
    const approvalLevel = numExisting < maxResidentExtensions ? 'resident' : 'admin'

    // Max total stay guard
    const originalDuration = pass.duration_hours
    // Sum all approved extensions so far
    const { data: approvedExts } = await supabase
      .from('pass_extensions')
      .select('extend_hours')
      .eq('pass_id', input.passId)
      .eq('status', 'approved')
    const totalExtended = (approvedExts || []).reduce((sum: number, e: any) => sum + e.extend_hours, 0)
    const projectedTotal = originalDuration + totalExtended + input.extendHours
    if (projectedTotal > maxTotalStayHours) {
      return {
        success: false,
        error: `Cannot exceed maximum total stay of ${maxTotalStayHours}h. Currently at ${originalDuration + totalExtended}h.`,
      }
    }

    const now = new Date()
    const currentExpiry = new Date(pass.expiry_time)
    // If pass already expired (overstay), extend from now
    const baseTime   = currentExpiry < now ? now : currentExpiry
    const newExpiry  = new Date(baseTime.getTime() + input.extendHours * 60 * 60 * 1000)
    const wasOverstay = pass.status === 'overstay' || (currentExpiry < now)

    // Find active entry_log
    const { data: activeLog } = await supabase
      .from('entry_logs')
      .select('id')
      .eq('guest_pass_id', input.passId)
      .in('status', ['inside', 'overstay'])
      .order('entry_time', { ascending: false })
      .limit(1)
      .single()

    // Resident auto-approves first extension; subsequent need admin
    const autoApprove = approvalLevel === 'resident'

    const { data: ext, error } = await supabase
      .from('pass_extensions')
      .insert({
        pass_id:        input.passId,
        entry_log_id:   activeLog?.id ?? null,
        old_expiry:     pass.expiry_time,
        new_expiry:     newExpiry.toISOString(),
        extend_hours:   input.extendHours,
        status:         autoApprove ? 'approved' : 'pending',
        requested_by:   user.id,
        approved_by:    autoApprove ? user.id : null,
        approval_level: approvalLevel,
        reason:         input.reason?.trim() || null,
        resolved_at:    autoApprove ? now.toISOString() : null,
        was_overstay:   wasOverstay,
      })
      .select().single()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { success: false, error: 'Extension feature requires migration 008. Please run the migration in your Supabase dashboard.' }
      }
      return { success: false, error: error.message }
    }

    if (autoApprove) {
      // Apply extension immediately
      await applyExtension(supabase, input.passId, activeLog?.id ?? null, newExpiry)
    } else {
      // Notify admins for approval
      const { data: admins } = await supabase
        .from('profiles').select('id').eq('role', 'admin').eq('is_active', true)
      for (const admin of admins || []) {
        await notify(supabase, {
          recipient_id: admin.id,
          type:         'extension_request',
          title:        `Extension request: ${pass.guest_name}`,
          body:         `Resident ${profile.full_name} requests +${input.extendHours}h for ${pass.guest_name} (Apt ${pass.apartment_number}).`,
          metadata:     { extension_id: ext.id, pass_id: input.passId },
        })
      }
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'extension.requested', entity_type: 'pass_extension', entity_id: ext.id,
      metadata: {
        pass_id: input.passId, extend_hours: input.extendHours,
        approval_level: approvalLevel, auto_approved: autoApprove, was_overstay: wasOverstay,
      },
    })

    revalidatePath('/dashboard/resident/history')
    revalidatePath('/dashboard/resident')
    return { success: true, data: ext as PassExtension }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Extension request failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVE / REJECT EXTENSION (admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function reviewExtension(
  extensionId: string,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const { data: ext } = await supabase
      .from('pass_extensions')
      .select('*, pass:pass_id(guest_name, resident_id, expiry_time)')
      .eq('id', extensionId)
      .single()

    if (!ext) return { success: false, error: 'Extension not found' }
    if (ext.status !== 'pending') return { success: false, error: 'Extension already resolved' }

    const now = new Date().toISOString()

    await supabase.from('pass_extensions').update({
      status:      decision,
      approved_by: user.id,
      resolved_at: now,
      reason:      reason?.trim() || ext.reason,
    }).eq('id', extensionId)

    if (decision === 'approved') {
      await applyExtension(supabase, ext.pass_id, ext.entry_log_id, new Date(ext.new_expiry))
    }

    // Notify resident
    const notifType = decision === 'approved' ? 'extension_approved' : 'extension_rejected'
    await notify(supabase, {
      recipient_id: ext.pass.resident_id,
      type:         notifType,
      title:        decision === 'approved'
        ? `✅ Extension approved for ${ext.pass.guest_name}`
        : `❌ Extension rejected for ${ext.pass.guest_name}`,
      body: decision === 'approved'
        ? `+${ext.extend_hours}h approved. New expiry: ${new Date(ext.new_expiry).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })}.`
        : `Your extension request was rejected. ${reason ?? ''}`,
      metadata: { extension_id: extensionId, decision },
    })

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: decision === 'approved' ? 'extension.approved' : 'extension.rejected',
      entity_type: 'pass_extension', entity_id: extensionId,
      metadata: { decision, reason },
    })

    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Review failed' }
  }
}

// ─── Internal: apply approved extension to pass + entry_log ───────────────
async function applyExtension(
  supabase: any,
  passId: string,
  entryLogId: string | null,
  newExpiry: Date
): Promise<void> {
  // Update pass expiry and reset status if it was expired/overstay
  await supabase.from('guest_passes').update({
    expiry_time: newExpiry.toISOString(),
    status:      'valid',
  }).eq('id', passId)

  // Update entry log expected_exit_at and revert overstay → inside
  if (entryLogId) {
    await supabase.from('entry_logs').update({
      expected_exit_at: newExpiry.toISOString(),
      status:           'inside',
    }).eq('id', entryLogId).in('status', ['inside', 'overstay'])
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET EXTENSIONS for a pass
// ═══════════════════════════════════════════════════════════════════════════
export async function getPassExtensions(passId: string): Promise<ActionResult<PassExtension[]>> {
  try {
    const { supabase, user, profile } = await requireAuth()

    // Residents can only see their own
    if (profile.role === 'resident') {
      const { data: pass } = await supabase
        .from('guest_passes').select('resident_id').eq('id', passId).single()
      if (pass?.resident_id !== user.id) return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('pass_extensions')
      .select('*')
      .eq('pass_id', passId)
      .order('created_at', { ascending: false })

    if (error) {
      // Table doesn't exist yet — return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { success: true, data: [] }
      }
      return { success: false, error: error.message }
    }
    return { success: true, data: (data || []) as PassExtension[] }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch extensions' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET PENDING EXTENSIONS (admin approval queue)
// ═══════════════════════════════════════════════════════════════════════════
export async function getPendingExtensions(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const { data, error } = await supabase
      .from('pass_extensions')
      .select(`
        *,
        pass:pass_id(guest_name, apartment_number, expiry_time, status),
        requester:requested_by(full_name, apartment_number)
      `)
      .eq('status', 'pending')
      .eq('approval_level', 'admin')
      .order('created_at', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { success: true, data: [] }
      }
      return { success: false, error: error.message }
    }
    return { success: true, data: data || [] }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch' }
  }
}
