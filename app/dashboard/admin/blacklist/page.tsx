'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ShieldOff, Plus, Trash2, Building2, Home } from 'lucide-react'
import { getBlacklist, addToBlacklist, removeFromBlacklist } from '@/app/actions/blacklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils/guest-pass'
import { PAGE_SIZE } from '@/constants'

import QueryErrorState from '@/components/ui/query-error-state'

const EMPTY_FORM = { name: '', phone: '', reason: '', scope: 'building' as 'building' | 'apartment', apartment: '' }

export default function BlacklistPage() {
  const [entries, setEntries]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [removeTarget, setRemoveTarget] = useState<any | null>(null)
  const [removing, setRemoving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getBlacklist(false)
      if (res.success) setEntries(res.data)
      else {
        setError(res.error)
        toast.error(res.error)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load blacklist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.name.trim() || !form.reason.trim()) { toast.error('Name and reason are required'); return }
    setSaving(true)
    const res = await addToBlacklist(form)
    setSaving(false)
    if (res.success) { toast.success('Added to blacklist'); setShowForm(false); setForm(EMPTY_FORM); load() }
    else toast.error(res.error)
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    const res = await removeFromBlacklist(removeTarget.id)
    setRemoving(false)
    if (res.success) { toast.success('Removed from blacklist'); setRemoveTarget(null); load() }
    else toast.error(res.error)
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (e: any) => (
        <div>
          <p className="font-medium text-slate-900">{e.name}</p>
          {e.phone && <p className="text-xs text-slate-400">{e.phone}</p>}
        </div>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      render: (e: any) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          e.scope === 'building' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {e.scope === 'building' ? <Building2 className="h-3 w-3" /> : <Home className="h-3 w-3" />}
          {e.scope === 'building' ? 'Building-wide' : `Apt ${e.apartment}`}
        </span>
      ),
    },
    { key: 'reason', label: 'Reason', render: (e: any) => <span className="text-slate-600 text-sm">{e.reason}</span> },
    {
      key: 'added_by',
      label: 'Added by',
      render: (e: any) => <span className="text-slate-500 text-sm">{e.added_by_profile?.full_name ?? '—'}</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (e: any) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.is_active ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
          {e.is_active ? 'Active' : 'Removed'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Added',
      render: (e: any) => <span className="text-slate-400 text-xs">{formatDate(e.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (e: any) => e.is_active ? (
        <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-red-600 hover:bg-red-50"
          onClick={() => setRemoveTarget(e)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Blacklist" description="Building-wide and apartment-level blacklisted persons">
        <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      </PageHeader>

      {error && <QueryErrorState message={error} onRetry={load} retrying={loading} />}

      <DataTable
        data={entries}
        columns={columns}
        loading={loading}
        total={entries.length}
        page={1}
        pageSize={entries.length || PAGE_SIZE}
        onPageChange={() => {}}
        rowKey={(e: any) => e.id}
        emptyMessage="Blacklist is empty"
      />

      {/* Add dialog */}
      <Dialog open={showForm} onClose={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
        <DialogContent title="Add to Blacklist" onClose={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Phone (optional)</label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Reason *</label>
              <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason for blacklisting…" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Scope</label>
              <Select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as any }))}>
                <SelectOption value="building">Building-wide</SelectOption>
                <SelectOption value="apartment">Specific Apartment</SelectOption>
              </Select>
            </div>
            {form.scope === 'apartment' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Apartment</label>
                <Input value={form.apartment} onChange={(e) => setForm((f) => ({ ...f, apartment: e.target.value.toUpperCase() }))} placeholder="A-101" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Saving…' : 'Add to Blacklist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)}>
        <DialogContent title="Remove from Blacklist" onClose={() => setRemoveTarget(null)}>
          <p className="text-sm text-slate-600">Remove <strong>{removeTarget?.name}</strong> from the blacklist?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button onClick={handleRemove} disabled={removing}>{removing ? 'Removing…' : 'Remove'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
