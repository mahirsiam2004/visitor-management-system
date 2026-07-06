import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { ROLE_ROUTES } from '@/constants'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Get role and redirect appropriately
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role) {
        return NextResponse.redirect(`${origin}${ROLE_ROUTES[profile.role] || '/dashboard/resident'}`)
      }
      return NextResponse.redirect(`${origin}/dashboard/resident`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
