'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Users, LogOut, Clock, AlertTriangle, Phone } from 'lucide-react'
import { getTodaysVisitors, getOverstays, checkOutGuest } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime, calculateVisitDuration, getOverstayMinutes } from '@/lib/utils/guest-pass'

import QueryErrorState from '@/components/ui/query-error-state'

export default function TodaysVisitorsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [overstays, setOverstays] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const fetchVisitors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [todayRes, overstayRes] = await Promise.all([
        getTodaysVisitors(),
        getOverstays(),
      ])
      if (todayRes.success) setLogs(todayRes.data)
      else {
        setError(todayRes.error)
        toast.error(todayRes.error)
      }
      if (overstayRes.success) setOverstays(overstayRes.data)
      else if (!todayRes.error) setError(overstayRes.error)
    } catch (e: any) {
      setError(e?.message || 'Failed to load visitors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVisitors()
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

  const insideCount    = logs.filter((l) => l.status === 'inside').length
  const completedCount = logs.filter((l) => l.status === 'completed').length

  // Merge: overstays first, then inside, then completed
  const activeEntries = [
    ...overstays,
    ...logs.filter((l) => l.status === 'inside'),
  ]
  const completedEntries = logs.filter((l) => l.status === 'completed')

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Today's Visitors"
        description={new Date().toLocaleDateString('en-US', {
          timeZone: 'Asia/Dhaka',
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{logs.length + overstays.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total Today</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-2xl font-bold text-blue-600">{insideCount}</p>
          <p className="text-xs text-blue-500 mt-1">Inside Now</p>
        </Card>
        <Card className="p-4 text-center bg-red-50 border-red-200">
          <p className="text-2xl font-bold text-red-600">{overstays.length}</p>
          <p className="text-xs text-red-500 mt-1">Overstaying</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-600">{completedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Completed</p>
        </Card>
      </div>

      {error ? (
        <QueryErrorState message={error} onRetry={fetchVisitors} retrying={loading} />
      ) : loading ? (
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
      ) : activeEntries.length === 0 && completedEntries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No visitors today"
          description="No guests have been checked in today."
        />
      ) : (
        <div className="space-y-3">
          {/* Active (overstay + inside) */}
          {activeEntries.map((log) => {
            const isOverstay = log.status === 'overstay'
            const minsOver   = isOverstay && log.expected_exit_at
              ? getOverstayMinutes(log.expected_exit_at)
              : 0
            const residentPhone = log.guest_pass?.resident?.phone_number

            return (
              <Card
                key={log.id}
                className={isOverstay
                  ? 'p-4 border-red-300 bg-red-50/50'
                  : 'p-4 border-blue-200 bg-blue-50/30'}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    isOverstay ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {isOverstay
                      ? <AlertTriangle className="h-5 w-5 text-red-600" />
                      : <Users className="h-5 w-5 text-blue-600" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className={`font-semibold text-base ${isOverstay ? 'text-red-900' : 'text-slate-900'}`}>
                        {log.guest_pass?.guest_name}
                      </p>
                      <StatusBadge type="entry" status={log.status} />
                      {isOverstay && (
                        <span className="text-xs font-bold text-red-700 bg-red-100 rounded px-2 py-0.5">
                          {minsOver} min over
                        </span>
                      )}
                    </div>
                    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${isOverstay ? 'text-red-700' : 'text-slate-500'}`}>
                      <span>Apt {log.guest_pass?.apartment_number}</span>
                      <span>{log.guest_pass?.purpose}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        In: {formatDateTime(log.entry_time)}
                      </span>
                      <span>{calculateVisitDuration(log.entry_time)} elapsed</span>
                      {log.expected_exit_at && (
                        <span>Expected out: {formatDateTime(log.expected_exit_at)}</span>
                      )}
                    </div>
                    {log.guest_pass?.resident?.full_name && (
                      <p className={`text-xs mt-1 ${isOverstay ? 'text-red-600' : 'text-slate-400'}`}>
                        Visiting: {log.guest_pass.resident.full_name}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant={isOverstay ? 'default' : 'outline'}
                      className={`gap-1.5 h-10 ${isOverstay ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-slate-700'}`}
                      onClick={() => handleCheckOut(log.id, log.guest_pass?.guest_name)}
                      disabled={checkingOut === log.id}
                    >
                      <LogOut className="h-4 w-4" />
                      {checkingOut === log.id ? 'Processing…' : 'Check Out'}
                    </Button>
                    {isOverstay && residentPhone && (
                      <a href={`tel:${residentPhone}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-10 border-red-300 text-red-700 w-full"
                        >
                          <Phone className="h-4 w-4" />
                          Call Resident
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}

          {/* Completed */}
          {completedEntries.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Users className="h-5 w-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-slate-600">{log.guest_pass?.guest_name}</p>
                    <StatusBadge type="entry" status={log.status} />
                    {log.checkout_type === 'admin_closed' && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                        Closed by admin
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Apt {log.guest_pass?.apartment_number}</span>
                    <span>{log.guest_pass?.purpose}</span>
                    <span>
                      {formatDateTime(log.entry_time)}
                      {log.exit_time ? ` → ${formatDateTime(log.exit_time)}` : ''}
                    </span>
                    {log.exit_time && log.checkout_type !== 'admin_closed' && (
                      <span>{calculateVisitDuration(log.entry_time, log.exit_time)}</span>
                    )}
                    {log.checkout_type === 'admin_closed' && (
                      <span className="text-amber-700 font-medium">Duration: closed by admin</span>
                    )}
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
