'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CalendarDays, CheckCircle, XCircle, Users, Clock } from 'lucide-react'
import { getEventsForApproval, reviewEvent } from '@/app/actions/events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate, formatTime } from '@/lib/utils/guest-pass'

export default function AdminEventsPage() {
  const [events, setEvents]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getEventsForApproval()
    if (res.success) setEvents(res.data)
    else toast.error(res.error)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (eventId: string) => {
    setActing(eventId)
    const res = await reviewEvent(eventId, 'approved')
    setActing(null)
    if (res.success) { toast.success('Event approved'); load() }
    else toast.error(res.error)
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setActing(rejectTarget.id)
    const res = await reviewEvent(rejectTarget.id, 'rejected', rejectReason)
    setActing(null)
    if (res.success) { toast.success('Event rejected'); setRejectTarget(null); setRejectReason(''); load() }
    else toast.error(res.error)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Event Approvals" description="Events requiring admin approval (>50 guests)" />

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No events pending approval</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((ev) => (
            <Card key={ev.id} className="p-5 border-amber-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-lg">{ev.name}</p>
                  <p className="text-slate-500 text-sm">
                    {ev.resident?.full_name} · Apt {ev.resident?.apartment_number}
                    {ev.resident?.phone_number && ` · ${ev.resident.phone_number}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(ev.event_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(ev.start_time)}–{formatTime(ev.end_time)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{ev.expected_count} expected / {ev.max_capacity} max</span>
                  </div>
                  {ev.notes && <p className="text-xs text-slate-400 mt-1">{ev.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleApprove(ev.id)}
                    disabled={acting === ev.id}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => { setRejectTarget(ev); setRejectReason('') }}
                    disabled={acting === ev.id}
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)}>
        <DialogContent title="Reject Event" onClose={() => setRejectTarget(null)}>
          {rejectTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Rejecting: <strong>{rejectTarget.name}</strong></p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
                <Input placeholder="Reason for rejection…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
                <Button onClick={handleReject} disabled={acting === rejectTarget.id}
                  className="bg-red-600 hover:bg-red-700 text-white">
                  {acting === rejectTarget.id ? 'Rejecting…' : 'Reject Event'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
