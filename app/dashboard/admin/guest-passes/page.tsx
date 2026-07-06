'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { QrCode, Trash2, Eye, Download } from 'lucide-react'
import { getGuestPasses, deleteGuestPass } from '@/app/actions/guest-passes'
import { exportGuestPassesCSV } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatTime, isPassExpired } from '@/lib/utils/guest-pass'
import { downloadCSV } from '@/lib/utils'
import type { GuestPass } from '@/types'
import { PAGE_SIZE } from '@/constants'

export default function AdminGuestPassesPage() {
  const [passes, setPasses] = useState<GuestPass[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<GuestPass | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const debouncedSearch = useDebounce(search, 400)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchPasses = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getGuestPasses({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
      })
      if (result.success) {
        setPasses(result.data.data)
        setTotal(result.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, statusFilter])

  useEffect(() => {
    fetchPasses()
  }, [fetchPasses])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteGuestPass(deleteTarget.id)
    if (result.success) {
      toast.success('Guest pass deleted')
      setDeleteTarget(null)
      fetchPasses()
    } else {
      toast.error(result.error)
    }
    setDeleting(false)
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
        <StatusBadge
          type="pass"
          status={isPassExpired(p.expiry_time) && p.status === 'valid' ? 'expired' : p.status}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (p: GuestPass) => (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={() => setDeleteTarget(p)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Guest Passes" description="View and manage all guest passes across the system">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </PageHeader>

      <SearchAndFilter
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by guest name, apartment..."
        filters={[
          {
            key: 'status',
            label: 'All Status',
            value: statusFilter,
            options: [
              { value: 'valid', label: 'Valid' },
              { value: 'expired', label: 'Expired' },
              { value: 'revoked', label: 'Revoked' },
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
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        rowKey={(p) => p.id}
        emptyMessage="No guest passes found"
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogContent title="Delete Guest Pass" onClose={() => setDeleteTarget(null)}>
          {deleteTarget && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to delete the guest pass for{' '}
                <strong>{deleteTarget.guest_name}</strong>? This cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
