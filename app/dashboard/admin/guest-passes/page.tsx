'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Download, Archive } from 'lucide-react'
import { getGuestPasses, archiveGuestPass } from '@/app/actions/guest-passes'
import { exportGuestPassesCSV } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatTime, getComputedPassStatus } from '@/lib/utils/guest-pass'
import { downloadCSV } from '@/lib/utils'
import type { GuestPass } from '@/types'
import { PAGE_SIZE } from '@/constants'

export default function AdminGuestPassesPage() {
  const [passes, setPasses] = useState<GuestPass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [archiveTarget, setArchiveTarget] = useState<GuestPass | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const debouncedSearch = useDebounce(search, 400)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchPasses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getGuestPasses({ page, pageSize, search: debouncedSearch, status: statusFilter })
      if (result.success) {
        setPasses(result.data.data)
        setTotal(result.data.total)
      } else {
        setError(result.error)
        toast.error(result.error)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load guest passes')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, statusFilter])

  useEffect(() => { fetchPasses() }, [fetchPasses])
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter])

  const handleArchive = async () => {
    if (!archiveTarget) return
    if (!archiveReason.trim()) {
      toast.error('Please provide a reason for archiving')
      return
    }
    setArchiving(true)
    const result = await archiveGuestPass(archiveTarget.id, archiveReason)
    if (result.success) {
      toast.success('Guest pass archived')
      setArchiveTarget(null)
      setArchiveReason('')
      fetchPasses()
    } else {
      toast.error(result.error)
    }
    setArchiving(false)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportGuestPassesCSV()
      if (result.success) {
        downloadCSV(result.data, `guest-passes-${new Date().toISOString().split('T')[0]}`)
        toast.success('Export downloaded')
      } else {
        toast.error(result.error)
      }
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'guest_name',
      label: 'Guest',
      render: (p: GuestPass) => (
        <div>
          <p className="font-medium text-slate-900">{p.guest_name}</p>
          {p.guest_phone && <p className="text-xs text-slate-400">{p.guest_phone}</p>}
        </div>
      ),
    },
    {
      key: 'apartment_number',
      label: 'Apartment',
      render: (p: GuestPass) => <span className="text-slate-600">{p.apartment_number}</span>,
    },
    {
      key: 'visit_date',
      label: 'Visit',
      render: (p: GuestPass) => (
        <div>
          <p className="text-slate-700">{formatDate(p.visit_date)}</p>
          <p className="text-xs text-slate-400">{formatTime(p.visit_time)}</p>
        </div>
      ),
    },
    {
      key: 'duration_hours',
      label: 'Duration',
      render: (p: GuestPass) => <span className="text-slate-600">{p.duration_hours}h</span>,
    },
    {
      key: 'purpose',
      label: 'Purpose',
      render: (p: GuestPass) => <span className="text-slate-600">{p.purpose}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: GuestPass) => (
        <StatusBadge type="pass" status={getComputedPassStatus(p)} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (p: GuestPass) => (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-slate-500 hover:text-amber-700 hover:bg-amber-50"
          onClick={() => { setArchiveTarget(p); setArchiveReason('') }}
          title="Archive pass"
        >
          <Archive className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Guest Passes" description="View and manage all guest passes across the system">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </PageHeader>

      <SearchAndFilter
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by guest name, apartment…"
        filters={[
          {
            key: 'status',
            label: 'All Status',
            value: statusFilter,
            options: [
              { value: 'valid',   label: 'Valid' },
              { value: 'expired', label: 'Expired' },
              { value: 'revoked', label: 'Revoked' },
              { value: 'used',    label: 'Used' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        onClear={() => { setSearch(''); setStatusFilter('') }}
      />

      <DataTable
        data={passes}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchPasses}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        rowKey={(p) => p.id}
        emptyMessage="No guest passes found"
      />

      {/* Archive Dialog */}
      <Dialog open={!!archiveTarget} onClose={() => { setArchiveTarget(null); setArchiveReason('') }}>
        <DialogContent
          title="Archive Guest Pass"
          onClose={() => { setArchiveTarget(null); setArchiveReason('') }}
        >
          {archiveTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Archive the pass for <strong>{archiveTarget.guest_name}</strong>? The pass will be
                hidden from active views but kept for audit purposes. Entry logs are preserved.
              </p>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Duplicate pass, guest cancelled visit…"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  disabled={archiving}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setArchiveTarget(null); setArchiveReason('') }} disabled={archiving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleArchive}
                  disabled={archiving || !archiveReason.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {archiving ? 'Archiving…' : 'Archive Pass'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
