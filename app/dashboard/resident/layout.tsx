import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If no profile yet, show the dashboard anyway with a default profile
  // so user isn't stuck in a redirect loop
  if (!profile) {
    const fallback = {
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.email ?? 'Resident',
      phone_number: user.user_metadata?.phone_number ?? null,
      apartment_number: user.user_metadata?.apartment_number ?? null,
      role: 'resident' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return <DashboardLayout profile={fallback}>{children}</DashboardLayout>
  }

  if (profile.role !== 'resident') redirect(`/dashboard/${profile.role}`)

  return <DashboardLayout profile={profile}>{children}</DashboardLayout>
}
