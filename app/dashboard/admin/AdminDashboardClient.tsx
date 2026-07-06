'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2,
  Shield,
  QrCode,
  ClipboardList,
  Users,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import StatsCard from '@/components/shared/StatsCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils/guest-pass'
import type { AdminStats } from '@/types'

interface AdminDashboardClientProps {
  stats: AdminStats
  todaysVisitors: any[]
}

export default function AdminDashboardClient({ stats, todaysVisitors }: AdminDashboardClientProps) {
  const statsCards = [
    { title: 'Total Residents', value: stats.totalResidents, icon: Building2, color: 'blue' as const },
    { title: 'Security Guards', value: stats.totalSecurityGuards, icon: Shield, color: 'violet' as const },
    { title: 'Total Passes', value: stats.totalGuestPasses, icon: QrCode, color: 'slate' as const },
    { title: 'Inside Now', value: stats.activeGuests, icon: Clock, color: 'green' as const },
    { title: 'Completed Visits', value: stats.completedVisits, icon: CheckCircle, color: 'slate' as const },
    { title: 'Expired Passes', value: stats.expiredPasses, icon: QrCode, color: 'amber' as const },
  ]

  const quickLinks = [
    { label: 'Residents', href: '/dashboard/admin/residents', icon: Building2, desc: 'Manage resident accounts' },
    { label: 'Security Guards', href: '/dashboard/admin/security', icon: Shield, desc: 'Manage security staff' },
    { label: 'Guest Passes', href: '/dashboard/admin/guest-passes', icon: QrCode, desc: 'View all guest passes' },
    { label: 'Entry Logs', href: '/dashboard/admin/entry-logs', icon: ClipboardList, desc: 'View access history' },
    { label: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart3, desc: 'View reports & insights' },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsCards.map((stat, i) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            index={i}
          />
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Management</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {quickLinks.map((link, i) => (
            <motion.div
              key={link.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.2 }}
            >
              <Link href={link.href}>
                <Card className="p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                  <link.icon className="h-6 w-6 text-slate-400 group-hover:text-blue-600 mb-2 transition-colors" />
                  <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">{link.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{link.desc}</p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Today's Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Today's Activity</h2>
          <Link href="/dashboard/admin/entry-logs">
            <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {todaysVisitors.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No visitors today</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-slate-100">
              {todaysVisitors.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {log.guest_pass?.guest_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Apt {log.guest_pass?.apartment_number} · {formatDateTime(log.entry_time)} · {log.guest_pass?.purpose}
                    </p>
                  </div>
                  <StatusBadge type="entry" status={log.status} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
