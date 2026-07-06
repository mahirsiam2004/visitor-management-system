'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users, CheckCircle, Clock, AlertCircle, Plus, ArrowRight, QrCode } from 'lucide-react'
import StatsCard from '@/components/shared/StatsCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate, formatTime, isPassExpired } from '@/lib/utils/guest-pass'
import type { GuestPass } from '@/types'

interface ResidentDashboardClientProps {
  initialStats: {
    totalGuests: number
    activeGuests: number
    expiredPasses: number
    completedVisits: number
  }
  recentPasses: GuestPass[]
}

export default function ResidentDashboardClient({
  initialStats,
  recentPasses,
}: ResidentDashboardClientProps) {
  const stats = [
    { title: 'Total Guests', value: initialStats.totalGuests, icon: Users, color: 'blue' as const },
    { title: 'Active Passes', value: initialStats.activeGuests, icon: CheckCircle, color: 'green' as const },
    { title: 'Expired Passes', value: initialStats.expiredPasses, icon: AlertCircle, color: 'amber' as const },
    { title: 'Completed Visits', value: initialStats.completedVisits, icon: Clock, color: 'slate' as const },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Overview of your guest pass activity</p>
        </div>
        <Link href="/dashboard/resident/create-pass">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Pass
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Recent Guest Passes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Guest Passes</h2>
          <Link href="/dashboard/resident/history">
            <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {recentPasses.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <QrCode className="h-6 w-6 text-slate-400" />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-700">No guest passes yet</p>
            <p className="mt-1 text-xs text-slate-500">Create your first guest pass to get started</p>
            <Link href="/dashboard/resident/create-pass">
              <Button size="sm" className="mt-4">
                <Plus className="h-4 w-4" />
                Create Guest Pass
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentPasses.map((pass, i) => (
              <motion.div
                key={pass.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{pass.guest_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Apt {pass.apartment_number}</p>
                    </div>
                    <StatusBadge
                      type="pass"
                      status={isPassExpired(pass.expiry_time) && pass.status === 'valid' ? 'expired' : pass.status}
                    />
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>Visit Date</span>
                      <span className="font-medium text-slate-700">{formatDate(pass.visit_date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Time</span>
                      <span className="font-medium text-slate-700">{formatTime(pass.visit_time)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Purpose</span>
                      <span className="font-medium text-slate-700 truncate ml-2 max-w-[100px]">{pass.purpose}</span>
                    </div>
                  </div>
                  <Link href="/dashboard/resident/history" className="mt-3 block">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      View Details
                    </Button>
                  </Link>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
