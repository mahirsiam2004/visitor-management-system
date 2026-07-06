'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Profile, AdminStats, PaginatedResult } from '@/types'
import { PAGE_SIZE } from '@/constants'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return { supabase, user }
}

export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  try {
    const { supabase } = await requireAdmin()

    const [
      { count: totalResidents },
      { count: totalSecurity },
      { count: totalPasses },
      { count: activeGuests },
      { count: completedVisits },
      { count: expiredPasses },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'resident'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'security'),
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }),
      supabase.from('entry_logs').select('*', { count: 'exact', head: true }).eq('status', 'inside'),
      supabase.from('entry_logs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    ])

    return {
      success: true,
      data: {
        totalResidents: totalResidents || 0,
        totalSecurityGuards: totalSecurity || 0,
        totalGuestPasses: totalPasses || 0,
        activeGuests: activeGuests || 0,
        completedVisits: completedVisits || 0,
        expiredPasses: expiredPasses || 0,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch stats' }
  }
}

export async function getAllProfiles(params?: {
  page?: number
  pageSize?: number
  search?: string
  role?: string
}): Promise<ActionResult<PaginatedResult<Profile>>> {
  try {
    const { supabase } = await requireAdmin()

    const page = params?.page || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params?.role) {
      query = query.eq('role', params.role)
    }

    if (params?.search) {
      query = query.or(
        `full_name.ilike.%${params.search}%,email.ilike.%${params.search}%,apartment_number.ilike.%${params.search}%`
      )
    }

    const { data, error, count } = await query

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch profiles' }
  }
}

export async function updateUserRole(userId: string, role: 'resident' | 'security' | 'admin'): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin()

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/admin/residents')
    revalidatePath('/dashboard/admin/security')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to update role' }
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin()

    // Delete profile (cascade will handle related data)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to delete user' }
  }
}

export async function getAnalyticsData(): Promise<ActionResult<{
  passesPerDay: { date: string; count: number }[]
  visitsByPurpose: { purpose: string; count: number }[]
  visitorsByApartment: { apartment: string; count: number }[]
}>> {
  try {
    const { supabase } = await requireAdmin()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentPasses } = await supabase
      .from('guest_passes')
      .select('created_at, purpose, apartment_number')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    // Aggregate passes per day
    const passesPerDayMap: Record<string, number> = {}
    recentPasses?.forEach((pass) => {
      const date = new Date(pass.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      passesPerDayMap[date] = (passesPerDayMap[date] || 0) + 1
    })

    const passesPerDay = Object.entries(passesPerDayMap).map(([date, count]) => ({
      date,
      count,
    }))

    // Aggregate visits by purpose
    const purposeMap: Record<string, number> = {}
    recentPasses?.forEach((pass) => {
      purposeMap[pass.purpose] = (purposeMap[pass.purpose] || 0) + 1
    })

    const visitsByPurpose = Object.entries(purposeMap)
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Aggregate by apartment
    const apartmentMap: Record<string, number> = {}
    recentPasses?.forEach((pass) => {
      if (pass.apartment_number) {
        apartmentMap[pass.apartment_number] = (apartmentMap[pass.apartment_number] || 0) + 1
      }
    })

    const visitorsByApartment = Object.entries(apartmentMap)
      .map(([apartment, count]) => ({ apartment, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      success: true,
      data: {
        passesPerDay,
        visitsByPurpose,
        visitorsByApartment,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch analytics' }
  }
}

export async function exportGuestPassesCSV(): Promise<ActionResult<any[]>> {
  try {
    const { supabase } = await requireAdmin()

    const { data, error } = await supabase
      .from('guest_passes')
      .select(`
        guest_id,
        guest_name,
        guest_phone,
        apartment_number,
        visit_date,
        visit_time,
        duration_hours,
        purpose,
        status,
        expiry_time,
        created_at,
        resident:resident_id (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const formatted = data?.map((pass: any) => ({
      'Guest ID': pass.guest_id,
      'Guest Name': pass.guest_name,
      'Guest Phone': pass.guest_phone || '',
      'Apartment': pass.apartment_number,
      'Visit Date': pass.visit_date,
      'Visit Time': pass.visit_time,
      'Duration (hours)': pass.duration_hours,
      'Purpose': pass.purpose,
      'Status': pass.status,
      'Expiry Time': pass.expiry_time,
      'Resident Name': pass.resident?.full_name || '',
      'Resident Email': pass.resident?.email || '',
      'Created At': pass.created_at,
    }))

    return { success: true, data: formatted || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to export data' }
  }
}

export async function exportEntryLogsCSV(): Promise<ActionResult<any[]>> {
  try {
    const { supabase } = await requireAdmin()

    const { data, error } = await supabase
      .from('entry_logs')
      .select(`
        entry_time,
        exit_time,
        status,
        notes,
        guest_pass:guest_pass_id (
          guest_name,
          guest_id,
          apartment_number,
          purpose
        ),
        security_guard:security_guard_id (
          full_name
        )
      `)
      .order('entry_time', { ascending: false })

    if (error) return { success: false, error: error.message }

    const formatted = data?.map((log: any) => ({
      'Guest Name': log.guest_pass?.guest_name || '',
      'Guest ID': log.guest_pass?.guest_id || '',
      'Apartment': log.guest_pass?.apartment_number || '',
      'Purpose': log.guest_pass?.purpose || '',
      'Entry Time': log.entry_time,
      'Exit Time': log.exit_time || '',
      'Status': log.status,
      'Security Guard': log.security_guard?.full_name || '',
      'Notes': log.notes || '',
    }))

    return { success: true, data: formatted || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to export data' }
  }
}
