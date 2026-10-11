'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Shield, Plus, UserX, UserCheck, Calendar } from 'lucide-react'
import { getAllProfiles, createSecurityGuard, deactivateUser, reactivateUser } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils/guest-pass'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { PAGE_SIZE } from '@/constants'

const GATES  = ['Main', 'Gate 1', 'Gate 2', 'Service Gate']
const SHIFTS = [
  { value: 'morning', label: 'Morning (6am–2pm)' },
  { value: 'day',     label: 'Day (2pm–10pm)' },
  { value: 'night',   label: 'Night (10pm–6am)' },
]

export default function GuardsPage() {
  const [guards, setGuards]       = useState<Profile[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [createForm, setCreateForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '' })
  const [acting, setActing]       = useState<string | null>(null)
  const [shiftTarget, setShiftTarget] = useState<Profile | null>(null)
  const [shiftForm, setShiftForm] = useState({ gate: 'Main', shift: 'day', shift_start: '14:00', shift_end: '22:00' })
  const [savingShift, setSavingShift] = useState(false)
  const [activity, setActivity]   = useState<Record<string, number>>({})
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null)
  const [deactivateReason, setDeactivateReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [guRes, supabase] = await Promise.all([
      getAllProfiles({ role: 'security', includeInactive: true }),
      Promise.resolve(createClient()),
    ])
    if (guRes.success) setGuards(guRes.data.data)

    // Load today's activity counts
    const today = new Date().toISOString().slice(0, 10)
    const { data: logs } = await supabase
      .from('entry_logs')
      .select('security_guard_id')
      .gte('entry_time', today + 'T00:00:00')
    const counts: Record<string, number> = {}
    logs?.forEach((l: any) => { counts[l.security_guard_id] = (counts[l.security_guard_id] || 0) + 1 })
    setActivity(counts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!createForm.fullName || !createForm.email || !createForm.password) {
      toast.error('Name, email, and password required'); return
    }
    setCreating(true)
    const res = await createSecurityGuard(createForm)
    setCreating(false)
    if (res.success) { toast.success('Guard created'); setShowCreate(false); setCreateForm({ fullName: '', email: '', phoneNumber: '', password: '' }); load() }
    else toast.error(res.error)
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget || !deactivateReason.trim()) { toast.error('Reason required'); return }
    setActing(deactivateTarget.id)
    const res = await deactivateUser(deactivateTarget.id, deactivateReason)
    setActing(null)
    if (res.success) { toast.success('Deactivated'); setDeactivateTarget(null); setDeactivateReason(''); load() }
    else toast.error(res.error)
  }

  const handleReactivate = async (id: string) => {
    setActing(id)
    const res = await reactivateUser(id)
    setActing(null)
    if (res.success) { toast.success('Reactivated'); load() }
    else toast.error(res.error)
  }

  const handleSaveShift = async () => {
    if (!shiftTarget) return
    setSavingShift(true)
    const supabase = createClient()
    // Deactivate old current shift
    await supabase.from('guard_shifts').update({ is_current: false }).eq('guard_id', shiftTarget.id).eq('is_current', true)
    // Insert new shift
    const { error } = await supabase.from('guard_shifts').insert({
      guard_id:    shiftTarget.id,
      building_id: '00000000-0000-0000-0000-000000000001',
      gate:        shiftForm.gate,
      shift:       shiftForm.shift,
      shift_start: shiftForm.shift_start,
      shift_end:   shiftForm.shift_end,
      is_current:  true,
    })
    setSavingShift(false)
    if (!error) { toast.success('Shift assigned'); setShiftTarget(null) }
    else toast.error(error.message)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Security Guards" description="Manage guard accounts, gates, and shifts">
        <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Add Guard
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {guards.map((g) => (
            <Card key={g.id} className={`p-4 ${!g.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-violet-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{g.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {g.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{g.email} · {g.phone_number ?? 'No phone'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Added: {formatDate(g.created_at)} ·
                    Today's entries: <strong>{activity[g.id] || 0}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => { setShiftTarget(g); setShiftForm({ gate: 'Main', shift: 'day', shift_start: '14:00', shift_end: '22:00' }) }}>
                    <Calendar className="h-3.5 w-3.5" />
                    Assign Shift
                  </Button>
                  {g.is_active ? (
                    <Button variant="ghost" size="icon-sm" className="text-red-500 hover:bg-red-50"
                      onClick={() => { setDeactivateTarget(g); setDeactivateReason('') }}
                      disabled={acting === g.id}>
                      <UserX className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon-sm" className="text-emerald-600 hover:bg-emerald-50"
                      onClick={() => handleReactivate(g.id)}
                      disabled={acting === g.id}>
                      <UserCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Guard */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogContent title="Add Security Guard" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            {[
              { key: 'fullName', label: 'Full Name *', type: 'text', placeholder: 'Mohammad Alam' },
              { key: 'email', label: 'Email *', type: 'email', placeholder: 'guard@example.com' },
              { key: 'phoneNumber', label: 'Phone', type: 'tel', placeholder: '01XXXXXXXXX' },
              { key: 'password', label: 'Temporary Password *', type: 'password', placeholder: 'Min 8 chars' },
            ].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{f.label}</label>
                <Input type={f.type} placeholder={f.placeholder}
                  value={(createForm as any)[f.key]}
                  onChange={(e) => setCreateForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create Guard'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Shift */}
      <Dialog open={!!shiftTarget} onClose={() => setShiftTarget(null)}>
        <DialogContent title={`Assign Shift: ${shiftTarget?.full_name}`} onClose={() => setShiftTarget(null)}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Gate</label>
              <Select value={shiftForm.gate} onChange={(e) => setShiftForm((p) => ({ ...p, gate: e.target.value }))}>
                {GATES.map((g) => <SelectOption key={g} value={g}>{g}</SelectOption>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Shift</label>
              <Select value={shiftForm.shift} onChange={(e) => setShiftForm((p) => ({ ...p, shift: e.target.value }))}>
                {SHIFTS.map((s) => <SelectOption key={s.value} value={s.value}>{s.label}</SelectOption>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Start Time</label>
                <Input type="time" value={shiftForm.shift_start} onChange={(e) => setShiftForm((p) => ({ ...p, shift_start: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">End Time</label>
                <Input type="time" value={shiftForm.shift_end} onChange={(e) => setShiftForm((p) => ({ ...p, shift_end: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveShift} disabled={savingShift}>{savingShift ? 'Saving…' : 'Assign Shift'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate */}
      <Dialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)}>
        <DialogContent title="Deactivate Guard" onClose={() => setDeactivateTarget(null)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Deactivate <strong>{deactivateTarget?.full_name}</strong>?</p>
            <Input placeholder="Reason *" value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button onClick={handleDeactivate} disabled={acting === deactivateTarget?.id}
              className="bg-red-600 hover:bg-red-700 text-white">
              {acting === deactivateTarget?.id ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
