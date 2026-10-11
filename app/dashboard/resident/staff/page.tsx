'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  RefreshCcw, Plus, Pause, Play, Clock, ChevronDown,
  ChevronUp, AlertTriangle, Camera, User,
} from 'lucide-react'
import {
  createRecurringVisitor, getMyRecurringVisitors,
  updateRecurringVisitorStatus, getStaffTimeline,
} from '@/app/actions/recurring'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils/guest-pass'
import { RECURRING_VISITOR_ROLES, WEEKDAYS } from '@/constants'
import { createClient } from '@/lib/supabase/client'

const EMPTY_FORM = {
  fullName: '', role: 'Maid / বুয়া', phone: '',
  validUntil: '', apartment: '',
  schedule: { days: [] as string[], start: '08:00', end: '18:00' },
  photoUrl: '',
}

export default function StaffPage() {
  const [visitors, setVisitors]   = useState<any[]>([])
  const [timeline, setTimeline]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [vRes, tRes] = await Promise.all([
      getMyRecurringVisitors(),
      getStaffTimeline(7),
    ])
    if (vRes.success) setVisitors(vRes.data)
    if (tRes.success) setTimeline(tRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      schedule: {
        ...f.schedule,
        days: f.schedule.days.includes(day)
          ? f.schedule.days.filter((d) => d !== day)
          : [...f.schedule.days, day],
      },
    }))
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const supabase = createClient()
      const path = `staff-photos/${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('guest-photos').upload(path, file, { upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('guest-photos').getPublicUrl(path)
      setForm((f) => ({ ...f, photoUrl: publicUrl }))
      toast.success('Photo uploaded')
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.apartment.trim()) {
      toast.error('Name and apartment are required'); return
    }
    setSaving(true)
    const res = await createRecurringVisitor({
      fullName:   form.fullName.trim(),
      role:       form.role,
      phone:      form.phone || undefined,
      photoUrl:   form.photoUrl || undefined,
      validUntil: form.validUntil || undefined,
      apartment:  form.apartment.trim().toUpperCase(),
      schedule:   form.schedule,
    })
    setSaving(false)
    if (res.success) {
      toast.success(`${form.fullName} registered!`)
      setShowForm(false)
      setForm(EMPTY_FORM)
      load()
    } else {
      toast.error(res.error)
    }
  }

  const handleToggleSuspend = async (visitor: any) => {
    const newStatus = visitor.status === 'active' ? 'suspended' : 'active'
    const res = await updateRecurringVisitorStatus(visitor.id, newStatus)
    if (res.success) { toast.success(newStatus === 'active' ? 'Reactivated' : 'Suspended'); load() }
    else toast.error(res.error)
  }

  // Group timeline by visitor short_id
  const timelineByVisitor: Record<string, any[]> = {}
  timeline.forEach((log) => {
    const key = log.visitor?.short_id ?? 'unknown'
    if (!timelineByVisitor[key]) timelineByVisitor[key] = []
    timelineByVisitor[key].push(log)
  })

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Staff & Recurring Visitors" description="Register maids, drivers, tutors and other recurring staff">
        <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Register Staff
        </Button>
      </PageHeader>

      {/* ── Staff List ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : visitors.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <RefreshCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No staff registered yet</p>
          <p className="text-sm mt-1">Register your maid, driver, or other recurring staff.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visitors.map((v) => {
            const apt = v.apartments?.[0]
            const logs = timelineByVisitor[v.short_id] || []
            const isExpanded = expandedId === v.id

            return (
              <Card key={v.id} className={`overflow-hidden ${v.status === 'suspended' ? 'opacity-60' : ''}`}>
                <div className="p-4 flex items-center gap-4">
                  {v.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photo_url} alt={v.full_name} className="h-14 w-14 rounded-xl object-cover border shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                      <span className="text-xl font-bold text-violet-700">{v.full_name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{v.full_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>{v.status}</span>
                    </div>
                    <p className="text-sm text-slate-500">{v.role} · <span className="font-mono text-xs">{v.short_id}</span></p>
                    {apt && <p className="text-xs text-violet-600">Apt {apt.apartment} · {apt.schedule?.days?.join(', ')} {apt.schedule?.start}–{apt.schedule?.end}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => handleToggleSuspend(v)}
                      className={v.status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
                      title={v.status === 'active' ? 'Suspend' : 'Reactivate'}
                    >
                      {v.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : v.id)} className="text-slate-400">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden border-t border-slate-100">
                      <div className="p-4 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Last 7 days
                        </h4>
                        {logs.length === 0 ? (
                          <p className="text-sm text-slate-400">No visits in the last 7 days</p>
                        ) : (
                          <div className="space-y-2">
                            {logs.map((log: any) => (
                              <div key={log.id} className="flex items-center gap-3 text-sm">
                                <div className={`h-2 w-2 rounded-full shrink-0 ${log.status === 'inside' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                <span className="text-slate-600">{formatDateTime(log.entry_time)}</span>
                                {log.exit_time && (
                                  <span className="text-slate-400">→ {formatDateTime(log.exit_time)}</span>
                                )}
                                {log.notes && log.notes.includes('override') && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600">
                                    <AlertTriangle className="h-3 w-3" /> Override
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Register Staff Dialog ───────────────────────────────── */}
      <Dialog open={showForm} onClose={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
        <DialogContent title="Register Recurring Staff" onClose={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Photo */}
            <div className="flex items-center gap-4">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photoUrl} alt="Staff" className="h-16 w-16 rounded-xl object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center">
                  <User className="h-7 w-7 text-slate-400" />
                </div>
              )}
              <div>
                <input type="file" id="staffPhoto" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                <label htmlFor="staffPhoto">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 cursor-pointer" disabled={photoUploading}
                    onClick={() => document.getElementById('staffPhoto')?.click()}>
                    <Camera className="h-3.5 w-3.5" />
                    {photoUploading ? 'Uploading…' : 'Upload Photo'}
                  </Button>
                </label>
                <p className="text-xs text-slate-400 mt-1">Shown to guard during check-in</p>
              </div>
            </div>

            {[
              { key: 'fullName', label: 'Full Name *', type: 'text', placeholder: 'Fatema Begum' },
              { key: 'phone', label: 'Phone (optional)', type: 'tel', placeholder: '01XXXXXXXXX' },
              { key: 'apartment', label: 'Apartment *', type: 'text', placeholder: 'A-101' },
              { key: 'validUntil', label: 'Valid Until (optional)', type: 'date', placeholder: '' },
            ].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{f.label}</label>
                <Input type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <Select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                {RECURRING_VISITOR_ROLES.map((r) => <SelectOption key={r} value={r}>{r}</SelectOption>)}
              </Select>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Work Days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <button key={d} type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      form.schedule.days.includes(d)
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                    }`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['start', 'end'] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 capitalize">{k} Time</label>
                  <Input type="time" value={form.schedule[k]}
                    onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [k]: e.target.value } }))} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Register Staff'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
