'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, ChevronLeft, Search, Users, Plus, CheckCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { getActiveEvents, getEventGuests, checkInEventGuest } from '@/app/actions/events'
import { createWalkInRequest, getVisitRequestStatus } from '@/app/actions/visit-requests'
import { formatTime } from '@/lib/utils/guest-pass'

export default function EventModePage() {
  const router = useRouter()
  const [events, setEvents]       = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [guests, setGuests]       = useState<any[]>([])
  const [guestQuery, setGuestQuery] = useState('')
  const [loading, setLoading]     = useState(true)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [counterAdmit, setCounterAdmit] = useState(1)
  const [counterLoading, setCounterLoading] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const res = await getActiveEvents()
    if (res.success) setEvents(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Auto-refresh every 10s when in event mode
  useEffect(() => {
    if (!selectedEvent) return
    const interval = setInterval(async () => {
      const res = await getActiveEvents()
      if (res.success) {
        const updated = res.data.find((e: any) => e.id === selectedEvent.id)
        if (updated) setSelectedEvent(updated)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [selectedEvent])

  const loadGuests = useCallback(async (eventId: string) => {
    const res = await getEventGuests(eventId)
    if (res.success) setGuests(res.data)
  }, [])

  const selectEvent = (event: any) => {
    setSelectedEvent(event)
    loadGuests(event.id)
  }

  const handleNamedCheckIn = async (guestId: string) => {
    if (!selectedEvent) return
    setCheckingIn(guestId)
    const res = await checkInEventGuest({ eventId: selectedEvent.id, guestId })
    setCheckingIn(null)
    if (res.success) {
      toast.success('Guest checked in!')
      setSelectedEvent((prev: any) => ({ ...prev, counter_admitted: res.data.newCount - (guests.filter((g) => g.status === 'arrived').length + 1) + guests.filter((g) => g.status === 'arrived').length + 1 }))
      loadGuests(selectedEvent.id)
    } else {
      toast.error(res.error)
    }
  }

  const handleCounterAdmit = async () => {
    if (!selectedEvent) return
    setCounterLoading(true)
    const res = await checkInEventGuest({
      eventId: selectedEvent.id,
      counterMode: true,
      personsAdmitted: counterAdmit,
    })
    setCounterLoading(false)
    if (res.success) {
      toast.success(`${counterAdmit} person(s) admitted via counter`)
      setSelectedEvent((prev: any) => ({ ...prev, counter_admitted: res.data.newCount }))
    } else {
      toast.error(res.error)
    }
  }

  const filteredGuests = guests.filter((g) =>
    g.name.toLowerCase().includes(guestQuery.toLowerCase()) ||
    (g.gate_code && g.gate_code.includes(guestQuery))
  )

  const totalInside = selectedEvent
    ? (guests.filter((g) => g.status === 'arrived').length) + selectedEvent.counter_admitted
    : 0

  const capacityPct = selectedEvent ? Math.min(100, (totalInside / selectedEvent.max_capacity) * 100) : 0
  const atCapacity  = selectedEvent && totalInside >= selectedEvent.max_capacity

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-emerald-600 px-4 pt-8 pb-5 flex items-center gap-3">
        <button onClick={() => selectedEvent ? setSelectedEvent(null) : router.back()} className="text-white">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <CalendarDays className="h-6 w-6 text-white" />
        <div>
          <h1 className="text-xl font-bold text-white">
            {selectedEvent ? selectedEvent.name : 'Event Mode'}
          </h1>
          <p className="text-emerald-200 text-xs">
            {selectedEvent ? `Apt ${selectedEvent.apartment}` : "Today's events"}
          </p>
        </div>
        {selectedEvent && (
          <button onClick={loadEvents} className="ml-auto text-white">
            <RefreshCw className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <AnimatePresence mode="wait">

          {/* ── EVENT LIST ─────────────────────────────────────────── */}
          {!selectedEvent && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {loading && <p className="text-center text-slate-500 py-8">Loading events…</p>}
              {!loading && events.length === 0 && (
                <Card className="p-8 text-center text-slate-400">No active events today</Card>
              )}
              {events.map((event) => (
                <Card key={event.id} className="p-4 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
                  onClick={() => selectEvent(event)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{event.name}</p>
                      <p className="text-slate-500 text-sm">Apt {event.apartment} · {formatTime(event.start_time)}–{formatTime(event.end_time)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      event.approval_status === 'approved' || event.approval_status === 'not_required'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {event.approval_status === 'not_required' ? 'Ready' : event.approval_status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <Users className="h-4 w-4" />
                    <span>Max {event.max_capacity} guests</span>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}

          {/* ── EVENT MODE ─────────────────────────────────────────── */}
          {selectedEvent && (
            <motion.div key="event" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Live counter */}
              <Card className={`p-5 text-center space-y-2 ${atCapacity ? 'border-red-400 bg-red-50' : 'border-emerald-300 bg-emerald-50'}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Inside Now</p>
                <p className={`text-6xl font-black ${atCapacity ? 'text-red-700' : 'text-emerald-700'}`}>
                  {totalInside}
                  <span className="text-2xl text-slate-400 font-normal">/{selectedEvent.max_capacity}</span>
                </p>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${atCapacity ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
                {atCapacity && <p className="text-red-700 font-bold text-sm">AT CAPACITY — Host approval required for more</p>}
              </Card>

              {/* Counter pass */}
              <Card className="p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Counter Pass (unlisted guests)</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCounterAdmit((n) => Math.max(1, n - 1))} className="h-10 w-10 rounded-lg border flex items-center justify-center text-xl font-bold">−</button>
                  <span className="text-2xl font-bold w-10 text-center">{counterAdmit}</span>
                  <button onClick={() => setCounterAdmit((n) => Math.min(10, n + 1))} className="h-10 w-10 rounded-lg border flex items-center justify-center text-xl font-bold">+</button>
                  <Button onClick={handleCounterAdmit} disabled={counterLoading || !!atCapacity}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    {counterLoading ? 'Admitting…' : `Admit ${counterAdmit}`}
                  </Button>
                </div>
              </Card>

              {/* Guest list search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Search guest name or gate code…"
                  value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredGuests.map((g) => (
                  <Card key={g.id} className={`p-3 flex items-center gap-3 ${g.status === 'arrived' ? 'bg-slate-50 opacity-60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{g.name}</p>
                      <p className="text-xs text-slate-400">{g.gate_code ? `Gate: ${g.gate_code}` : 'No code'} · {g.phone || 'No phone'}</p>
                    </div>
                    {g.status === 'arrived' ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium shrink-0">
                        <CheckCircle className="h-4 w-4" /> Arrived
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleNamedCheckIn(g.id)} disabled={checkingIn === g.id || !!atCapacity}
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 h-9">
                        {checkingIn === g.id ? '…' : 'Check In'}
                      </Button>
                    )}
                  </Card>
                ))}
                {filteredGuests.length === 0 && guestQuery && (
                  <p className="text-center text-slate-400 text-sm py-4">Not on guest list</p>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
