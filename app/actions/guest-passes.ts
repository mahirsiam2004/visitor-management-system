'use server'

import { createClient } from '@/lib/supabase/server'
import {
  generateQRToken,
  generateGuestId,
  calculateExpiryTime,
  isPassExpired,
} from '@/lib/utils/guest-pass'
import {
  createGuestPassSchema,
  checkInGuestSchema,
  checkOutGuestSchema,
} from '@/lib/validations/schemas'
import { revalidatePath } from 'next/cache'
import type { ActionResult, GuestPass, EntryLog, VerifyTokenResult, PaginatedResult } from '@/types'
import { PAGE_SIZE } from '@/constants'

export async function createGuestPass(input: unknown): Promise<ActionResult<GuestPass>> {
  try {
    const validated = createGuestPassSchema.parse(input)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('apartment_number, role')
      .eq('id', user.id)
      .single()

    if (!profile) return { success: false, error: 'Profile not found' }
    if (profile.role !== 'resident') return { success: false, error: 'Only residents can create guest passes' }
    if (!profile.apartment_number) return { success: false, error: 'Please set your apartment number in your profile before creating a guest pass' }

    const guestId = generateGuestId()
    const qrToken = generateQRToken()
    const expiryTime = calculateExpiryTime(
      validated.visitDate,
      validated.visitTime,
      validated.durationHours
    )

    const { data, error } = await supabase
      .from('guest_passes')
      .insert({
        guest_id: guestId,
        guest_name: validated.guestName,
        guest_phone: validated.guestPhone || null,
        resident_id: user.id,
        apartment_number: profile.apartment_number,
        visit_date: validated.visitDate,
        visit_time: validated.visitTime,
        expiry_time: expiryTime.toISOString(),
        duration_hours: validated.durationHours,
        purpose: validated.purpose,
        qr_token: qrToken,
        status: 'valid',
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')

    return { success: true, data }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to create guest pass' }
  }
}

export async function getGuestPasses(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  residentId?: string
}): Promise<ActionResult<PaginatedResult<GuestPass>>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const page = params?.page || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('guest_passes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (profile?.role === 'resident') {
      query = query.eq('resident_id', user.id)
    } else if (params?.residentId) {
      query = query.eq('resident_id', params.residentId)
    }

    if (params?.status) {
      query = query.eq('status', params.status)
    }

    if (params?.search) {
      query = query.or(
        `guest_name.ilike.%${params.search}%,guest_id.ilike.%${params.search}%,apartment_number.ilike.%${params.search}%,purpose.ilike.%${params.search}%`
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
    return { success: false, error: 'Failed to fetch guest passes' }
  }
}

export async function getResidentGuestPassStats(): Promise<ActionResult<{
  totalGuests: number
  activeGuests: number
  expiredPasses: number
  completedVisits: number
}>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: passes } = await supabase
      .from('guest_passes')
      .select('status, expiry_time')
      .eq('resident_id', user.id)

    const { data: completedLogs } = await supabase
      .from('entry_logs')
      .select('id, guest_pass:guest_pass_id(resident_id)')
      .eq('status', 'completed')

    const total = passes?.length || 0
    const expired = passes?.filter((p) => p.status === 'expired' || isPassExpired(p.expiry_time)).length || 0
    const active = passes?.filter((p) => p.status === 'valid' && !isPassExpired(p.expiry_time)).length || 0
    const completed = completedLogs?.filter((l: any) => l.guest_pass?.resident_id === user.id).length || 0

    return {
      success: true,
      data: {
        totalGuests: total,
        activeGuests: active,
        expiredPasses: expired,
        completedVisits: completed,
      },
    }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch stats' }
  }
}

export async function updateGuestPassStatus(
  guestPassId: string,
  status: 'valid' | 'expired' | 'revoked'
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: guestPass } = await supabase
      .from('guest_passes')
      .select('resident_id')
      .eq('id', guestPassId)
      .single()

    if (!guestPass) return { success: false, error: 'Guest pass not found' }

    if (profile?.role !== 'admin' && guestPass.resident_id !== user.id) {
      return { success: false, error: 'You are not authorized to update this pass' }
    }

    const { error } = await supabase
      .from('guest_passes')
      .update({ status })
      .eq('id', guestPassId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/resident')
    revalidatePath('/dashboard/admin')

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to update guest pass' }
  }
}

export async function deleteGuestPass(guestPassId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can delete guest passes' }
    }

    const { error } = await supabase
      .from('guest_passes')
      .delete()
      .eq('id', guestPassId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/admin')
    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to delete guest pass' }
  }
}

export async function verifyGuestToken(token: string): Promise<ActionResult<VerifyTokenResult>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('verify_guest_token', {
      p_token: token,
    })

    if (error) return { success: false, error: error.message }

    return { success: true, data: data as VerifyTokenResult }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to verify token' }
  }
}

export async function checkInGuest(input: unknown): Promise<ActionResult<EntryLog>> {
  try {
    const validated = checkInGuestSchema.parse(input)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['security', 'admin'].includes(profile?.role || '')) {
      return { success: false, error: 'Only security guards can check in guests' }
    }

    const { data: guestPass, error: passError } = await supabase
      .from('guest_passes')
      .select('*')
      .eq('qr_token', validated.token)
      .single()

    if (passError || !guestPass) return { success: false, error: 'Invalid QR token. Guest pass not found.' }

    if (guestPass.status === 'revoked') return { success: false, error: 'This guest pass has been revoked.' }
    if (guestPass.status === 'expired' || isPassExpired(guestPass.expiry_time)) {
      return { success: false, error: 'This guest pass has expired.' }
    }

    const { data: existingLog } = await supabase
      .from('entry_logs')
      .select('id, status')
      .eq('guest_pass_id', guestPass.id)
      .eq('status', 'inside')
      .single()

    if (existingLog) return { success: false, error: 'Guest is already inside the building.' }

    const { data: completedLog } = await supabase
      .from('entry_logs')
      .select('id')
      .eq('guest_pass_id', guestPass.id)
      .eq('status', 'completed')
      .single()

    if (completedLog) return { success: false, error: 'Guest has already completed their visit.' }

    const { data: entryLog, error: logError } = await supabase
      .from('entry_logs')
      .insert({
        guest_pass_id: guestPass.id,
        security_guard_id: user.id,
        entry_time: new Date().toISOString(),
        status: 'inside',
      })
      .select()
      .single()

    if (logError) return { success: false, error: logError.message }

    revalidatePath('/dashboard/security')
    revalidatePath('/dashboard/admin')

    return { success: true, data: entryLog }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to check in guest' }
  }
}

export async function checkOutGuest(input: unknown): Promise<ActionResult> {
  try {
    const validated = checkOutGuestSchema.parse(input)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['security', 'admin'].includes(profile?.role || '')) {
      return { success: false, error: 'Only security guards can check out guests' }
    }

    const { error } = await supabase
      .from('entry_logs')
      .update({
        exit_time: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', validated.entryLogId)
      .eq('status', 'inside')

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/security')
    revalidatePath('/dashboard/admin')

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to check out guest' }
  }
}

export async function getEntryLogs(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}): Promise<ActionResult<PaginatedResult<any>>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['security', 'admin'].includes(profile?.role || '')) {
      return { success: false, error: 'Unauthorized' }
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || PAGE_SIZE
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('entry_logs')
      .select(
        `
        *,
        guest_pass:guest_pass_id (
          guest_name,
          guest_id,
          apartment_number,
          purpose,
          guest_phone,
          visit_date,
          visit_time,
          expiry_time,
          resident:resident_id (
            full_name,
            apartment_number
          )
        ),
        security_guard:security_guard_id (
          id,
          full_name
        )
      `,
        { count: 'exact' }
      )
      .order('entry_time', { ascending: false })
      .range(from, to)

    if (params?.status) {
      query = query.eq('status', params.status)
    }

    if (params?.dateFrom) {
      query = query.gte('entry_time', params.dateFrom)
    }

    if (params?.dateTo) {
      query = query.lte('entry_time', params.dateTo + 'T23:59:59')
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
    return { success: false, error: 'Failed to fetch entry logs' }
  }
}

export async function getTodaysVisitors(): Promise<ActionResult<any[]>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

    const { data, error } = await supabase
      .from('entry_logs')
      .select(
        `
        *,
        guest_pass:guest_pass_id (
          guest_name,
          guest_id,
          apartment_number,
          purpose,
          guest_phone,
          visit_date,
          visit_time,
          expiry_time,
          resident:resident_id (
            full_name
          )
        ),
        security_guard:security_guard_id (
          full_name
        )
      `
      )
      .gte('entry_time', startOfDay)
      .lte('entry_time', endOfDay)
      .order('entry_time', { ascending: false })

    if (error) return { success: false, error: error.message }

    return { success: true, data: data || [] }
  } catch (error: unknown) {
    if (error instanceof Error) return { success: false, error: error.message }
    return { success: false, error: 'Failed to fetch today\'s visitors' }
  }
}
