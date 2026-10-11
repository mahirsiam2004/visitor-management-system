import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify } from '@/app/actions/notifications'

/**
 * GET /api/cron/detect-overstays
 * Every 5 min: runs detect_overstays_full() (reads grace from policy_settings,
 * creates penalties), then notifies affected residents and guard dashboards.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // 1. Run the full detection + penalty creation
    const { data, error } = await supabase.rpc('detect_overstays_full')
    if (error) {
      console.error('[cron/detect-overstays] RPC error:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    const result = data as { new_overstays: number; penalties_created: number }

    // 2. Notify residents & guards for newly-flagged overstays
    if (result.new_overstays > 0) {
      // Fetch the newly-marked overstay logs (stamped in last 10 min)
      const { data: newLogs } = await supabase
        .from('entry_logs')
        .select(`
          id, entry_time, expected_exit_at, overstay_started_at,
          guest_pass:guest_pass_id(
            id, guest_name, apartment_number, resident_id,
            resident:resident_id(id, full_name, phone_number)
          ),
          security_guard:security_guard_id(id)
        `)
        .eq('status', 'overstay')
        .gte('overstay_started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

      for (const log of newLogs || []) {
        const pass     = (log as any).guest_pass
        const resident = pass?.resident
        if (!resident) continue

        const minsOver = log.expected_exit_at
          ? Math.floor((Date.now() - new Date(log.expected_exit_at).getTime()) / 60000)
          : 0

        // Notify resident
        await notify(supabase, {
          recipient_id: resident.id,
          type:         'overstay',
          title:        `⚠️ ${pass.guest_name} is overstaying`,
          body:         `Your guest has been inside ${minsOver} min past their allowed time at Apt ${pass.apartment_number}. Please respond.`,
          metadata: {
            entry_log_id: log.id,
            pass_id:      pass.id,
            minutes_over: minsOver,
          },
          phoneNumber: resident.phone_number ?? undefined,
        })
      }

      // 3. Check if any overstay is past admin notification threshold
      const { data: policy } = await supabase
        .from('policy_settings')
        .select('overstay_notify_admin_after_minutes')
        .single()
      const adminThreshold: number = policy?.overstay_notify_admin_after_minutes ?? 60

      const { data: longOverstays } = await supabase
        .from('entry_logs')
        .select(`
          id, overstay_started_at,
          guest_pass:guest_pass_id(guest_name, apartment_number)
        `)
        .eq('status', 'overstay')
        .lte(
          'overstay_started_at',
          new Date(Date.now() - adminThreshold * 60 * 1000).toISOString()
        )

      if ((longOverstays?.length ?? 0) > 0) {
        const { data: admins } = await supabase
          .from('profiles').select('id').eq('role', 'admin').eq('is_active', true)
        for (const admin of admins || []) {
          const names = (longOverstays || [])
            .map((l: any) => `${l.guest_pass?.guest_name} (${l.guest_pass?.apartment_number})`)
            .join(', ')
          await notify(supabase, {
            recipient_id: admin.id,
            type:         'overstay',
            title:        `🔴 ${longOverstays!.length} long overstay(s)`,
            body:         `Over ${adminThreshold} min: ${names}`,
            metadata:     { log_ids: (longOverstays || []).map((l: any) => l.id) },
          })
        }
      }
    }

    console.log(`[cron/detect-overstays] ${result.new_overstays} overstays, ${result.penalties_created} penalties at ${new Date().toISOString()}`)
    return NextResponse.json({ success: true, ...result, ran_at: new Date().toISOString() })
  } catch (err: any) {
    console.error('[cron/detect-overstays] error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
