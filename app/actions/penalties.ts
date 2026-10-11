'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Penalty, PaginatedResult } from '@/types'
import { writeAuditLog } from './audit'
import { downloadCSV } from '@/lib/utils'
import { PAGE_SIZE } from '@/constants'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile) throw new Error('Profile not found')
  if (!profile.is_active) throw new Error('Account deactivated')
  return { supabase, user, profile }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MY PENALTIES (resident)
// ═══════════════════════════════════════════════════════════════════════════
export async function getMyPenalties(params?: {
  page?: number; status?: string; monthYear?: string
}): Promise<ActionResult<PaginatedResult<Penalty>>> {
  try {
    const { supabase, user } = await requireAuth()

    const page     = params?.page || 1
    const pageSize = PAGE_SIZE
    const from     = (page - 1) * pageSize
    const to       = from + pageSize - 1

    let query = supabase
      .from('penalties')
      .select(`
        *,
        pass:pass_id(guest_name, purpose),
        waiver:waived_by(full_name)
      `, { count: 'exact' })
      .eq('resident_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params?.status)    query = query.eq('status', params.status)
    if (params?.monthYear) query = query.eq('month_year', params.monthYear)

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: {
        data: (data || []) as Penalty[],
        total: count || 0, page, pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch penalties' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL PENALTIES (admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function getAllPenalties(params?: {
  page?: number; status?: string; monthYear?: string; residentId?: string
}): Promise<ActionResult<PaginatedResult<any>>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const page     = params?.page || 1
    const pageSize = PAGE_SIZE
    const from     = (page - 1) * pageSize
    const to       = from + pageSize - 1

    let query = supabase
      .from('penalties')
      .select(`
        *,
        resident:resident_id(full_name, apartment_number, email),
        pass:pass_id(guest_name, purpose),
        waiver:waived_by(full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params?.status)     query = query.eq('status', params.status)
    if (params?.monthYear)  query = query.eq('month_year', params.monthYear)
    if (params?.residentId) query = query.eq('resident_id', params.residentId)

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: {
        data: data || [],
        total: count || 0, page, pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to fetch penalties' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WAIVE PENALTY (admin — mandatory reason, audit logged)
// ═══════════════════════════════════════════════════════════════════════════
export async function waivePenalty(penaltyId: string, reason: string): Promise<ActionResult> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }
    if (!reason.trim()) return { success: false, error: 'A reason is required to waive a penalty' }

    const { data: penalty } = await supabase
      .from('penalties').select('status, resident_id, amount_bdt').eq('id', penaltyId).single()
    if (!penalty) return { success: false, error: 'Penalty not found' }
    if (penalty.status === 'waived') return { success: false, error: 'Already waived' }

    const now = new Date().toISOString()
    const { error } = await supabase.from('penalties').update({
      status:      'waived',
      waived_by:   user.id,
      waive_reason: reason.trim(),
      waived_at:   now,
    }).eq('id', penaltyId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: 'penalty.waived', entity_type: 'penalty', entity_id: penaltyId,
      metadata: { reason, amount_bdt: penalty.amount_bdt },
    })

    revalidatePath('/dashboard/admin/penalties')
    return { success: true, data: undefined }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Waive failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MARK PENALTIES AS ADDED TO BILL (admin — bulk by month)
// ═══════════════════════════════════════════════════════════════════════════
export async function markMonthBilled(monthYear: string): Promise<ActionResult<{ count: number }>> {
  try {
    const { supabase, user, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const { data, error } = await supabase
      .from('penalties')
      .update({ status: 'added_to_bill' })
      .eq('month_year', monthYear)
      .eq('status', 'pending')
      .select('id')

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: 'penalty.bill_added', entity_type: 'penalty', entity_id: null,
      metadata: { month_year: monthYear, count: data?.length },
    })

    revalidatePath('/dashboard/admin/penalties')
    return { success: true, data: { count: data?.length ?? 0 } }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to mark billed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT MONTHLY PENALTY REPORT (admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function exportMonthlyPenaltyReport(monthYear: string): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile, user } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const { data, error } = await supabase
      .from('penalties')
      .select(`
        id, minutes_over, amount_bdt, status, month_year, created_at,
        waive_reason, waived_at,
        resident:resident_id(full_name, apartment_number, email, phone_number),
        pass:pass_id(guest_name, purpose),
        waiver:waived_by(full_name)
      `)
      .eq('month_year', monthYear)
      .order('created_at', { ascending: true })

    if (error) return { success: false, error: error.message }

    const rows = (data || []).map((p: any) => ({
      'Month':           p.month_year,
      'Resident Name':   p.resident?.full_name ?? '',
      'Apartment':       p.resident?.apartment_number ?? '',
      'Email':           p.resident?.email ?? '',
      'Phone':           p.resident?.phone_number ?? '',
      'Guest Name':      p.pass?.guest_name ?? '',
      'Purpose':         p.pass?.purpose ?? '',
      'Minutes Over':    p.minutes_over,
      'Amount (BDT)':    p.amount_bdt,
      'Status':          p.status,
      'Waive Reason':    p.waive_reason ?? '',
      'Waived By':       p.waiver?.full_name ?? '',
      'Waived At':       p.waived_at ?? '',
      'Created At':      p.created_at,
    }))

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: 'export.done', entity_type: 'penalty', entity_id: null,
      metadata: { month_year: monthYear, rows: rows.length },
    })

    return { success: true, data: rows }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Export failed' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MONTHLY SUMMARY (totals by apartment for dashboard)
// ═══════════════════════════════════════════════════════════════════════════
export async function getMonthlySummary(monthYear?: string): Promise<ActionResult<any[]>> {
  try {
    const { supabase, profile } = await requireAuth()
    if (profile.role !== 'admin') return { success: false, error: 'Admin only' }

    const targetMonth = monthYear ?? new Date().toISOString().slice(0, 7)

    const { data, error } = await supabase
      .from('penalties')
      .select(`
        amount_bdt, status, minutes_over,
        resident:resident_id(full_name, apartment_number)
      `)
      .eq('month_year', targetMonth)

    if (error) return { success: false, error: error.message }

    // Aggregate by apartment
    const summary: Record<string, any> = {}
    ;(data || []).forEach((p: any) => {
      const apt = p.resident?.apartment_number ?? 'Unknown'
      if (!summary[apt]) {
        summary[apt] = {
          apartment: apt,
          resident_name: p.resident?.full_name ?? '',
          total_bdt: 0,
          total_minutes: 0,
          pending_count: 0,
          waived_count: 0,
          billed_count: 0,
        }
      }
      summary[apt].total_bdt     += Number(p.amount_bdt)
      summary[apt].total_minutes += p.minutes_over
      if (p.status === 'pending')       summary[apt].pending_count++
      else if (p.status === 'waived')   summary[apt].waived_count++
      else if (p.status === 'added_to_bill') summary[apt].billed_count++
    })

    return {
      success: true,
      data: Object.values(summary).sort((a: any, b: any) => b.total_bdt - a.total_bdt),
    }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed' }
  }
}
