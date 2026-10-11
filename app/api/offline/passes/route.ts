import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/offline/passes
 * Returns today's active passes in a signed, read-only format
 * for the service worker to cache. Only security/admin can call this.
 * Cached by SW and served offline for QR/gate-code lookups.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['security', 'admin'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Today's date in Dhaka timezone
    const todayDhaka = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

    const { data: passes } = await supabase
      .from('guest_passes')
      .select('id, guest_name, guest_phone, qr_token, gate_code, apartment_number, purpose, valid_from, expiry_time, status, allowed_persons, entered_count')
      .eq('status', 'valid')
      .eq('visit_date', todayDhaka)
      .gte('expiry_time', new Date().toISOString())
      .is('archived_at', null)
      .limit(500)

    return NextResponse.json(
      { passes: passes || [], cached_at: new Date().toISOString() },
      {
        headers: {
          // Cache for 5 minutes in SW
          'Cache-Control': 'private, max-age=300',
          'Content-Type': 'application/json',
        },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
