'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Scan, Users, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import StatsCard from '@/components/shared/StatsCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils/guest-pass'

interface SecurityDashboardClientProps {
  insideNow: number
  completedToday: number
  totalToday: number
  recentLogs: any[]
}

export default function SecurityDashboardClient({
  insideNow,
  completedToday,
  totalToday,
  recentLogs,
}: SecurityDashboardClientProps) {
  const stats = [
    { title: 'Visitors Today', value: totalToday, icon: Users, color: 'blue' as const },
    { title: 'Inside Now', value: insideNow, icon: Clock, color: 'green' as const },
    { title: 'Completed Today', value: completedToday, icon: CheckCircle, color: 'slate' as const },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/security/scanner">
          <Button className="gap-2">
            <Scan className="h-4 w-4" />
            Open Scanner
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
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

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'QR Scanner', desc: 'Scan visitor QR codes', href: '/dashboard/security/scanner', icon: Scan, color: 'bg-blue-600' },
          { label: "Today's Visitors", desc: 'View all visitors today', href: '/dashboard/security/visitors', icon: Users, color: 'bg-slate-700' },
          { label: 'Entry Logs', desc: 'Full history of entries', href: '/dashboard/security/logs', icon: CheckCircle, color: 'bg-slate-700' },
        ].map((action, i) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 + 0.2 }}
          >
            <Link href={action.href}>
              <Card className="p-5 hover:shadow-md transition-all cursor-pointer group border-slate-200">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color} mb-3`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{action.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <Link href="/dashboard/security/visitors">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <Card className="overflow-hidden">
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {log.guest_pass?.guest_name || 'Unknown Guest'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Apt {log.guest_pass?.apartment_number} · {formatDateTime(log.entry_time)}
                    </p>
                  </div>
                  <StatusBadge type="entry" status={log.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
