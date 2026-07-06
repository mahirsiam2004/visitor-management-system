import { createClient } from '@/lib/supabase/server'
import { getTodaysVisitors } from '@/app/actions/guest-passes'
import SecurityDashboardClient from './SecurityDashboardClient'

export default async function SecurityDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const todayResult = await getTodaysVisitors()
  const todaysVisitors = todayResult.success ? todayResult.data : []

  const insideNow = todaysVisitors.filter((v: any) => v.status === 'inside').length
  const completedToday = todaysVisitors.filter((v: any) => v.status === 'completed').length

  return (
    <SecurityDashboardClient
      insideNow={insideNow}
      completedToday={completedToday}
      totalToday={todaysVisitors.length}
      recentLogs={todaysVisitors.slice(0, 5)}
    />
  )
}
