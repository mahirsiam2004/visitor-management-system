'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Clock, AlertTriangle, RefreshCw,
  Building2, Shield, Package, UserPlus, Zap, CalendarDays,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import StatusBadge from '@/components/shared/StatusBadge'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime, getOverstayMinutes } from '@/lib/utils/guest-pass'
import { VISITOR_TYPE_LABELS } from '@/constants'

const TYPE_ICONS: Record<string, React.ElementType> = {
  one_time:     Users,
  recurring:    RefreshCw,
  delivery:     Package,
  walk_in:      UserPlus,
  event:        CalendarDays,
  emergency:    Zap,
  minor_family: Users,
}

const TYPE_COLORS: Record<string, string> = {
  one_time:     'bg-blue-100 text-blue-700',
  recurring:    'bg-violet-100 text-violet-700',
  delivery:     'bg-amber-100 text-amber-700',
  walk_in:      'bg-slate-100 text-slate-700',
  event:        'bg-emerald-100 text-emerald-700',
  emergency:    'bg-red-100 text-red-700',
  minor_family: 'bg-pink-100 text-pink-700',
}

export default function LiveInsidePage() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchLive = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('entry_logs')
      .select(`
        id, entry_time, expected_exit_at, overstay_started_at,
        status, visitor_type, gate, shift,
        guest_pass:guest_pass_id(
          guest_name, guest_phone, apartment_number, purpose, guest_photo_url,
          resident:resident_id(full_name, phone_number)
        ),
        security_guard:security_guard_id(full_name),
        visit_request:visit_request_id(visitor_name, platform, type)
      `)
      .in('status', ['inside', 'overstay'])
      .order('entry_time', { ascending: false })

    setEntries(data || [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { fetchLive() }, [fetchLive])

  // Supabase Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('live-inside')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'entry_logs',
      }, () => { fetchLive() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchLive])

  const overstays  = entries.filter((e) => e.status === 'overstay')
  const insideNow  = entries.filter((e) => e.status === 'inside')

  const guestName = (e: any) =>
    e.guest_pass?.guest_name ?? e.visit_request?.visitor_name ?? 'Unknown'
  const apt = (e: any) =>
    e.guest_pass?.apartment_number ?? '—'
  const resident = (e: any) =>
    e.guest_pass?.resident?.full_name ?? '—'
  const resPhone = (e: any) =>
    e.guest_pass?.resident?.phone_number ?? null

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Live Inside" description={`Real-time view · ${entries.length} person${entries.length !== 1 ? 's' : ''} inside · Last updated ${formatDateTime(lastRefresh.toISOString())}`}>
        <button onClick={fetchLive} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </PageHeader>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center border-blue-200 bg-blue-50">
          <p className="text-3xl font-black text-blue-700">{entries.length}</p>
          <p className="text-xs text-blue-500 font-medium mt-1">Total Inside</p>
        </Card>
        <Card className="p-4 text-center border-red-200 bg-red-50">
          <p className="text-3xl font-black text-red-700">{overstays.length}</p>
          <p className="text-xs text-red-500 font-medium mt-1">Overstaying</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-black text-slate-700">{insideNow.length}</p>
          <p className="text-xs text-slate-500 font-medium mt-1">On Time</p>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nobody inside right now</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {/* Overstays first */}
            {[...overstays, ...insideNow].map((entry) => {
              const minsOver = entry.status === 'overstay' && entry.expected_exit_at
                ? getOverstayMinutes(entry.expected_exit_at)
                : 0
              const TypeIcon = TYPE_ICONS[entry.visitor_type] ?? Users
              const typeColor = TYPE_COLORS[entry.visitor_type] ?? 'bg-slate-100 text-slate-600'

              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card className={`p-4 ${entry.status === 'overstay' ? 'border-red-300 bg-red-50/40' : ''}`}>
                    <div className="flex items-start gap-4">
                      {/* Photo or avatar */}
                      {entry.guest_pass?.guest_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.guest_pass.guest_photo_url} alt={guestName(entry)}
                          className="h-12 w-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${typeColor}`}>
                          <TypeIcon className="h-6 w-6" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-900">{guestName(entry)}</p>
                          <StatusBadge type="entry" status={entry.status} />
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}>
                            {VISITOR_TYPE_LABELS[entry.visitor_type] ?? entry.visitor_type}
                          </span>
                          {minsOver > 0 && (
                            <span className="text-xs font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
                              {minsOver} min over
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />Apt {apt(entry)}</span>
                          <span>Resident: {resident(entry)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />In: {formatDateTime(entry.entry_time)}</span>
                          {entry.expected_exit_at && <span>Expected out: {formatDateTime(entry.expected_exit_at)}</span>}
                          {entry.gate && <span>Gate: {entry.gate}</span>}
                          {entry.security_guard?.full_name && <span>Guard: {entry.security_guard.full_name}</span>}
                        </div>
                      </div>

                      {resPhone(entry) && (
                        <a href={`tel:${resPhone(entry)}`} className="shrink-0">
                          <button className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 gap-1 flex items-center">
                            📞 Call
                          </button>
                        </a>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
