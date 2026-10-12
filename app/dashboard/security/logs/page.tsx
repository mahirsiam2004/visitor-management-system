'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ClipboardList, LogOut } from 'lucide-react'
import { getEntryLogs, checkOutGuest } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { calculateVisitDuration } from '@/lib/utils/guest-pass'
import { formatDateTime, computeVisitStatus } from '@/lib/visit-status'
import { PAGE_SIZE } from '@/constants'

export default function EntryLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 400)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getEntryLogs({
        page,
        pageSize,
        status: statusFilter || undefined,
      })
      if (result.success) {
        setLogs(result.data.data)
        setTotal(result.data.total)
      } else {
        setError(result.error)
        toast.error(result.error)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch entry logs')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const handleCheckOut = async (logId: string, guestName: string) => {
    setCheckingOut(logId)
    try {
      const result = await checkOutGuest({ entryLogId: logId })
      if (result.success) {
        toast.success(`${guestName} checked out`)
        fetchLogs()
      } else {
        toast.error(result.error)
      }
    } finally {
      setCheckingOut(null)
    }
  }

  const columns = [
    {
      key: 'guest',
      label: 'Guest',
      render: (log: any) => (
        <div>
          <p className="font-medium text-slate-900">{log.guest_pass?.guest_name || 'Unknown'}</p>
          <p className="text-xs text-slate-400">Apt {log.guest_pass?.apartment_number}</p>
        </div>
      ),
    },
    {
      key: 'purpose',
      label: 'Purpose',
      render: (log: any) => <span className="text-slate-600 text-sm">{log.guest_pass?.purpose || '-'}</span>,
    },
    {
      key: 'entry_time',
      label: 'Entry Time',
      render: (log: any) => (
        <span className="text-slate-600 text-sm">{formatDateTime(log.entry_time)}</span>
      ),
    },
    {
      key: 'exit_time',
      label: 'Exit Time',
      render: (log: any) => (
        <span className="text-slate-600 text-sm">
          {log.exit_time ? formatDateTime(log.exit_time) : '—'}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (log: any) => (
        <span className="text-slate-600 text-sm">
          {calculateVisitDuration(log.entry_time, log.exit_time || undefined)}
        </span>
      ),
    },
    {
      key: 'guard',
      label: 'Guard',
      render: (log: any) => (
        <span className="text-slate-600 text-sm">{log.security_guard?.full_name || '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (log: any) => <StatusBadge type="entry" status={log.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (log: any) => {
        const vs = computeVisitStatus(log)
        if (!vs.showCheckOut) return null
        return (
          <div className="flex flex-col gap-1">
            <Button
              variant={vs.isOverstay ? 'default' : 'outline'}
              size="sm"
              className={`gap-1.5 text-xs min-h-[44px] ${
                vs.isOverstay ? 'bg-red-600 hover:bg-red-700 text-white' : ''
              }`}
              onClick={() => handleCheckOut(log.id, log.guest_pass?.guest_name || 'Guest')}
              disabled={checkingOut === log.id}
            >
              <LogOut className="h-3 w-3" />
              {checkingOut === log.id ? 'Processing…' : 'Check Out'}
            </Button>
            {vs.isOverstay && (
              <span className="text-xs font-bold text-red-700 bg-red-100 rounded px-2 py-0.5 text-center">
                {vs.overstayLabel}
              </span>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Entry Logs" description="Complete history of all visitor entries and exits" />

      <SearchAndFilter
        search={search}
        onSearchChange={setSearch}
        placeholder="Search entries..."
        filters={[
          {
            key: 'status',
            label: 'All Status',
            value: statusFilter,
            options: [
              { value: 'inside', label: 'Inside' },
              { value: 'completed', label: 'Completed' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        onClear={() => { setSearch(''); setStatusFilter('') }}
      />

      <DataTable
        data={logs}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchLogs}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        rowKey={(log: any) => log.id}
        emptyMessage="No entry logs found"
      />
    </div>
  )
}
