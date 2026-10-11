import { getTodaysVisitors, getOverstays } from '@/app/actions/guest-passes'
import SecurityDashboardClient from './SecurityDashboardClient'

export const dynamic = 'force-dynamic'

export default async function SecurityDashboardPage() {
  const [todayResult, overstayResult] = await Promise.all([
    getTodaysVisitors(),
    getOverstays(),
  ])

  const todaysVisitors = todayResult.success ? todayResult.data : []
  const overstays = overstayResult.success ? overstayResult.data : []

  const insideNow      = todaysVisitors.filter((v: any) => v.status === 'inside').length
  const completedToday = todaysVisitors.filter((v: any) => v.status === 'completed').length
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
