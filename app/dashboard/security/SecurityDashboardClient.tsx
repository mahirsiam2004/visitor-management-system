'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scan, Users, CheckCircle, Clock, AlertTriangle, Phone, ArrowRight, LogOut, UserX } from 'lucide-react'
import StatsCard from '@/components/shared/StatsCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime, getOverstayMinutes } from '@/lib/utils/guest-pass'
import { checkOutGuest } from '@/app/actions/guest-passes'
import { toast } from 'sonner'

interface OverstayEntry {
  id: string
  entry_time: string
  expected_exit_at: string | null
  overstay_started_at: string | null
  guest_pass: {
    guest_name: string
    apartment_number: string
    purpose: string
    guest_phone: string | null
    resident: {
      full_name: string
      phone_number: string | null
    } | null
  } | null
}

interface SecurityDashboardClientProps {
  insideNow: number
  completedToday: number
  totalToday: number
  overstayCount: number
  recentLogs: any[]
  overstays: OverstayEntry[]
}

export default function SecurityDashboardClient({
  insideNow, completedToday, totalToday, overstayCount, recentLogs, overstays,
}: SecurityDashboardClientProps) {
  const [askingToLeave, setAskingToLeave] = useState<string | null>(null)

  const handleAskToLeave = async (entryLogId: string, guestName: string) => {
    setAskingToLeave(entryLogId)
    const res = await checkOutGuest({ entryLogId })
    setAskingToLeave(null)
    if (res.success) toast.success(`${guestName} checked out`)
    else toast.error(res.error)
  }
  const stats = [
    { title: 'Visitors Today', value: totalToday, icon: Users, color: 'blue' as const },
    { title: 'Inside Now', value: insideNow, icon: Clock, color: 'green' as const },
    { title: 'Completed Today', value: completedToday, icon: CheckCircle, color: 'slate' as const },
    { title: 'Overstaying', value: overstayCount, icon: AlertTriangle, color: 'amber' as const },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              timeZone: 'Asia/Dhaka',
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <Link href="/dashboard/security/scanner">
          <Button className="gap-2 h-12 px-6 text-base">
            <Scan className="h-5 w-5" />
            Open Scanner
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      {/* ── Overstay Alert Panel ── */}
      {overstays.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-700">
              Overstay Alert — {overstays.length} {overstays.length === 1 ? 'Guest' : 'Guests'}
            </h2>
          </div>
          <div className="space-y-3">
            {overstays.map((entry) => {
              const minsOver = entry.expected_exit_at
                ? getOverstayMinutes(entry.expected_exit_at)
                : 0
              const residentPhone = entry.guest_pass?.resident?.phone_number

              return (
                <Card
                  key={entry.id}
                  className="border-red-300 bg-red-50/60 p-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-red-900 text-base">
                          {entry.guest_pass?.guest_name ?? '—'}
                        </p>
                        <StatusBadge type="entry" status="overstay" />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-red-700 font-medium">
                        <span>Apt {entry.guest_pass?.apartment_number}</span>
                        <span>{entry.guest_pass?.purpose}</span>
                        {entry.expected_exit_at && (
                          <span>Expected out: {formatDateTime(entry.expected_exit_at)}</span>
                        )}
                        <span className="text-red-800 font-bold">
                          {minsOver} min over
                        </span>
                      </div>
                      {entry.guest_pass?.resident && (
                        <p className="text-xs text-red-600 mt-1">
                          Resident: {entry.guest_pass.resident.full_name}
                        </p>
                      )}
                    </div>

                    {/* Call resident button */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {residentPhone ? (
                        <a href={`tel:${residentPhone}`} aria-label={`Call resident`}>
                          <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white h-10 px-4">
                            <Phone className="h-4 w-4" />
                            Call Resident
                          </Button>
                        </a>
                      ) : (
                        <Button size="sm" variant="outline" className="shrink-0 gap-1.5 border-red-300 text-red-700 h-10 px-4" disabled>
                          <Phone className="h-4 w-4" />
                          No phone
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 h-10 px-4"
                        onClick={() => handleAskToLeave(entry.id, entry.guest_pass?.guest_name ?? 'Guest')}
                        disabled={askingToLeave === entry.id}
                      >
                        <UserX className="h-4 w-4" />
                        {askingToLeave === entry.id ? 'Processing…' : 'Ask to Leave'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.div>
      )}

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
