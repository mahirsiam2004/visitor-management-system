'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  ActionResult,
  Profile,
  AdminStats,
  PaginatedResult,
  AnalyticsData,
} from '@/types'
import { PAGE_SIZE } from '@/constants'
import { writeAuditLog } from './audit'

// ----------------------------------------------------------------
// Internal guard
// ----------------------------------------------------------------
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (profile?.is_active === false) throw new Error('Your account has been deactivated')
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return { supabase, user, profile }
}

// ----------------------------------------------------------------
// Admin stats — all counts from DB, using expiry_time for accuracy
// ----------------------------------------------------------------
export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  try {
    const { supabase } = await requireAdmin()

    const now = new Date().toISOString()

    const [
      { count: totalResidents },
      { count: totalSecurity },
      { count: totalPasses },
      { count: activePasses },
      { count: expiredPasses },
      { count: revokedPasses },
      { count: usedPasses },
      { count: activeGuests },
      { count: completedVisits },
      { count: overstayCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'resident').eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'security').eq('is_active', true),
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }).is('archived_at', null),
      // Active = stored 'valid' AND expiry_time in the future
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }).eq('status', 'valid').gt('expiry_time', now).is('archived_at', null),
      // Expired = stored 'expired' OR (stored 'valid' AND past expiry)
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }).or(`status.eq.expired,and(status.eq.valid,expiry_time.lt.${now})`).is('archived_at', null),
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }).eq('status', 'revoked').is('archived_at', null),
      supabase.from('guest_passes').select('*', { count: 'exact', head: true }).eq('status', 'used').is('archived_at', null),
      supabase.from('entry_logs').select('*', { count: 'exact', head: true }).eq('status', 'inside'),
      supabase.from('entry_logs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('entry_logs').select('*', { count: 'exact', head: true }).eq('status', 'overstay'),
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
        revokedPasses: revokedPasses || 0,
        usedPasses: usedPasses || 0,
        overstayCount: overstayCount || 0,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch stats' }
  }
}

// ----------------------------------------------------------------
// Get all profiles (paginated)
// ----------------------------------------------------------------
export async function getAllProfiles(params?: {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  includeInactive?: boolean
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

    if (!params?.includeInactive) query = query.eq('is_active', true)
    if (params?.role) query = query.eq('role', params.role)
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

// ----------------------------------------------------------------
// Update user role — with self-demotion and last-admin guards
// ----------------------------------------------------------------
export async function updateUserRole(
  userId: string,
  role: 'resident' | 'security' | 'admin'
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdmin()

    // Prevent self-demotion
    if (userId === user.id && role !== 'admin') {
      return { success: false, error: 'You cannot demote yourself' }
    }

    // Prevent last-admin lockout
    if (role !== 'admin') {
      const { count: adminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)

      if ((adminCount || 0) <= 1) {
        const { data: target } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()
        if (target?.role === 'admin') {
          return { success: false, error: 'Cannot demote the last admin' }
        }
      }
    }

    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single()

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: 'admin',
      action: 'role.changed',
      entity_type: 'profile',
      entity_id: userId,
      metadata: { old_role: oldProfile?.role, new_role: role, user_name: oldProfile?.full_name },
    })

    revalidatePath('/dashboard/admin/residents')
    revalidatePath('/dashboard/admin/security')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to update role' }
  }
}

// ----------------------------------------------------------------
// Deactivate user (replaces hard-delete)
// ----------------------------------------------------------------
export async function deactivateUser(
  userId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdmin()

    if (userId === user.id) {
      return { success: false, error: 'You cannot deactivate yourself' }
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('role, full_name, is_active')
      .eq('id', userId)
      .single()

    if (!target) return { success: false, error: 'User not found' }
    if (!target.is_active) return { success: false, error: 'User is already deactivated' }

    // Prevent deactivating last admin
    if (target.role === 'admin') {
      const { count: adminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)
      if ((adminCount || 0) <= 1) {
        return { success: false, error: 'Cannot deactivate the last admin' }
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: user.id,
        deactivation_reason: reason.trim() || 'Deactivated by admin',
      })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: 'admin',
      action: 'user.deactivated',
      entity_type: 'profile',
      entity_id: userId,
      metadata: { reason, user_name: target.full_name, role: target.role },
    })

    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to deactivate user' }
  }
}

// ----------------------------------------------------------------
// Reactivate user
// ----------------------------------------------------------------
export async function reactivateUser(userId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdmin()

    const { data: target } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const { error } = await supabase
      .from('profiles')
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null,
      })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: 'admin',
      action: 'user.reactivated',
      entity_type: 'profile',
      entity_id: userId,
      metadata: { user_name: target?.full_name },
    })

    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to reactivate user' }
  }
}

// ----------------------------------------------------------------
// Create security guard (admin-only invite flow)
// ----------------------------------------------------------------
export async function createSecurityGuard(params: {
  email: string
  fullName: string
  phoneNumber?: string
  password: string
}): Promise<ActionResult<{ userId: string }>> {
  try {
    const { supabase, user } = await requireAdmin()

    // Use signUp with role=security in metadata
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          full_name: params.fullName,
          phone_number: params.phoneNumber || null,
          role: 'resident', // trigger hardcodes resident; we update below
        },
      },
    })

    if (error) return { success: false, error: error.message }
    if (!data.user) return { success: false, error: 'Failed to create auth user' }

    // Upsert profile with security role
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email: params.email,
      full_name: params.fullName,
      phone_number: params.phoneNumber || null,
      role: 'security',
      is_active: true,
    })

    if (profileError) return { success: false, error: profileError.message }

    await writeAuditLog({
      supabase,
      actor_id: user.id,
      actor_role: 'admin',
      action: 'user.created',
      entity_type: 'profile',
      entity_id: data.user.id,
      metadata: { role: 'security', full_name: params.fullName, email: params.email },
    })

    revalidatePath('/dashboard/admin/security')
    return { success: true, data: { userId: data.user.id } }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to create security guard' }
  }
}

// ----------------------------------------------------------------
// Analytics — fixed 30-day UTC window, comprehensive data
// ----------------------------------------------------------------
export async function getAnalyticsData(params?: {
  dateFrom?: string
  dateTo?: string
}): Promise<ActionResult<AnalyticsData>> {
  try {
    const { supabase } = await requireAdmin()

    // Default: last 30 days in UTC
    const toDate = params?.dateTo
      ? new Date(params.dateTo + 'T23:59:59.999Z')
      : new Date()
    const fromDate = params?.dateFrom
      ? new Date(params.dateFrom + 'T00:00:00.000Z')
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [passesResult, logsResult] = await Promise.all([
      supabase
        .from('guest_passes')
        .select('id, created_at, purpose, apartment_number, guest_name, guest_phone, status')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: true }),

      supabase
        .from('entry_logs')
        .select('id, entry_time, exit_time, status, guest_pass_id')
        .gte('entry_time', fromDate.toISOString())
        .lte('entry_time', toDate.toISOString())
        .order('entry_time', { ascending: true }),
    ])

    const passes = passesResult.data || []
    const logs = logsResult.data || []

    // Passes per day (keyed by YYYY-MM-DD in UTC)
    const passesPerDayMap: Record<string, number> = {}
    passes.forEach((p) => {
      const isoDate = p.created_at.slice(0, 10) // UTC date
      passesPerDayMap[isoDate] = (passesPerDayMap[isoDate] || 0) + 1
    })
    const passesPerDay = Object.entries(passesPerDayMap).map(([isoDate, count]) => ({
      isoDate,
      date: new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      count,
    }))

    // Visits by purpose
    const purposeMap: Record<string, number> = {}
    passes.forEach((p) => { purposeMap[p.purpose] = (purposeMap[p.purpose] || 0) + 1 })
    const visitsByPurpose = Object.entries(purposeMap)
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Visitors by apartment
    const aptMap: Record<string, number> = {}
    passes.forEach((p) => {
      if (p.apartment_number) aptMap[p.apartment_number] = (aptMap[p.apartment_number] || 0) + 1
    })
    const visitorsByApartment = Object.entries(aptMap)
      .map(([apartment, count]) => ({ apartment, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Entry vs exit by hour (0-23)
    const hourMap: Record<number, { entries: number; exits: number }> = {}
    for (let h = 0; h < 24; h++) hourMap[h] = { entries: 0, exits: 0 }
    logs.forEach((l) => {
      const entryHour = new Date(l.entry_time).getUTCHours()
      hourMap[entryHour].entries += 1
      if (l.exit_time) {
        const exitHour = new Date(l.exit_time).getUTCHours()
        hourMap[exitHour].exits += 1
      }
    })
    const entryExitByHour = Object.entries(hourMap).map(([h, v]) => ({
      hour: Number(h),
      label: `${Number(h).toString().padStart(2, '0')}:00`,
      entries: v.entries,
      exits: v.exits,
    }))

    // Monthly visitors (last 12 months)
    const monthMap: Record<string, number> = {}
    logs.forEach((l) => {
      const d = new Date(l.entry_time)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      monthMap[key] = (monthMap[key] || 0) + 1
    })
    const monthlyVisitors = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: new Date(month + '-01T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count,
      }))

    // Frequent visitors (top 10 by visit count)
    const visitorMap: Record<string, { guest_name: string; guest_phone: string | null; visit_count: number }> = {}
    passes.forEach((p) => {
      const key = (p.guest_name + (p.guest_phone || '')).toLowerCase()
      if (!visitorMap[key]) {
        visitorMap[key] = { guest_name: p.guest_name, guest_phone: p.guest_phone, visit_count: 0 }
      }
      visitorMap[key].visit_count += 1
    })
    const frequentVisitors = Object.values(visitorMap)
      .sort((a, b) => b.visit_count - a.visit_count)
      .slice(0, 10)

    // Avg stay duration (only completed)
    const completedLogs = logs.filter((l) => l.status === 'completed' && l.exit_time)
    const avgStayMinutes = completedLogs.length > 0
      ? Math.round(
          completedLogs.reduce((sum, l) => {
            const diff = new Date(l.exit_time!).getTime() - new Date(l.entry_time).getTime()
            return sum + diff / 60000
          }, 0) / completedLogs.length
        )
      : 0

    const overstayCount = logs.filter((l) => l.status === 'overstay').length
    const totalEntries = logs.length
    const totalExits = logs.filter((l) => l.exit_time).length

    // Peak day
    const peakEntry = passesPerDay.reduce<{ date: string; count: number; isoDate: string } | null>(
      (max, d) => (!max || d.count > max.count ? d : max),
      null
    )

    return {
      success: true,
      data: {
        passesPerDay,
        visitsByPurpose,
        visitorsByApartment,
        entryExitByHour,
        monthlyVisitors,
        frequentVisitors,
        totalVisitors: passes.length,
        avgStayMinutes,
        overstayCount,
        peakDay: peakEntry ? { date: peakEntry.date, count: peakEntry.count } : null,
        totalEntries,
        totalExits,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch analytics' }
  }
}

// ----------------------------------------------------------------
// Export — CSV guest passes
// ----------------------------------------------------------------
export async function exportGuestPassesCSV(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, user } = await requireAdmin()

    const { data, error } = await supabase
      .from('guest_passes')
      .select(`
        guest_id, guest_name, guest_phone, apartment_number,
        visit_date, visit_time, duration_hours, purpose, status,
        expiry_time, archived_at, archive_reason, created_at,
        resident:resident_id ( full_name, email )
      `)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const formatted = data?.map((p: any) => ({
      'Guest ID': p.guest_id,
      'Guest Name': p.guest_name,
      'Guest Phone': p.guest_phone || '',
      'Apartment': p.apartment_number,
      'Visit Date': p.visit_date,
      'Visit Time': p.visit_time,
      'Duration (hours)': p.duration_hours,
      'Purpose': p.purpose,
      'Status': p.status,
      'Expiry Time': p.expiry_time,
      'Archived At': p.archived_at || '',
      'Archive Reason': p.archive_reason || '',
      'Resident Name': (p.resident as any)?.full_name || '',
      'Resident Email': (p.resident as any)?.email || '',
      'Created At': p.created_at,
    }))

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: 'export.done', entity_type: 'guest_pass', entity_id: null,
      metadata: { rows: formatted?.length, type: 'csv' },
    })

    return { success: true, data: formatted || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to export data' }
  }
}

// ----------------------------------------------------------------
// Export — CSV entry logs
// ----------------------------------------------------------------
export async function exportEntryLogsCSV(): Promise<ActionResult<any[]>> {
  try {
    const { supabase, user } = await requireAdmin()

    const { data, error } = await supabase
      .from('entry_logs')
      .select(`
        entry_time, exit_time, expected_exit_at, status, checkout_type, notes,
        guest_pass:guest_pass_id ( guest_name, guest_id, apartment_number, purpose ),
        security_guard:security_guard_id ( full_name )
      `)
      .order('entry_time', { ascending: false })

    if (error) return { success: false, error: error.message }

    const formatted = data?.map((l: any) => ({
      'Guest Name': l.guest_pass?.guest_name || '',
      'Guest ID': l.guest_pass?.guest_id || '',
      'Apartment': l.guest_pass?.apartment_number || '',
      'Purpose': l.guest_pass?.purpose || '',
      'Entry Time': l.entry_time,
      'Exit Time': l.exit_time || '',
      'Expected Exit At': l.expected_exit_at || '',
      'Status': l.status,
      'Checkout Type': l.checkout_type || '',
      'Security Guard': l.security_guard?.full_name || '',
      'Notes': l.notes || '',
    }))

    await writeAuditLog({
      supabase, actor_id: user.id, actor_role: 'admin',
      action: 'export.done', entity_type: 'entry_log', entity_id: null,
      metadata: { rows: formatted?.length, type: 'csv' },
    })

    return { success: true, data: formatted || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to export data' }
  }
}
