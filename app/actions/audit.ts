'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditAction } from '@/types'

interface AuditLogParams {
  supabase: SupabaseClient
  actor_id: string | null
  actor_role: string
  action: AuditAction | string
  entity_type: string
  entity_id: string | null
  metadata?: Record<string, unknown>
  ip_address?: string
}

/**
 * Write a row to audit_log. Never throws — failures are logged to console
 * so they don't abort the parent operation.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await params.supabase.from('audit_log').insert({
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      metadata: params.metadata ?? {},
      ip_address: params.ip_address ?? null,
    })
    if (error) {
      console.error('[audit] Failed to write audit log:', error.message)
    }
  } catch (err) {
    console.error('[audit] Unexpected error writing audit log:', err)
  }
}
