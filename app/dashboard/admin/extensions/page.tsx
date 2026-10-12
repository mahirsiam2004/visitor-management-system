'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { getPendingExtensions, reviewExtension } from '@/app/actions/extensions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils/guest-pass'

import QueryErrorState from '@/components/ui/query-error-state'

export default function AdminExtensionsPage() {
  const [items, setItems]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [acting, setActing]     = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPendingExtensions()
      if (res.success) setItems(res.data)
      else {
        setError(res.error)
        toast.error(res.error)
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to load extensions'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id: string) => {
    setActing(id)
    const res = await reviewExtension(id, 'approved')
    setActing(null)
    if (res.success) { toast.success('Extension approved'); load() }
    else toast.error(res.error)
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setActing(rejectTarget.id)
    const res = await reviewExtension(rejectTarget.id, 'rejected', rejectReason)
    setActing(null)
    if (res.success) { toast.success('Extension rejected'); setRejectTarget(null); setRejectReason(''); load() }
    else toast.error(res.error)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Extension Requests" description="Passes requiring admin approval for extensions (≥2nd extension)" />

      {error && <QueryErrorState message={error} onRetry={load} retrying={loading} />}
      {loading && !error && <div className="text-center text-slate-400 py-8">Loading…</div>}
      {!loading && !error && items.length === 0 && (
        <Card className="p-10 text-center text-slate-400">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No pending extension requests</p>
        </Card>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-4">
          {items.map((ext) => (
          <Card key={ext.id} className="p-5 border-blue-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{ext.pass?.guest_name ?? '—'}</p>
                <p className="text-slate-500 text-sm">
                  Apt {ext.pass?.apartment_number} · Requested by {ext.requester?.full_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />+{ext.extend_hours}h extension</span>
                  <span>Current expiry: {formatDateTime(ext.pass?.expiry_time)}</span>
                  <span>New expiry: {formatDateTime(ext.new_expiry)}</span>
                  {ext.was_overstay && <span className="text-amber-600 font-medium">⚠️ Was overstaying</span>}
                </div>
                {ext.reason && <p className="text-xs text-slate-400 mt-1">Reason: {ext.reason}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => handleApprove(ext.id)} disabled={acting === ext.id}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                  <CheckCircle className="h-4 w-4" />Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejectTarget(ext); setRejectReason('') }}
                  disabled={acting === ext.id} className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                  <XCircle className="h-4 w-4" />Reject
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      )}

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)}>
        <DialogContent title="Reject Extension" onClose={() => setRejectTarget(null)}>
          {rejectTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Rejecting extension for <strong>{rejectTarget.pass?.guest_name}</strong></p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
                <Input placeholder="Reason for rejection…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
                <Button onClick={handleReject} disabled={acting === rejectTarget.id} className="bg-red-600 hover:bg-red-700 text-white">
                  {acting === rejectTarget.id ? 'Rejecting…' : 'Reject'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
