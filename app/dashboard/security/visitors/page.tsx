'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Users, LogOut, Clock } from 'lucide-react'
import { getTodaysVisitors, checkOutGuest } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime, calculateVisitDuration } from '@/lib/utils/guest-pass'

export default function TodaysVisitorsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const fetchVisitors = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getTodaysVisitors()
      if (result.success) setLogs(result.data)
      else toast.error(result.error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVisitors()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchVisitors, 30000)
    return () => clearInterval(interval)
  }, [fetchVisitors])

  const handleCheckOut = async (entryLogId: string, guestName: string) => {
    setCheckingOut(entryLogId)
    try {
      const result = await checkOutGuest({ entryLogId })
      if (result.success) {
        toast.success(`${guestName} checked out successfully`)
        fetchVisitors()
      } else {
        toast.error(result.error)
      }
    } finally {
      setCheckingOut(null)
    }
  }

  const insideCount = logs.filter((l) => l.status === 'inside').length
  const completedCount = logs.filter((l) => l.status === 'completed').length

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Today's Visitors"
        description={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total Today</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-2xl font-bold text-blue-600">{insideCount}</p>
          <p className="text-xs text-blue-500 mt-1">Inside Now</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-600">{completedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Completed</p>
        </Card>
      </div>

      {/* Visitors List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No visitors today"
          description="No guests have been checked in today. Use the QR scanner to check in visitors."
        />
      ) : (
        <div className="space-y-3">
          {/* Inside Now first */}
          {logs.filter((l) => l.status === 'inside').map((log) => (
            <Card key={log.id} className="p-4 border-blue-200 bg-blue-50/30">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900">{log.guest_pass?.guest_name}</p>
                    <StatusBadge type="entry" status={log.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Apt {log.guest_pass?.apartment_number}</span>
                    <span>{log.guest_pass?.purpose}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      In {formatDateTime(log.entry_time)}
                    </span>
                    <span>{calculateVisitDuration(log.entry_time)} elapsed</span>
                  </div>
                  {log.guest_pass?.resident?.full_name && (
                    <p className="text-xs text-slate-400 mt-1">
                      Visiting: {log.guest_pass.resident.full_name}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 text-slate-700"
                  onClick={() => handleCheckOut(log.id, log.guest_pass?.guest_name)}
                  disabled={checkingOut === log.id}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Check Out
                </Button>
              </div>
            </Card>
          ))}

          {/* Completed */}
          {logs.filter((l) => l.status === 'completed').map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Users className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-700">{log.guest_pass?.guest_name}</p>
                    <StatusBadge type="entry" status={log.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Apt {log.guest_pass?.apartment_number}</span>
                    <span>{log.guest_pass?.purpose}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(log.entry_time)} – {log.exit_time ? formatDateTime(log.exit_time) : 'N/A'}
                    </span>
                    {log.exit_time && <span>{calculateVisitDuration(log.entry_time, log.exit_time)}</span>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
