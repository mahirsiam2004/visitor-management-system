'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Home, Phone, Calendar, Clock, CheckCircle, XCircle, RefreshCw, LogIn } from 'lucide-react'
import { searchGuests, checkInGuest } from '@/app/actions/guest-passes'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import StatusBadge from '@/components/shared/StatusBadge'
import { formatDate, formatTime, getComputedPassStatus } from '@/lib/utils/guest-pass'
import { useDebounce } from '@/hooks/useDebounce'
import type { GuestSearchResult } from '@/types'
import { toast } from 'sonner'

interface GuestSearchProps {
  onCheckIn?: () => void
}

export default function GuestSearch({ onCheckIn }: GuestSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GuestSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const result = await searchGuests(q.trim())
      if (result.success) setResults(result.data)
      else toast.error(result.error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce automatic search as the user types
  const debouncedQuery = useDebounce(query, 400)
  // Run search whenever debounced value changes
  const prevDebounced = useRef('')
  if (debouncedQuery !== prevDebounced.current) {
    prevDebounced.current = debouncedQuery
    runSearch(debouncedQuery)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(query)
  }

  const handleCheckIn = async (pass: GuestSearchResult) => {
    setCheckingIn(pass.id)
    try {
      const result = await checkInGuest({ token: pass.qr_token })
      if (result.success) {
        toast.success(`${pass.guest_name} checked in successfully!`)
        onCheckIn?.()
        // Refresh results
        runSearch(query)
      } else {
        toast.error(result.error)
      }
    } finally {
      setCheckingIn(null)
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setSearched(false)
    inputRef.current?.focus()
  }

  const computedStatus = (pass: GuestSearchResult) =>
    getComputedPassStatus({ status: pass.status, expiry_time: pass.expiry_time })

  return (
    <div className="space-y-4">
      {/* Search box */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by guest name, phone (01XXXXXXXXX), or apartment (A-101)…"
              className="pl-9 pr-9 h-11 text-base"
              autoComplete="off"
              aria-label="Search guests"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" className="h-11 px-5 gap-2 shrink-0" disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </form>

      {/* Hint text */}
      {!searched && (
        <p className="text-xs text-slate-400 text-center">
          Search by guest name, BD phone number, or apartment number (e.g. A-101)
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && searched && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center"
        >
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No guests found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different name, phone number, or apartment</p>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {!loading && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-xs text-slate-500 font-medium">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            {results.map((pass) => {
              const status = computedStatus(pass)
              const canCheckIn = status === 'valid'

              return (
                <Card
                  key={pass.id}
                  className={`p-4 transition-all ${
                    canCheckIn
                      ? 'border-emerald-200 bg-emerald-50/30 hover:shadow-md'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-base ${
                      canCheckIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {pass.guest_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <p className="font-semibold text-slate-900 text-base">{pass.guest_name}</p>
                        <StatusBadge type="pass" status={status} />
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Home className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Apt {pass.apartment_number}</span>
                        </div>
                        {pass.guest_phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{pass.guest_phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(pass.visit_date)} at {formatTime(pass.visit_time)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{pass.duration_hours}h · {pass.purpose}</span>
                        </div>
                        {pass.resident_name && (
                          <div className="col-span-2 flex items-center gap-1.5 text-slate-500 text-xs">
                            <span>Visiting: {pass.resident_name}</span>
                            {pass.resident_phone && (
                              <a
                                href={`tel:${pass.resident_phone}`}
                                className="text-blue-600 underline"
                              >
                                {pass.resident_phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Check-in button */}
                    {canCheckIn && (
                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5 h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleCheckIn(pass)}
                        disabled={checkingIn === pass.id}
                      >
                        {checkingIn === pass.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogIn className="h-4 w-4" />
                        )}
                        Allow Entry
                      </Button>
                    )}
                    {!canCheckIn && status === 'expired' && (
                      <span className="shrink-0 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Expired
                      </span>
                    )}
                    {!canCheckIn && status === 'revoked' && (
                      <span className="shrink-0 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Revoked
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
