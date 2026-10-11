'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ChevronLeft, Clock, CheckCircle, XCircle, Archive, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import {
  createDeliveryRequest,
  getVisitRequestStatus,
  checkInFromRequest,
} from '@/app/actions/visit-requests'
import { DELIVERY_PLATFORMS } from '@/constants'
import type { VisitRequest } from '@/types'

type Step = 'form' | 'waiting' | 'result'

export default function DeliveryPage() {
  const router = useRouter()
  const [step, setStep]             = useState<Step>('form')
  const [loading, setLoading]       = useState(false)
  const [request, setRequest]       = useState<VisitRequest | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(120)
  const [checkingIn, setCheckingIn] = useState(false)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState({
    platform: 'Foodpanda',
    visitorName: '',
    visitorPhone: '',
    destinationApt: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.visitorName.trim() || !form.destinationApt.trim()) {
      toast.error('Rider name and apartment are required')
      return
    }
    setLoading(true)
    const result = await createDeliveryRequest({
      platform:       form.platform,
      visitorName:    form.visitorName,
      visitorPhone:   form.visitorPhone || undefined,
      destinationApt: form.destinationApt,
    })
    setLoading(false)
    if (!result.success) { toast.error(result.error); return }

    setRequest(result.data)
    if (result.data.status === 'approved') {
      // Auto-approved
      setStep('result')
    } else {
      setStep('waiting')
      setSecondsLeft(120)
      startPolling(result.data.id)
    }
  }

  const startPolling = (requestId: string) => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopAll()
          return 0
        }
        return s - 1
      })
    }, 1000)

    pollRef.current = setInterval(async () => {
      const res = await getVisitRequestStatus(requestId)
      if (res.success && res.data.status !== 'pending') {
        stopAll()
        setRequest(res.data)
        setStep('result')
      }
    }, 3000)
  }

  const stopAll = () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => () => stopAll(), [])

  // When timer hits 0, refresh status
  useEffect(() => {
    if (secondsLeft === 0 && request?.id) {
      getVisitRequestStatus(request.id).then((res) => {
        if (res.success) {
          setRequest(res.data)
          setStep('result')
        }
      })
    }
  }, [secondsLeft])

  const handleCheckIn = async () => {
    if (!request) return
    setCheckingIn(true)
    const res = await checkInFromRequest({
      requestId:        request.id,
      idType:           'none',
      identityVerified: false,
    })
    setCheckingIn(false)
    if (res.success) {
      toast.success('Delivery rider checked in!')
      router.push('/dashboard/security/quick-entry')
    } else {
      toast.error(res.error)
    }
  }

  const reset = () => { setStep('form'); setRequest(null); setSecondsLeft(120); setForm({ platform: 'Foodpanda', visitorName: '', visitorPhone: '', destinationApt: '' }) }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-amber-500 px-4 pt-8 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <Package className="h-6 w-6 text-white" />
        <div>
          <h1 className="text-xl font-bold text-white">Delivery Entry</h1>
          <p className="text-amber-100 text-xs">Request resident approval</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {/* ── FORM ─────────────────────────────────────────────── */}
          {step === 'form' && (
            <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-4">
              <Card className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Platform</label>
                  <Select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
                    {DELIVERY_PLATFORMS.map((p) => <SelectOption key={p} value={p}>{p}</SelectOption>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Rider Name <span className="text-red-500">*</span></label>
                  <Input value={form.visitorName} onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))} placeholder="Rider name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Rider Phone <span className="text-slate-400 text-xs">(optional)</span></label>
                  <Input value={form.visitorPhone} onChange={(e) => setForm((f) => ({ ...f, visitorPhone: e.target.value }))} placeholder="01XXXXXXXXX" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Destination Apartment <span className="text-red-500">*</span></label>
                  <Input value={form.destinationApt} onChange={(e) => setForm((f) => ({ ...f, destinationApt: e.target.value.toUpperCase() }))} placeholder="A-101" />
                </div>
              </Card>
              <Button type="submit" disabled={loading} className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600 gap-2">
                <Package className="h-5 w-5" />
                {loading ? 'Sending…' : 'Notify Resident'}
              </Button>
            </motion.form>
          )}

          {/* ── WAITING ──────────────────────────────────────────── */}
          {step === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="p-6 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
                    <Clock className="h-10 w-10 text-amber-600" />
                    <svg className="absolute inset-0 h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="36" fill="none" stroke="#f59e0b" strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 36}`}
                        strokeDashoffset={`${2 * Math.PI * 36 * (1 - secondsLeft / 120)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{secondsLeft}s</p>
                  <p className="text-slate-600 mt-1">Waiting for resident to respond</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-left text-sm space-y-1">
                  <p className="text-slate-500">Platform</p>
                  <p className="font-semibold">{request?.platform}</p>
                  <p className="text-slate-500 mt-2">Rider</p>
                  <p className="font-semibold">{request?.visitor_name}</p>
                  <p className="text-slate-500 mt-2">Apartment</p>
                  <p className="font-semibold">{request?.destination_apt}</p>
                </div>
                <p className="text-xs text-slate-400">
                  If no response, will show "Leave at gate" instructions
                </p>
              </Card>
              <Button variant="outline" onClick={reset} className="w-full">Cancel</Button>
            </motion.div>
          )}

          {/* ── RESULT ───────────────────────────────────────────── */}
          {step === 'result' && request && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {request.status === 'approved' && (
                <Card className="border-emerald-300 bg-emerald-50 p-6 text-center space-y-3">
                  <CheckCircle className="h-14 w-14 text-emerald-600 mx-auto" />
                  <h2 className="text-xl font-bold text-emerald-800">Approved</h2>
                  <p className="text-emerald-700">{request.access_window_min}-minute access window granted</p>
                  <Button onClick={handleCheckIn} disabled={checkingIn}
                    className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <LogIn className="h-5 w-5" />
                    {checkingIn ? 'Checking in…' : 'Allow Entry'}
                  </Button>
                </Card>
              )}
              {(request.status === 'leave_at_gate') && (
                <Card className="border-blue-300 bg-blue-50 p-6 text-center space-y-3">
                  <Archive className="h-14 w-14 text-blue-600 mx-auto" />
                  <h2 className="text-xl font-bold text-blue-800">Leave at Gate</h2>
                  <p className="text-blue-700">Resident asked to leave the package at the gate / reception.</p>
                </Card>
              )}
              {(request.status === 'rejected') && (
                <Card className="border-red-300 bg-red-50 p-6 text-center space-y-3">
                  <XCircle className="h-14 w-14 text-red-600 mx-auto" />
                  <h2 className="text-xl font-bold text-red-800">Rejected</h2>
                  <p className="text-red-700">Resident declined this delivery.</p>
                </Card>
              )}
              {(request.status === 'expired') && (
                <Card className="border-slate-300 bg-slate-100 p-6 text-center space-y-3">
                  <Archive className="h-14 w-14 text-slate-500 mx-auto" />
                  <h2 className="text-xl font-bold text-slate-700">No Response</h2>
                  <p className="text-slate-600 font-medium">Leave the package at the gate or reception. Do NOT allow entry.</p>
                </Card>
              )}
              <Button variant="outline" onClick={reset} className="w-full h-12">
                New Delivery
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
