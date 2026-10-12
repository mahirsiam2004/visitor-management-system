import { getTodaysVisitors, getOverstays } from '@/app/actions/guest-passes'
import { countInsideNow, countCompletedToday } from '@/lib/visit-status'
import SecurityDashboardClient from './SecurityDashboardClient'

export const dynamic = 'force-dynamic'

export default async function SecurityDashboardPage() {
  const [todayResult, overstayResult] = await Promise.all([
    getTodaysVisitors(),
    getOverstays(),
  ])

  const todaysVisitors = todayResult.success ? todayResult.data : []
  const overstays = overstayResult.success ? overstayResult.data : []

  const insideNow      = countInsideNow(todaysVisitors)
  const completedToday = countCompletedToday(todaysVisitors)
  const overstayCount  = overstays.length

  return (
    <SecurityDashboardClient
      insideNow={insideNow}
      completedToday={completedToday}
      totalToday={todaysVisitors.length + overstayCount}
      overstayCount={overstayCount}
      recentLogs={todaysVisitors.slice(0, 5)}
      overstays={overstays}
    />
  )
}
