'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, Ban, Share2, Clock, PlusCircle, AlertTriangle } from 'lucide-react'
import { getGuestPasses } from '@/app/actions/guest-passes'
import { revokeGuestPass } from '@/app/actions/guest-passes'
import { requestExtension, getPassExtensions } from '@/app/actions/extensions'
import { buildQRUrl, buildPassUrl, formatDate, formatTime, formatDateTime, isPassExpired, getPassTimeRemaining } from '@/lib/utils/guest-pass'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectOption } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import type { GuestPass, PassExtension } from '@/types'
import QRCode from 'react-qr-code'
import { PAGE_SIZE, EXTENSION_HOUR_OPTIONS } from '@/constants'

export default function GuestHistoryPage() {
  const [passes, setPasses]           = useState<GuestPass[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedPass, setSelectedPass] = useState<GuestPass | null>(null)
  const [revoking, setRevoking]       = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<GuestPass | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  // Extension state
  const [extTarget, setExtTarget]   = useState<GuestPass | null>(null)
  const [extHours, setExtHours]     = useState<number>(1)
  const [extReason, setExtReason]   = useState('')
  const [extending, setExtending]   = useState(false)
  const [extensions, setExtensions] = useState<PassExtension[]>([])
  const [loadingExts, setLoadingExts] = useState(false)

  const debouncedSearch = useDebounce(search, 400)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchPasses = useCallback(async () => {
    setLoading(true)
    const result = await getGuestPasses({ page, pageSize, search: debouncedSearch, status: statusFilter })
    if (result.success) { setPasses(result.data.data); setTotal(result.data.total) }
    else toast.error(result.error)
    setLoading(false)
  }, [page, pageSize, debouncedSearch, statusFilter])

  useEffect(() => { fetchPasses() }, [fetchPasses])
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter])

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(revokeTarget.id)
    const result = await revokeGuestPass({ passId: revokeTarget.id, reason: revokeReason || undefined })
    setRevoking(null)
    if (result.success) { toast.success('Pass revoked'); setRevokeTarget(null); setRevokeReason(''); fetchPasses() }
    else toast.error(result.error)
  }

  const handleShare = async (pass: GuestPass) => {
    const url = buildPassUrl(pass.qr_token)
    if (navigator.share) await navigator.share({ url })
    else { await navigator.clipboard.writeText(url); toast.success('Link copied!') }
  }

  const openExtension = async (pass: GuestPass) => {
    setExtTarget(pass); setExtHours(1); setExtReason('')
    setLoadingExts(true)
    const res = await getPassExtensions(pass.id)
    if (res.success) setExtensions(res.data)
    setLoadingExts(false)
  }

  const handleExtend = async () => {
    if (!extTarget) return
    setExtending(true)
    const res = await requestExtension({ passId: extTarget.id, extendHours: extHours as any, reason: extReason || undefined })
    setExtending(false)
    if (res.success) {
      const wasAutoApproved = res.data.status === 'approved'
      toast.success(wasAutoApproved
        ? `Extended +${extHours}h! New expiry applied.`
        : `Extension requested. Admin approval required.`)
      setExtTarget(null)
      fetchPasses()
    } else {
      toast.error(res.error)
    }
  }

  // Determine if a pass should show "Ending Soon" banner
  const isEndingSoon = (pass: GuestPass) => {
    if (pass.status !== 'valid') return false
    const msLeft = new Date(pass.expiry_time).getTime() - Date.now()
    return msLeft > 0 && msLeft < 15 * 60 * 1000
  }

  const canExtend = (pass: GuestPass) =>
    ['valid', 'expired'].includes(pass.status) && !pass.archived_at

  const columns = [
    {
      key: 'guest_name',
      label: 'Guest',
      render: (pass: GuestPass) => (
        <div>
          <p className="font-medium text-slate-900">{pass.guest_name}</p>
          {pass.guest_phone && <p className="text-xs text-slate-400">{pass.guest_phone}</p>}
          {isEndingSoon(pass) && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-1">
              <Clock className="h-3 w-3" />
              {getPassTimeRemaining(pass.expiry_time)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'visit_date',
      label: 'Visit Date',
      render: (pass: GuestPass) => (
        <div>
          <p className="text-slate-700">{formatDate(pass.visit_date)}</p>
          <p className="text-xs text-slate-400">{formatTime(pass.visit_time)}</p>
        </div>
      ),
    },
    { key: 'purpose', label: 'Purpose', render: (pass: GuestPass) => <span className="text-slate-600">{pass.purpose}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (pass: GuestPass) => (
        <StatusBadge
          type="pass"
          status={isPassExpired(pass.expiry_time) && pass.status === 'valid' ? 'expired' : pass.status}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (pass: GuestPass) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setSelectedPass(pass)} title="View QR">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canExtend(pass) && (
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => openExtension(pass)}
              className="text-blue-600 hover:bg-blue-50"
              title="Extend pass"
            >
              <PlusCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          {pass.status === 'valid' && !isPassExpired(pass.expiry_time) && (
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => { setRevokeTarget(pass); setRevokeReason('') }}
              disabled={revoking === pass.id}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              title="Revoke"
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Guest History" description="View and manage all your guest passes" />

      <SearchAndFilter
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by guest name, purpose…"
        filters={[{
          key: 'status', label: 'All Status', value: statusFilter,
          options: [
            { value: 'valid', label: 'Valid' },
            { value: 'expired', label: 'Expired' },
            { value: 'revoked', label: 'Revoked' },
          ],
          onChange: setStatusFilter,
        }]}
        onClear={() => { setSearch(''); setStatusFilter('') }}
      />

      <DataTable
        data={passes} columns={columns} loading={loading}
        total={total} page={page} pageSize={pageSize}
        onPageChange={goToPage} rowKey={(pass) => pass.id}
        emptyMessage="No guest passes found"
      />

      {/* QR View Dialog */}
      <Dialog open={!!selectedPass} onClose={() => setSelectedPass(null)}>
        <DialogContent title={selectedPass ? `Pass for ${selectedPass.guest_name}` : ''} onClose={() => setSelectedPass(null)}>
          {selectedPass && (
            <div className="space-y-4">
              <div className="flex justify-center py-2">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <QRCode value={buildQRUrl(selectedPass.qr_token)} size={180} level="H" bgColor="#ffffff" fgColor="#0f172a" />
                </div>
              </div>
              {selectedPass.gate_code && (
                <div className="text-center rounded-xl bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-600 uppercase tracking-wider mb-1">Gate Code</p>
                  <p className="text-3xl font-black tracking-[0.3em] text-blue-900 font-mono">{selectedPass.gate_code}</p>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-500">Date</dt><dd className="font-medium">{formatDate(selectedPass.visit_date)}</dd></div>
                <div><dt className="text-slate-500">Time</dt><dd className="font-medium">{formatTime(selectedPass.visit_time)}</dd></div>
                <div><dt className="text-slate-500">Duration</dt><dd className="font-medium">{selectedPass.duration_hours}h</dd></div>
                <div><dt className="text-slate-500">Persons</dt><dd className="font-medium">{selectedPass.allowed_persons}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Expires</dt><dd className="font-medium text-red-600">{formatDateTime(selectedPass.expiry_time)}</dd></div>
              </dl>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleShare(selectedPass)}>
                  <Share2 className="h-3.5 w-3.5" />Share
                </Button>
                {canExtend(selectedPass) && (
                  <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => { setSelectedPass(null); openExtension(selectedPass) }}>
                    <PlusCircle className="h-3.5 w-3.5" />Extend
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)}>
        <DialogContent title="Revoke Pass" onClose={() => setRevokeTarget(null)}>
          {revokeTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Revoke pass for <strong>{revokeTarget.guest_name}</strong>?</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
                <Input placeholder="Why are you revoking this pass?" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
                <Button onClick={handleRevoke} disabled={!!revoking} className="bg-red-600 hover:bg-red-700 text-white">
                  {revoking ? 'Revoking…' : 'Revoke Pass'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extension Dialog */}
      <Dialog open={!!extTarget} onClose={() => setExtTarget(null)}>
        <DialogContent title={extTarget ? `Extend: ${extTarget.guest_name}` : ''} onClose={() => setExtTarget(null)}>
          {extTarget && (
            <div className="space-y-4">
              {/* Status */}
              {extTarget.status === 'overstay' || isPassExpired(extTarget.expiry_time) ? (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    This pass has expired / is overstaying. Extending will reset the status to active.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                  Current expiry: <strong>{formatDateTime(extTarget.expiry_time)}</strong>
                  <br /><span className="text-xs text-blue-500">{getPassTimeRemaining(extTarget.expiry_time)}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Extend by</label>
                <div className="grid grid-cols-4 gap-2">
                  {EXTENSION_HOUR_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setExtHours(opt.value)}
                      className={`rounded-xl border-2 py-3 text-sm font-semibold transition-all ${
                        extHours === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
                <Input placeholder="Why extending?" value={extReason} onChange={(e) => setExtReason(e.target.value)} />
              </div>

              {/* Existing extensions */}
              {!loadingExts && extensions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Previous extensions</p>
                  {extensions.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-xs text-slate-600 py-1 border-b border-slate-100">
                      <span>+{e.extend_hours}h — {e.approval_level === 'resident' ? 'auto-approved' : e.status}</span>
                      <span className="text-slate-400">{formatDateTime(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setExtTarget(null)}>Cancel</Button>
                <Button onClick={handleExtend} disabled={extending}>
                  {extending ? 'Requesting…' : 'Request Extension'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
