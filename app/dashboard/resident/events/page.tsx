'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  CalendarDays, Plus, Users, CheckCircle, Clock,
  AlertTriangle, Upload, Trash2, UserPlus,
} from 'lucide-react'
import {
  createEvent, getMyEvents, addEventGuests,
  getEventGuests, addEventCoordinator,
} from '@/app/actions/events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate, formatTime } from '@/lib/utils/guest-pass'
import {
  EVENT_TYPES, EVENT_APPROVAL_THRESHOLD,
  APPROVAL_STATUS_LABELS, EVENT_STATUS_LABELS, EVENT_GUEST_STATUS_LABELS,
} from '@/constants'

const EMPTY_EVENT = {
  name: '', eventType: 'birthday', eventDate: '',
  startTime: '18:00', endTime: '22:00',
  expectedCount: 20, maxCapacity: 30, notes: '',
}

export default function ResidentEventsPage() {
  const [events, setEvents]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [creating, setCreating]       = useState(false)
  const [eventForm, setEventForm]     = useState(EMPTY_EVENT)

  // Selected event for guest management
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [guests, setGuests]           = useState<any[]>([])
  const [guestName, setGuestName]     = useState('')
  const [guestPhone, setGuestPhone]   = useState('')
  const [addingGuest, setAddingGuest] = useState(false)
  const [coordName, setCoordName]     = useState('')
  const [coordPhone, setCoordPhone]   = useState('')
  const [addingCoord, setAddingCoord] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getMyEvents()
    if (res.success) setEvents(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadGuests = useCallback(async (eventId: string) => {
    const res = await getEventGuests(eventId)
    if (res.success) setGuests(res.data)
  }, [])

  useEffect(() => {
    if (selectedEvent) loadGuests(selectedEvent.id)
  }, [selectedEvent, loadGuests])

  const handleCreate = async () => {
    if (!eventForm.name.trim() || !eventForm.eventDate) {
      toast.error('Event name and date are required'); return
    }
    setCreating(true)
    const res = await createEvent({
      name:          eventForm.name,
      eventType:     eventForm.eventType,
      eventDate:     eventForm.eventDate,
      startTime:     eventForm.startTime,
      endTime:       eventForm.endTime,
      expectedCount: eventForm.expectedCount,
      maxCapacity:   eventForm.maxCapacity,
      notes:         eventForm.notes || undefined,
    })
    setCreating(false)
    if (res.success) {
      toast.success('Event created!')
      setShowCreate(false)
      setEventForm(EMPTY_EVENT)
      load()
    } else {
      toast.error(res.error)
    }
  }

  const handleAddGuest = async () => {
    if (!guestName.trim() || !selectedEvent) return
    setAddingGuest(true)
    const res = await addEventGuests(selectedEvent.id, [{ name: guestName, phone: guestPhone || undefined }])
    setAddingGuest(false)
    if (res.success) { toast.success('Guest added'); setGuestName(''); setGuestPhone(''); loadGuests(selectedEvent.id) }
    else toast.error(res.error)
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedEvent) return
    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    const guestList = lines.slice(1).map((line) => {
      const [name, phone] = line.split(',').map((c) => c.trim().replace(/"/g, ''))
      return { name, phone: phone || undefined }
    }).filter((g) => g.name)

    if (guestList.length === 0) { toast.error('No valid rows found'); return }
    const res = await addEventGuests(selectedEvent.id, guestList)
    if (res.success) { toast.success(`${guestList.length} guests added`); loadGuests(selectedEvent.id) }
    else toast.error(res.error)
    e.target.value = ''
  }

  const handleAddCoord = async () => {
    if (!coordName.trim() || !coordPhone.trim() || !selectedEvent) return
    setAddingCoord(true)
    const res = await addEventCoordinator(selectedEvent.id, coordName, coordPhone)
    setAddingCoord(false)
    if (res.success) { toast.success('Coordinator added'); setCoordName(''); setCoordPhone('') }
    else toast.error(res.error)
  }

  const arrivedCount = guests.filter((g) => g.status === 'arrived').length

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader title="My Events" description="Plan and manage events in your apartment">
        <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Create Event
        </Button>
      </PageHeader>

      {/* Events list */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No events planned</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <Card key={ev.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedEvent(ev)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">{ev.name}</p>
                  <p className="text-slate-500 text-sm">{formatDate(ev.event_date)} · {formatTime(ev.start_time)}–{formatTime(ev.end_time)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ev.approval_status === 'not_required' || ev.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    ev.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{APPROVAL_STATUS_LABELS[ev.approval_status]}</span>
                  <span className="text-xs text-slate-400">{EVENT_STATUS_LABELS[ev.status]}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {ev.expected_count} expected / {ev.max_capacity} max</span>
                {ev.requires_approval && ev.approval_status === 'pending' && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Awaiting approval
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Event Dialog ─────────────────────────────────── */}
      <Dialog open={showCreate} onClose={() => { setShowCreate(false); setEventForm(EMPTY_EVENT) }}>
        <DialogContent title="Create Event" onClose={() => { setShowCreate(false); setEventForm(EMPTY_EVENT) }}>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Event Name *</label>
              <Input value={eventForm.name} onChange={(e) => setEventForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Birthday Party" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Event Type</label>
              <Select value={eventForm.eventType} onChange={(e) => setEventForm((f) => ({ ...f, eventType: e.target.value }))}>
                {EVENT_TYPES.map((t) => <SelectOption key={t.value} value={t.value}>{t.label}</SelectOption>)}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <label className="text-sm font-medium text-slate-700">Date *</label>
                <Input type="date" value={eventForm.eventDate} onChange={(e) => setEventForm((f) => ({ ...f, eventDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Start</label>
                <Input type="time" value={eventForm.startTime} onChange={(e) => setEventForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">End</label>
                <Input type="time" value={eventForm.endTime} onChange={(e) => setEventForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Expected guests</label>
                <Input type="number" min={1} max={500} value={eventForm.expectedCount}
                  onChange={(e) => setEventForm((f) => ({ ...f, expectedCount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Max capacity</label>
                <Input type="number" min={1} max={500} value={eventForm.maxCapacity}
                  onChange={(e) => setEventForm((f) => ({ ...f, maxCapacity: Number(e.target.value) }))} />
              </div>
            </div>
            {eventForm.expectedCount > EVENT_APPROVAL_THRESHOLD && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Events with more than {EVENT_APPROVAL_THRESHOLD} guests require admin approval before guests can be admitted.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
              <Input value={eventForm.notes} onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Occasion details…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEventForm(EMPTY_EVENT) }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create Event'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Guest Management Dialog ─────────────────────────────── */}
      <Dialog open={!!selectedEvent} onClose={() => setSelectedEvent(null)}>
        <DialogContent title={selectedEvent?.name ?? ''} onClose={() => setSelectedEvent(null)}>
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Guest counter */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Guest list: <strong>{guests.length}</strong> invited · <strong className="text-emerald-700">{arrivedCount}</strong> arrived</span>
            </div>

            {/* Add guest */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Add Guest</label>
              <div className="flex gap-2">
                <Input placeholder="Name *" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="flex-1" />
                <Input placeholder="Phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="w-36" />
                <Button size="sm" onClick={handleAddGuest} disabled={addingGuest || !guestName.trim()}>
                  {addingGuest ? '…' : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                <Button type="button" variant="outline" size="sm" className="gap-1.5"
                  onClick={() => csvRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload CSV
                </Button>
                <span className="text-xs text-slate-400">Format: name, phone (first row = header)</span>
              </div>
            </div>

            {/* Guest list */}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {guests.map((g) => (
                <div key={g.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-100">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    g.status === 'arrived' ? 'bg-emerald-500' : g.status === 'no_show' ? 'bg-red-400' : 'bg-slate-300'
                  }`} />
                  <span className="flex-1 font-medium text-slate-800">{g.name}</span>
                  {g.phone && <span className="text-slate-400 text-xs">{g.phone}</span>}
                  {g.gate_code && <span className="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{g.gate_code}</span>}
                  <span className="text-xs text-slate-500">{EVENT_GUEST_STATUS_LABELS[g.status]}</span>
                </div>
              ))}
              {guests.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No guests added yet</p>}
            </div>

            {/* Coordinator */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                <UserPlus className="h-4 w-4" /> Add Event Coordinator
              </label>
              <p className="text-xs text-slate-400">Coordinator can approve unlisted visitors during the event</p>
              <div className="flex gap-2">
                <Input placeholder="Name" value={coordName} onChange={(e) => setCoordName(e.target.value)} className="flex-1" />
                <Input placeholder="Phone *" value={coordPhone} onChange={(e) => setCoordPhone(e.target.value)} className="w-36" />
                <Button size="sm" onClick={handleAddCoord} disabled={addingCoord || !coordName.trim() || !coordPhone.trim()}>
                  {addingCoord ? '…' : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
