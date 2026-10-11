'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCcw, ChevronLeft, Search, AlertTriangle, CheckCircle, LogIn, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { searchRecurringVisitors, checkInRecurringVisitor } from '@/app/actions/recurring'
import { isOnSchedule } from '@/lib/utils/schedule'
import { ID_TYPE_LABELS } from '@/constants'
import { useDebounce } from '@/hooks/useDebounce'

type Step = 'search' | 'detail' | 'warning' | 'done'

export default function RecurringPage() {
  const router = useRouter()
  const [query, setQuery]           = useState('')
  const [apt, setApt]               = useState('')
  const [results, setResults]       = useState<any[]>([])
  const [searching, setSearching]   = useState(false)
  const [selected, setSelected]     = useState<any | null>(null)
  const [selectedLink, setSelectedLink] = useState<any | null>(null)
  const [step, setStep]             = useState<Step>('search')
  const [idType, setIdType]         = useState('known_to_resident')
  const [checkingIn, setCheckingIn] = useState(false)
  const [warning, setWarning]       = useState<string | null>(null)

  const debouncedQ = useDebounce(query, 400)

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const res = await searchRecurringVisitors(q, apt || undefined)
    setSearching(false)
    if (res.success) setResults(res.data)
  }, [apt])

  // Run search when debounced query changes
  const prevQ = { current: '' }
  if (debouncedQ !== prevQ.current) {
    prevQ.current = debouncedQ
    runSearch(debouncedQ)
  }

  const handleSelect = (visitor: any) => {
    const link = visitor.apartments?.find((a: any) => a.is_active) || visitor.apartments?.[0]
    setSelected(visitor)
    setSelectedLink(link)
    setStep('detail')
  }

  const handleCheckIn = async (override = false) => {
    if (!selected || !selectedLink) return
    setCheckingIn(true)
    const res = await checkInRecurringVisitor({
      visitorId:        selected.id,
      apartment:        selectedLink.apartment,
      idType,
      identityVerified: true,
      overrideSchedule: override,
    })
    setCheckingIn(false)

    if (!res.success) {
      if (res.error.startsWith('SCHEDULE_WARNING:')) {
        setWarning(res.error.replace('SCHEDULE_WARNING:', ''))
        setStep('warning')
      } else {
        toast.error(res.error)
      }
      return
    }
    if (res.data.warning) setWarning(res.data.warning)
    toast.success(`${selected.full_name} checked in!`)
    setStep('done')
  }

  const reset = () => { setQuery(''); setResults([]); setSelected(null); setStep('search'); setWarning(null) }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-violet-600 px-4 pt-8 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white"><ChevronLeft className="h-6 w-6" /></button>
        <RefreshCcw className="h-6 w-6 text-white" />
        <div>
          <h1 className="text-xl font-bold text-white">Staff Entry</h1>
          <p className="text-violet-200 text-xs">Search by name, ID, or phone</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {/* ── SEARCH ─────────────────────────────────────────────── */}
          {step === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Name, RV-XXXX, or phone…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <Input
                    className="w-28"
                    placeholder="Apt (opt)"
                    value={apt}
                    onChange={(e) => setApt(e.target.value.toUpperCase())}
                  />
                </div>
              </Card>

              {searching && <p className="text-center text-slate-500 text-sm py-4">Searching…</p>}

              {!searching && results.length === 0 && query.length >= 2 && (
                <p className="text-center text-slate-400 text-sm py-4">No staff found</p>
              )}

              <div className="space-y-3">
                {results.map((v) => (
                  <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Card
                      className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
                      onClick={() => handleSelect(v)}
                    >
                      {v.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.photo_url} alt={v.full_name} className="h-14 w-14 rounded-xl object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-xl font-bold text-violet-700">{v.full_name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{v.full_name}</p>
                        <p className="text-xs text-slate-500">{v.role} · {v.short_id}</p>
                        {v.apartments?.map((a: any) => (
                          <p key={a.id} className="text-xs text-violet-600">Apt {a.apartment}</p>
                        ))}
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>{v.status}</span>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── DETAIL ─────────────────────────────────────────────── */}
          {step === 'detail' && selected && (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  {selected.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.photo_url} alt={selected.full_name} className="h-20 w-20 rounded-2xl object-cover border border-slate-200" />
                  ) : (
                    <div className="h-20 w-20 rounded-2xl bg-violet-100 flex items-center justify-center">
                      <span className="text-3xl font-bold text-violet-700">{selected.full_name.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-bold text-slate-900">{selected.full_name}</p>
                    <p className="text-slate-500">{selected.role}</p>
                    <p className="text-xs text-violet-600 font-mono">{selected.short_id}</p>
                  </div>
                </div>
                {selectedLink && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
                    <p className="text-slate-500">Registered for <span className="font-medium text-slate-800">Apt {selectedLink.apartment}</span></p>
                    {selectedLink.schedule?.days?.length > 0 && (
                      <p className="text-slate-500">Schedule: {selectedLink.schedule.days.join(', ')} · {selectedLink.schedule.start}–{selectedLink.schedule.end}</p>
                    )}
                  </div>
                )}
              </Card>
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  <label className="text-sm font-medium text-slate-700">ID Verification</label>
                </div>
                <Select value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {Object.entries(ID_TYPE_LABELS).map(([v, l]) => <SelectOption key={v} value={v}>{l}</SelectOption>)}
                </Select>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep('search')} className="h-12">Back</Button>
                <Button onClick={() => handleCheckIn(false)} disabled={checkingIn} className="h-12 bg-violet-600 hover:bg-violet-700 gap-2">
                  <LogIn className="h-4 w-4" />
                  {checkingIn ? 'Checking in…' : 'Check In'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── SCHEDULE WARNING ──────────────────────────────────── */}
          {step === 'warning' && (
            <motion.div key="warning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="border-amber-300 bg-amber-50 p-6 text-center space-y-3">
                <AlertTriangle className="h-14 w-14 text-amber-600 mx-auto" />
                <h2 className="text-xl font-bold text-amber-800">Outside Schedule</h2>
                <p className="text-amber-700">{warning}</p>
                <p className="text-amber-600 text-sm">You can still allow entry with supervisor override.</p>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep('detail')} className="h-12">Cancel</Button>
                <Button onClick={() => handleCheckIn(true)} disabled={checkingIn}
                  className="h-12 bg-amber-600 hover:bg-amber-700 text-white gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {checkingIn ? 'Overriding…' : 'Override & Allow'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── DONE ─────────────────────────────────────────────── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="border-emerald-300 bg-emerald-50 p-8 text-center space-y-3">
                <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto" />
                <h2 className="text-2xl font-bold text-emerald-800">Checked In</h2>
                <p className="text-emerald-700 font-semibold">{selected?.full_name}</p>
                {warning && <p className="text-amber-700 text-sm bg-amber-50 rounded-lg p-2">⚠️ {warning}</p>}
              </Card>
              <Button onClick={reset} variant="outline" className="w-full h-12">Check In Another</Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
