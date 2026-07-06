import { getAdminStats } from '@/app/actions/admin'
import { getTodaysVisitors } from '@/app/actions/guest-passes'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const [statsResult, visitorsResult] = await Promise.all([
    getAdminStats(),
    getTodaysVisitors(),
  ])

  const stats = statsResult.success ? statsResult.data : {
    totalResidents: 0,
    totalSecurityGuards: 0,
    totalGuestPasses: 0,
    activeGuests: 0,
    completedVisits: 0,
    expiredPasses: 0,
  }

  const todaysVisitors = visitorsResult.success ? visitorsResult.data : []

  return <AdminDashboardClient stats={stats} todaysVisitors={todaysVisitors} />
}
