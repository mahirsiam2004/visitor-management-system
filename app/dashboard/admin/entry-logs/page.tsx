'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { getEntryLogs } from '@/app/actions/guest-passes'
import { exportEntryLogsCSV } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { usePagination } from '@/hooks/usePagination'
import { formatDateTime, calculateVisitDuration } from '@/lib/utils/guest-pass'
import { downloadCSV } from '@/lib/utils'
import { PAGE_SIZE } from '@/constants'

export default function AdminEntryLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getEntryLogs({
        page,
        pageSize,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      if (result.success) {
        setLogs(result.data.data)
        setTotal(result.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, dateFrom, dateTo])

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportEntryLogsCSV()
      if (result.success) {
        downloadCSV(result.data, `entry-logs-${new Date().toISOString().split('T')[0]}`)
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
      key: 'guest',
      label: 'Guest',
      render: (log: any) => (
        <div>
          <p className="font-medium text-slate-900">{log.guest_pass?.guest_name || '—'}</p>
          <p className="text-xs text-slate-400">Apt {log.guest_pass?.apartment_number}</p>
        </div>
      ),
    },
    {
      key: 'resident',
      label: 'Resident',
      render: (log: any) => (
        <span className="text-slate-600 text-sm">{log.guest_pass?.resident?.full_name || '—'}</span>
      ),
    },
    {
      key: 'purpose',
      label: 'Purpose',
      render: (log: any) => <span className="text-slate-600 text-sm">{log.guest_pass?.purpose || '—'}</span>,
    },
    {
      key: 'entry_time',
      label: 'Entry',
      render: (log: any) => <span className="text-slate-600 text-sm">{formatDateTime(log.entry_time)}</span>,
    },
    {
      key: 'exit_time',
      label: 'Exit',
      render: (log: any) => (
        <span className="text-slate-600 text-sm">{log.exit_time ? formatDateTime(log.exit_time) : '—'}</span>
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
      render: (log: any) => <span className="text-slate-600 text-sm">{log.security_guard?.full_name || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (log: any) => <StatusBadge type="entry" status={log.status} />,
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Entry Logs" description="Complete visitor access history">
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

      <div className="flex flex-wrap gap-3">
        <SearchAndFilter
          search=""
          onSearchChange={() => {}}
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
          onClear={() => { setStatusFilter(''); setDateFrom(''); setDateTo('') }}
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        loading={loading}
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
