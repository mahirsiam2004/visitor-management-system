'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, PolicySettings } from '@/types'
import { writeAuditLog } from './audit'

// Default policy values — used when the policy_settings table doesn't exist yet
const DEFAULT_POLICY: PolicySettings = {
  id: 'default',
  overstay_grace_minutes: 15,
  overstay_penalty_rate_bdt: 50,
  overstay_notify_admin_after_minutes: 60,
  ending_soon_warn_minutes: 10,
  max_pass_duration_hours: 24,
  max_extensions_resident: 1,
  max_total_stay_hours: 48,
  delivery_reply_minutes: 2,
  delivery_access_window_min: 20,
  walk_in_reply_minutes: 5,
  event_approval_threshold: 50,
  max_sms_per_resident_per_day: 5,
  sms_critical_only: true,
  photo_retention_days: 90,
  penalty_enabled: true,
  updated_by: null,
  updated_at: new Date().toISOString(),
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Use maybeSingle() — never throws PGRST116
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return { supabase, user }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET POLICY
// Tries the DB table first, falls back to defaults if the table doesn't exist
// ═══════════════════════════════════════════════════════════════════════════
export async function getPolicy(): Promise<ActionResult<PolicySettings>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Direct table query — more reliable than RPC when schema cache is stale
    const { data, error } = await supabase
      .from('policy_settings')
      .select('*')
      .maybeSingle()

    if (error) {
      // Table doesn't exist yet (migration 008 not run) — return defaults
      console.warn('[policy] policy_settings table not found, using defaults:', error.message)
      return { success: true, data: DEFAULT_POLICY }
    }

    return { success: true, data: (data ?? DEFAULT_POLICY) as PolicySettings }
  } catch (e: any) {
    console.warn('[policy] getPolicy error, using defaults:', e.message)
    return { success: true, data: DEFAULT_POLICY }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE POLICY (admin only, fully audit logged)
// ═══════════════════════════════════════════════════════════════════════════
export async function updatePolicy(
  updates: Partial<Omit<PolicySettings, 'id' | 'updated_by' | 'updated_at'>>
): Promise<ActionResult<PolicySettings>> {
  try {
    const { supabase, user } = await requireAdmin()

    const { data: current } = await supabase
      .from('policy_settings').select('*').maybeSingle()

    if (!current) {
      return { success: false, error: 'Policy settings table not set up yet. Please run migration 008 in your Supabase dashboard.' }
    }

    const { data, error } = await supabase
      .from('policy_settings')
      .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Diff for audit
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      if (current[key] !== (updates as any)[key]) {
        diff[key] = { from: current[key], to: (updates as any)[key] }
      }
    }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: 'policy.changed', entity_type: 'policy_settings', entity_id: data.id,
      metadata: { changes: diff },
    })

    revalidatePath('/dashboard/admin/policy')
    return { success: true, data: data as PolicySettings }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update policy' }
  }
}
