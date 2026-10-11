'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, BlacklistEntry } from '@/types'
import { writeAuditLog } from './audit'

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

// ═══════════════════════════════════════════════════════════════════════════
// CHECK AGAINST BLACKLIST (guard — called before any check-in)
// ═══════════════════════════════════════════════════════════════════════════
export async function checkBlacklist(
  name: string,
  phone?: string,
  apartment?: string
): Promise<ActionResult<{ matched: boolean; entries: BlacklistEntry[] }>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    const nameLower = name.toLowerCase().trim()

    const { data, error } = await supabase
      .from('blacklist')
      .select('*')
      .eq('is_active', true)

    if (error) return { success: false, error: error.message }

    const entries: BlacklistEntry[] = (data || []).filter((entry: any) => {
      const nameMatch = entry.name.toLowerCase().includes(nameLower) || nameLower.includes(entry.name.toLowerCase())
      const phoneMatch = phone && entry.phone && (entry.phone === phone || entry.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''))
      const scopeOk = entry.scope === 'building' || (entry.scope === 'apartment' && entry.apartment === apartment)
      return (nameMatch || phoneMatch) && scopeOk
    })

    return { success: true, data: { matched: entries.length > 0, entries } }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Blacklist check failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD TO BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════
export async function addToBlacklist(input: {
  name: string
  phone?: string
  reason: string
  scope: 'building' | 'apartment'
  apartment?: string
}): Promise<ActionResult<BlacklistEntry>> {
  try {
    const { supabase, user, profile } = await requireAuth()

    // Residents can only add apartment-scoped entries
    if (profile.role === 'resident' && input.scope === 'building') {
      return { success: false, error: 'Residents can only blacklist for their own apartment' }
    }
    if (profile.role === 'resident' && input.scope === 'apartment' && !profile.apartment_number) {
      return { success: false, error: 'No apartment set on your profile' }
    }

    const { data, error } = await supabase
      .from('blacklist')
      .insert({
        name:      input.name.trim(),
        phone:     input.phone || null,
        reason:    input.reason.trim(),
        scope:     input.scope,
        added_by:  user.id,
        apartment: input.scope === 'apartment'
          ? (input.apartment || profile.apartment_number)
          : null,
        is_active: true,
      })
      .select().single()

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'blacklist.added', entity_type: 'blacklist', entity_id: data.id,
      metadata: { name: input.name, scope: input.scope },
    })

    revalidatePath('/dashboard/admin/blacklist')
    return { success: true, data: data as BlacklistEntry }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to add to blacklist' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REMOVE FROM BLACKLIST (soft)
// ═══════════════════════════════════════════════════════════════════════════
export async function removeFromBlacklist(entryId: string): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()

    const { data: entry } = await supabase
      .from('blacklist').select('added_by').eq('id', entryId).single()
    if (!entry) return { success: false, error: 'Entry not found' }

    if (entry.added_by !== user.id && profile.role !== 'admin') {
      return { success: false, error: 'Not authorized to remove this entry' }
    }

    await supabase.from('blacklist').update({ is_active: false }).eq('id', entryId)

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: profile.role,
      action: 'blacklist.removed', entity_type: 'blacklist', entity_id: entryId,
      metadata: {},
    })

    revalidatePath('/dashboard/admin/blacklist')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to remove' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL BLACKLIST ENTRIES (admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function getBlacklist(activeOnly = true): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (!['security', 'admin'].includes(profile.role)) return { success: false, error: 'Unauthorized' }

    let query = supabase
      .from('blacklist')
      .select('*, added_by_profile:added_by(full_name, role)')
      .order('created_at', { ascending: false })
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) return { success: true, data: [] }
    return { success: true, data: data || [] }
  } catch (_e: any) {
    return { success: true, data: [] }
  }
}
