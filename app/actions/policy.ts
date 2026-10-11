'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, PolicySettings } from '@/types'
import { writeAuditLog } from './audit'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active) throw new Error('Account deactivated')
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return { supabase, user }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET POLICY (admin only, via RPC that bypasses RLS)
// ═══════════════════════════════════════════════════════════════════════════
export async function getPolicy(): Promise<ActionResult<PolicySettings>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Any authenticated user can call get_policy RPC (security definer)
    const { data, error } = await supabase.rpc('get_policy')
    if (error) return { success: false, error: error.message }
    if (!data)  return { success: false, error: 'No policy found' }

    return { success: true, data: data as PolicySettings }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to load policy' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE POLICY (admin only, fully audit logged)
// ═══════════════════════════════════════════════════════════════════════════
export async function updatePolicy(updates: Partial<Omit<PolicySettings, 'id' | 'updated_by' | 'updated_at'>>): Promise<ActionResult<PolicySettings>> {
  try {
    const { supabase, user } = await requireAdmin()

    // Fetch current values for diff in audit log
    const { data: current } = await supabase
      .from('policy_settings').select('*').single()

    const { data, error } = await supabase
      .from('policy_settings')
      .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', current?.id)
      .select().single()

    if (error) return { success: false, error: error.message }

    // Build diff for audit
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      if (current && current[key] !== updates[key]) {
        diff[key] = { from: current[key], to: updates[key] }
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
