'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils/guest-pass'
import { downloadCSV } from '@/lib/utils'
import { usePagination } from '@/hooks/usePagination'
import { PAGE_SIZE } from '@/constants'

const AUDIT_ACTIONS = [
  'pass.created','pass.revoked','pass.archived','checkin.allowed','checkin.denied',
  'checkout.manual','checkout.admin_closed','role.changed','user.deactivated',
  'user.reactivated','extension.requested','extension.approved','extension.rejected',
  'penalty.waived','penalty.bill_added','policy.changed','export.done',
  'emergency.entry','event.created','event.approved','blacklist.added',
]

export default function AuditLogPage() {
  const [logs, setLogs]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [action, setAction]     = useState('')
  const [entity, setEntity]     = useState('')
  const [actorName, setActor]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [exporting, setExporting] = useState(false)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const from = (page - 1) * pageSize
      const to   = from + pageSize - 1

      let q = supabase
        .from('audit_log')
        .select(`
          id, action, entity_type, entity_id, metadata, ip_address, created_at,
          actor:actor_id(full_name, role)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (action)   q = q.eq('action', action)
      if (entity)   q = q.eq('entity_type', entity)
      if (dateFrom) q = q.gte('created_at', dateFrom)
      if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

      const { data, count, error: qErr } = await q
      if (qErr) {
        setError(qErr.message)
      } else {
        setLogs(data || [])
        setTotal(count || 0)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, action, entity, dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [action, entity, dateFrom, dateTo])

  const handleExport = async () => {
    setExporting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, metadata, ip_address, created_at, actor:actor_id(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(5000)

    const rows = (data || []).map((l: any) => ({
      'Time':        formatDateTime(l.created_at),
      'Action':      l.action,
      'Actor':       l.actor?.full_name ?? '—',
      'Role':        l.actor?.role ?? '—',
      'Entity Type': l.entity_type,
      'Entity ID':   l.entity_id ?? '',
      'IP':          l.ip_address ?? '',
      'Metadata':    JSON.stringify(l.metadata),
    }))
    downloadCSV(rows, `audit-log-${new Date().toISOString().slice(0,10)}`)
    toast.success('Audit log exported (read-only)')
    setExporting(false)
  }

  const columns = [
    {
      key: 'created_at',
      label: 'Time',
      render: (l: any) => <span className="text-slate-600 text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</span>,
    },
    {
      key: 'action',
      label: 'Action',
      render: (l: any) => (
        <span className="text-xs font-mono bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 whitespace-nowrap">
          {l.action}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (l: any) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{l.actor?.full_name ?? 'System'}</p>
          <p className="text-xs text-slate-400">{l.actor?.role ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'entity',
      label: 'Entity',
      render: (l: any) => (
        <div>
          <p className="text-xs text-slate-600">{l.entity_type}</p>
          <p className="text-xs text-slate-400 font-mono">{l.entity_id ? l.entity_id.slice(0, 8) + '…' : '—'}</p>
        </div>
      ),
    },
    {
      key: 'metadata',
      label: 'Details',
      render: (l: any) => (
        <span className="text-xs text-slate-500 max-w-xs truncate block">
          {Object.entries(l.metadata || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (l: any) => <span className="text-xs text-slate-400">{l.ip_address ?? '—'}</span>,
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Audit Log" description="Immutable record of all system actions — read-only">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-52">
          <SelectOption value="">All Actions</SelectOption>
          {AUDIT_ACTIONS.map((a) => <SelectOption key={a} value={a}>{a}</SelectOption>)}
        </Select>
        <Input placeholder="Entity type" value={entity} onChange={(e) => setEntity(e.target.value)} className="w-40" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm" />
        <span className="self-center text-slate-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm" />
        <Button variant="ghost" size="sm" onClick={() => { setAction(''); setEntity(''); setDateFrom(''); setDateTo('') }}>
          Clear
        </Button>
      </div>

      <DataTable
        data={logs} columns={columns} loading={loading}
        error={error} onRetry={load}
        total={total} page={page} pageSize={pageSize}
        onPageChange={goToPage} rowKey={(l: any) => l.id}
        emptyMessage="No audit log entries"
      />
    </div>
  )
}
