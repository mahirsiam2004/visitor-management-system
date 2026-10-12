import { createClient } from '@/lib/supabase/server'
import { getResidentGuestPassStats, getGuestPasses } from '@/app/actions/guest-passes'
import ResidentDashboardClient from './ResidentDashboardClient'

export const dynamic = 'force-dynamic'

export default async function ResidentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [statsResult, passesResult] = await Promise.all([
    getResidentGuestPassStats(),
    getGuestPasses({ page: 1, pageSize: 6 }),
  ])

  const stats = statsResult.success ? statsResult.data : {
    totalGuests: 0,
    activeGuests: 0,
    expiredPasses: 0,
    revokedPasses: 0,
    usedPasses: 0,
    completedVisits: 0,
    overstayCount: 0,
    insideNow: 0,
    upcomingCount: 0,
    penaltiesDue: 0,
  }

  const passes = passesResult.success ? passesResult.data.data : []

  return <ResidentDashboardClient initialStats={stats} recentPasses={passes} />
}
