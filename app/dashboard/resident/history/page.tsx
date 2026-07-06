'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { QrCode, Eye, Ban, Download, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getGuestPasses, updateGuestPassStatus } from '@/app/actions/guest-passes'
import { buildQRUrl, formatDate, formatTime, formatDateTime, isPassExpired } from '@/lib/utils/guest-pass'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import EmptyState from '@/components/shared/EmptyState'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import type { GuestPass } from '@/types'
import QRCode from 'react-qr-code'
import { PAGE_SIZE } from '@/constants'

export default function GuestHistoryPage() {
  const [passes, setPasses] = useState<GuestPass[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedPass, setSelectedPass] = useState<GuestPass | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
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
      } else {
        toast.error(result.error)
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

  const handleRevoke = async (passId: string) => {
    setRevoking(passId)
    try {
      const result = await updateGuestPassStatus(passId, 'revoked')
      if (result.success) {
        toast.success('Guest pass revoked')
        fetchPasses()
      } else {
        toast.error(result.error)
      }
    } finally {
      setRevoking(null)
    }
  }

  const handleShare = async (pass: GuestPass) => {
    const url = buildQRUrl(pass.qr_token)
    if (navigator.share) {
      await navigator.share({ url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied!')
    }
  }

  const columns = [
    {
      key: 'guest_name',
      label: 'Guest',
      render: (pass: GuestPass) => (
        <div>
          <p className="font-medium text-slate-900">{pass.guest_name}</p>
          {pass.guest_phone && <p className="text-xs text-slate-400">{pass.guest_phone}</p>}
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
      key: 'duration_hours',
      label: 'Duration',
      render: (pass: GuestPass) => <span className="text-slate-600">{pass.duration_hours}h</span>,
    },
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
          {pass.status === 'valid' && !isPassExpired(pass.expiry_time) && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRevoke(pass.id)}
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
        placeholder="Search by guest name, purpose..."
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
        rowKey={(pass) => pass.id}
        emptyMessage="No guest passes found"
      />

      {/* QR View Dialog */}
      <Dialog open={!!selectedPass} onClose={() => setSelectedPass(null)}>
        <DialogContent
          title={selectedPass ? `Pass for ${selectedPass.guest_name}` : ''}
          onClose={() => setSelectedPass(null)}
        >
          {selectedPass && (
            <div className="space-y-4">
              <div className="flex justify-center py-2">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <QRCode
                    value={buildQRUrl(selectedPass.qr_token)}
                    size={180}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-500">Date</dt><dd className="font-medium">{formatDate(selectedPass.visit_date)}</dd></div>
                <div><dt className="text-slate-500">Time</dt><dd className="font-medium">{formatTime(selectedPass.visit_time)}</dd></div>
                <div><dt className="text-slate-500">Duration</dt><dd className="font-medium">{selectedPass.duration_hours}h</dd></div>
                <div><dt className="text-slate-500">Purpose</dt><dd className="font-medium">{selectedPass.purpose}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Expires</dt><dd className="font-medium text-red-600">{formatDateTime(selectedPass.expiry_time)}</dd></div>
              </dl>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleShare(selectedPass)}>
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
