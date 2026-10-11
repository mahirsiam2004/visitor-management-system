import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/expire-passes
 * Called every 5 minutes by Vercel Cron.
 * Runs expire_guest_passes() in Supabase — marks stale 'valid' passes as 'expired'
 * and 'expired' passes that have a completed entry as 'used'.
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
    const { error } = await supabase.rpc('expire_guest_passes')

    if (error) {
      console.error('[cron/expire-passes] RPC error:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('[cron/expire-passes] ran at', new Date().toISOString())
    return NextResponse.json({ success: true, ran_at: new Date().toISOString() })
  } catch (err) {
    console.error('[cron/expire-passes] unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
