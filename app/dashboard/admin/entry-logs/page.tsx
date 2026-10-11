'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Download, X } from 'lucide-react'
import { getEntryLogs, adminCloseEntry } from '@/app/actions/guest-passes'
import { exportEntryLogsCSV } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { usePagination } from '@/hooks/usePagination'
import { formatDateTime } from '@/lib/utils/guest-pass'
import { downloadCSV } from '@/lib/utils'
import { PAGE_SIZE } from '@/constants'

export default function AdminEntryLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [closeTarget, setCloseTarget] = useState<any>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [closing, setClosing] = useState(false)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getEntryLogs({
        page, pageSize,
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

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { setPage(1) }, [statusFilter, dateFrom, dateTo])

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

  const handleAdminClose = async () => {
    if (!closeTarget) return
    setClosing(true)
    const result = await adminCloseEntry(closeTarget.id, closeNotes)
    if (result.success) {
      toast.success('Entry closed by admin')
      setCloseTarget(null)
      setCloseNotes('')
      fetchLogs()
    } else {
      toast.error(result.error)
    }
    setClosing(false)
  }

  const renderDuration = (log: any) => {
    if (log.checkout_type === 'admin_closed') {
      return <span className="text-amber-700 text-xs font-medium">Closed by admin</span>
    }
    if (!log.exit_time) return <span className="text-slate-400 text-xs">—</span>
    const diff = new Date(log.exit_time).getTime() - new Date(log.entry_time).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return <span className="text-slate-600 text-sm">{h > 0 ? `${h}h ` : ''}{m}m</span>
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
      render: (log: any) => <span className="text-slate-600 text-sm">{log.guest_pass?.resident?.full_name || '—'}</span>,
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
        <span className="text-slate-600 text-sm">
          {log.exit_time ? formatDateTime(log.exit_time) : '—'}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: renderDuration,
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
    {
      key: 'actions',
      label: '',
      render: (log: any) => {
        if (!['inside', 'overstay'].includes(log.status)) return null
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-500 hover:text-amber-700 hover:bg-amber-50"
            onClick={() => { setCloseTarget(log); setCloseNotes('') }}
            title="Force close entry"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )
      },
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Entry Logs" description="Complete visitor access history — evidence is never deleted">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
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
                { value: 'inside',    label: 'Inside' },
                { value: 'overstay',  label: 'Overstay' },
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

      {/* Admin Close Dialog */}
      <Dialog open={!!closeTarget} onClose={() => { setCloseTarget(null); setCloseNotes('') }}>
        <DialogContent title="Force Close Entry" onClose={() => { setCloseTarget(null); setCloseNotes('') }}>
          {closeTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm font-medium text-amber-900">{closeTarget.guest_pass?.guest_name}</p>
                <p className="text-xs text-amber-700">Apt {closeTarget.guest_pass?.apartment_number} · Entered {formatDateTime(closeTarget.entry_time)}</p>
              </div>
              <p className="text-sm text-slate-600">
                This will mark the entry as <strong>Closed by admin</strong>. The duration will be
                shown as "closed by admin" rather than a calculated time. Entry log is preserved.
              </p>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Notes (optional)</label>
                <Input
                  placeholder="e.g. Guest left without scanning out, system error…"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  disabled={closing}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCloseTarget(null); setCloseNotes('') }} disabled={closing}>Cancel</Button>
                <Button
                  onClick={handleAdminClose}
                  disabled={closing}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {closing ? 'Closing…' : 'Close Entry'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
