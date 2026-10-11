import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('expire_visit_requests')
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, expired: data, ran_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
