'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Download, CheckCircle, X } from 'lucide-react'
import { getAllPenalties, waivePenalty, markMonthBilled, exportMonthlyPenaltyReport, getMonthlySummary } from '@/app/actions/penalties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils/guest-pass'
import { downloadCSV } from '@/lib/utils'
import { PENALTY_STATUS_LABELS, PAGE_SIZE } from '@/constants'
import { usePagination } from '@/hooks/usePagination'

const STATUS_COLORS: Record<string, string> = {
  pending:       'bg-amber-50 text-amber-700 border-amber-200',
  waived:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  added_to_bill: 'bg-slate-100 text-slate-600 border-slate-200',
}

import QueryErrorState from '@/components/ui/query-error-state'

export default function AdminPenaltiesPage() {
  const [penalties, setPenalties] = useState<any[]>([])
  const [summary, setSummary]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [statusFilter, setStatus] = useState('')
  const [monthFilter, setMonth]   = useState(new Date().toISOString().slice(0, 7))
  const [waiveTarget, setWaiveTarget] = useState<any | null>(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [waiving, setWaiving]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [penRes, sumRes] = await Promise.all([
        getAllPenalties({ page, status: statusFilter || undefined, monthYear: monthFilter || undefined }),
        getMonthlySummary(monthFilter || undefined),
      ])
      if (penRes.success) {
        setPenalties(penRes.data.data)
        setTotal(penRes.data.total)
      } else {
        setError(penRes.error)
        toast.error(penRes.error)
      }
      if (sumRes.success) setSummary(sumRes.data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load penalties')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, monthFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter, monthFilter])

  const handleWaive = async () => {
    if (!waiveTarget || !waiveReason.trim()) { toast.error('Reason required'); return }
    setWaiving(true)
    const res = await waivePenalty(waiveTarget.id, waiveReason)
    setWaiving(false)
    if (res.success) { toast.success('Penalty waived'); setWaiveTarget(null); setWaiveReason(''); load() }
    else toast.error(res.error)
  }

  const handleMarkBilled = async () => {
    const res = await markMonthBilled(monthFilter)
    if (res.success) { toast.success(`${res.data.count} penalties marked as billed`); load() }
    else toast.error(res.error)
  }

  const handleExport = async () => {
    setExporting(true)
    const res = await exportMonthlyPenaltyReport(monthFilter)
    if (res.success) {
      downloadCSV(res.data, `penalties-${monthFilter}`)
      toast.success('Report downloaded')
    } else toast.error(res.error)
    setExporting(false)
  }

  const totalPending = penalties.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount_bdt), 0)

  const columns = [
    {
      key: 'resident',
      label: 'Resident',
      render: (p: any) => (
        <div>
          <p className="font-medium text-slate-900">{p.resident?.full_name ?? '—'}</p>
          <p className="text-xs text-slate-400">Apt {p.resident?.apartment_number}</p>
        </div>
      ),
    },
    {
      key: 'guest',
      label: 'Guest',
      render: (p: any) => <span className="text-slate-600 text-sm">{p.pass?.guest_name ?? '—'}</span>,
    },
    {
      key: 'minutes_over',
      label: 'Overstay',
      render: (p: any) => <span className="text-slate-600 text-sm">{p.minutes_over} min</span>,
    },
    {
      key: 'amount_bdt',
      label: 'Amount',
      render: (p: any) => (
        <span className={`font-semibold text-sm ${p.status === 'waived' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          ৳{Number(p.amount_bdt).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: any) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
          {PENALTY_STATUS_LABELS[p.status]}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (p: any) => <span className="text-slate-400 text-xs">{formatDateTime(p.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (p: any) => p.status === 'pending' ? (
        <Button variant="ghost" size="icon-sm"
          className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
          onClick={() => { setWaiveTarget(p); setWaiveReason('') }}
          title="Waive penalty">
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Penalty Management" description="Monthly overstay penalty records">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleMarkBilled} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Mark Month Billed
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </PageHeader>

      {/* Month selector + summary */}
      <div className="flex flex-wrap items-center gap-4">
        <Input type="month" value={monthFilter} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        <Select value={statusFilter} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <SelectOption value="">All Status</SelectOption>
          {Object.entries(PENALTY_STATUS_LABELS).map(([v, l]) => (
            <SelectOption key={v} value={v}>{l}</SelectOption>
          ))}
        </Select>
        {totalPending > 0 && (
          <span className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            Pending total: ৳{totalPending.toFixed(2)}
          </span>
        )}
      </div>

      {/* Apartment summary */}
      {summary.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">By Apartment ({monthFilter})</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.slice(0, 6).map((s: any) => (
              <div key={s.apartment} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">Apt {s.apartment}</span>
                <span className="text-amber-700 font-semibold">৳{s.total_bdt.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && <QueryErrorState message={error} onRetry={load} retrying={loading} />}

      <DataTable
        data={penalties} columns={columns} loading={loading}
        total={total} page={page} pageSize={pageSize}
        onPageChange={goToPage} rowKey={(p: any) => p.id}
        emptyMessage="No penalties for this period"
      />

      {/* Waive dialog */}
      <Dialog open={!!waiveTarget} onClose={() => setWaiveTarget(null)}>
        <DialogContent title="Waive Penalty" onClose={() => setWaiveTarget(null)}>
          {waiveTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">{waiveTarget.resident?.full_name}</p>
                <p className="text-slate-500">Apt {waiveTarget.resident?.apartment_number} · ৳{Number(waiveTarget.amount_bdt).toFixed(2)} · {waiveTarget.minutes_over} min over</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason (required) <span className="text-red-500">*</span></label>
                <Input placeholder="Reason for waiving this penalty…" value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWaiveTarget(null)}>Cancel</Button>
                <Button onClick={handleWaive} disabled={waiving || !waiveReason.trim()}>
                  {waiving ? 'Waiving…' : 'Waive Penalty'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
