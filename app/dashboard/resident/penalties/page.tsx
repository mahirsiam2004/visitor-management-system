'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react'
import { getMyPenalties } from '@/app/actions/penalties'
import { Card } from '@/components/ui/card'
import { Select, SelectOption } from '@/components/ui/select'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils/guest-pass'
import { PENALTY_STATUS_LABELS } from '@/constants'
import type { Penalty } from '@/types'
import { PAGE_SIZE } from '@/constants'
import { usePagination } from '@/hooks/usePagination'

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-amber-50 text-amber-700 border-amber-200',
  waived:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  added_to_bill: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function MyPenaltiesPage() {
  const [penalties, setPenalties]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatus]   = useState('')
  const [totalPending, setTotalPending] = useState(0)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const load = useCallback(async () => {
    setLoading(true)
    const [res, pendingRes] = await Promise.all([
      getMyPenalties({ page, status: statusFilter || undefined }),
      getMyPenalties({ status: 'pending' }),
    ])
    if (res.success) { setPenalties(res.data.data); setTotal(res.data.total) }
    else toast.error(res.error)
    if (pendingRes.success) {
      setTotalPending(
        pendingRes.data.data.reduce((sum, p) => sum + Number(p.amount_bdt), 0)
      )
    }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter])

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (p: any) => <span className="text-slate-600 text-sm">{formatDateTime(p.created_at)}</span>,
    },
    {
      key: 'guest',
      label: 'Guest',
      render: (p: any) => (
        <div>
          <p className="font-medium text-slate-900">{p.pass?.guest_name ?? '—'}</p>
          <p className="text-xs text-slate-400">{p.pass?.purpose}</p>
        </div>
      ),
    },
    {
      key: 'minutes_over',
      label: 'Overstay',
      render: (p: Penalty) => <span className="text-slate-600 text-sm">{p.minutes_over} min</span>,
    },
    {
      key: 'amount_bdt',
      label: 'Amount',
      render: (p: Penalty) => (
        <span className={`font-semibold text-sm ${p.status === 'waived' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          ৳{Number(p.amount_bdt).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: Penalty) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
          {PENALTY_STATUS_LABELS[p.status]}
        </span>
      ),
    },
    {
      key: 'waive_reason',
      label: 'Note',
      render: (p: Penalty) => p.waive_reason
        ? <span className="text-xs text-emerald-700">Waived: {p.waive_reason}</span>
        : null,
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader title="My Penalties" description="Overstay penalties are added to your monthly service charge bill" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-600 font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">৳{totalPending.toFixed(0)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Total records</span>
          </div>
          <p className="text-2xl font-bold text-slate-700">{total}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <SelectOption value="">All Status</SelectOption>
          {Object.entries(PENALTY_STATUS_LABELS).map(([v, l]) => (
            <SelectOption key={v} value={v}>{l}</SelectOption>
          ))}
        </Select>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
        Penalties are calculated at the building's rate per hour of overstay. Amounts are recorded only — no online payment required. They are added to your monthly service charge by the building management. You may contact the admin to waive a penalty.
      </div>

      <DataTable
        data={penalties} columns={columns} loading={loading}
        total={total} page={page} pageSize={pageSize}
        onPageChange={goToPage} rowKey={(p: any) => p.id}
        emptyMessage="No penalties found"
      />
    </div>
  )
}
