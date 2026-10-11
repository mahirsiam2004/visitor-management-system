import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify } from '@/app/actions/notifications'

/**
 * GET /api/cron/ending-soon
 * Every 5 min: finds passes expiring within the warn window (default 10 min)
 * and notifies the resident. Avoids duplicate notifications.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Load warn window from policy
    const { data: policy } = await supabase
      .from('policy_settings')
      .select('ending_soon_warn_minutes')
      .single()
    const warnMinutes: number = policy?.ending_soon_warn_minutes ?? 10

    const now      = new Date()
    const warnTime = new Date(now.getTime() + warnMinutes * 60 * 1000)

    // Find active entry_logs whose pass expires within the warn window
    // and where we haven't already sent an ending_soon notification recently
    const { data: logs } = await supabase
      .from('entry_logs')
      .select(`
        id, expected_exit_at,
        guest_pass:guest_pass_id(
          id, guest_name, expiry_time, resident_id,
          resident:resident_id(id, full_name, phone_number)
        )
      `)
      .in('status', ['inside'])
      .lte('expected_exit_at', warnTime.toISOString())
      .gte('expected_exit_at', now.toISOString())

    let notified = 0
    for (const log of logs || []) {
      const pass     = (log as any).guest_pass
      const resident = pass?.resident
      if (!resident) continue

      // Check: did we already send ending_soon for this pass recently?
      const { count: existing } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', resident.id)
        .eq('type', 'ending_soon')
        .contains('metadata', { pass_id: pass.id })
        .gte('created_at', new Date(now.getTime() - (warnMinutes + 5) * 60 * 1000).toISOString())

      if ((existing ?? 0) > 0) continue  // already notified

      const minsLeft = Math.round(
        (new Date(log.expected_exit_at!).getTime() - now.getTime()) / 60000
      )

      await notify(supabase, {
        recipient_id: resident.id,
        type:         'ending_soon',
        title:        `⏰ ${pass.guest_name}'s pass expires in ${minsLeft} min`,
        body:         `Tap to extend if they need more time.`,
        metadata:     { pass_id: pass.id, entry_log_id: log.id, mins_left: minsLeft },
      })
      notified++
    }

    console.log(`[cron/ending-soon] notified ${notified} residents at ${new Date().toISOString()}`)
    return NextResponse.json({ success: true, notified, ran_at: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
