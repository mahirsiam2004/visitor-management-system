import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from './LandingPage'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'resident') redirect('/dashboard/resident')
    if (profile?.role === 'security') redirect('/dashboard/security')
    if (profile?.role === 'admin') redirect('/dashboard/admin')
  }

  return <LandingPage />
}
