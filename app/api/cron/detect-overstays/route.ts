import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/detect-overstays
 * Called every 5 minutes by Vercel Cron.
 * Runs detect_overstays(15) — marks 'inside' entries that are 15+ min past
 * expected_exit_at as status = 'overstay'.
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('detect_overstays', { p_grace_minutes: 15 })

    if (error) {
      console.error('[cron/detect-overstays] RPC error:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const newOverstays = data as number
    console.log(`[cron/detect-overstays] ran at ${new Date().toISOString()} — ${newOverstays} new overstay(s)`)
    return NextResponse.json({ success: true, new_overstays: newOverstays, ran_at: new Date().toISOString() })
  } catch (err) {
    console.error('[cron/detect-overstays] unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
