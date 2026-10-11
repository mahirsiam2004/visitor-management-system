'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, ChevronLeft, Clock, CheckCircle, XCircle, LogIn, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { createWalkInRequest, getVisitRequestStatus, checkInFromRequest } from '@/app/actions/visit-requests'
import { VISIT_PURPOSES, ID_TYPE_LABELS } from '@/constants'
import type { VisitRequest } from '@/types'

type Step = 'form' | 'waiting' | 'identity' | 'denied'

export default function WalkInPage() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>('form')
  const [loading, setLoading]     = useState(false)
  const [request, setRequest]     = useState<VisitRequest | null>(null)
  const [secondsLeft, setSeconds] = useState(300) // 5 min
  const [idType, setIdType]       = useState('nid')
  const [checkingIn, setCheckingIn] = useState(false)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState({
    visitorName: '', visitorPhone: '', destinationApt: '', purpose: 'Family Visit',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.visitorName.trim() || !form.destinationApt.trim()) {
      toast.error('Visitor name and apartment are required'); return
    }
    setLoading(true)
    const res = await createWalkInRequest({ ...form })
    setLoading(false)
    if (!res.success) { toast.error(res.error); return }
    setRequest(res.data)
    setStep('waiting')
    setSeconds(300)
    startPolling(res.data.id)
  }

  const startPolling = (id: string) => {
    timerRef.current = setInterval(() => setSeconds((s) => { if (s <= 1) { stopAll(); return 0 } return s - 1 }), 1000)
    pollRef.current  = setInterval(async () => {
      const r = await getVisitRequestStatus(id)
      if (r.success && r.data.status !== 'pending') {
        stopAll(); setRequest(r.data)
        if (r.data.status === 'approved') setStep('identity')
        else setStep('denied')
      }
    }, 3000)
  }

  const stopAll = () => { clearInterval(pollRef.current!); clearInterval(timerRef.current!) }
  useEffect(() => () => stopAll(), [])

  useEffect(() => {
    if (secondsLeft === 0 && request?.id) {
      getVisitRequestStatus(request.id).then((r) => {
        if (r.success) { setRequest(r.data); if (r.data.status === 'approved') setStep('identity'); else setStep('denied') }
      })
    }
  }, [secondsLeft])

  const handleCheckIn = async () => {
    if (!request) return
    setCheckingIn(true)
    const res = await checkInFromRequest({ requestId: request.id, idType, identityVerified: true })
    setCheckingIn(false)
    if (res.success) { toast.success('Walk-in visitor checked in!'); router.push('/dashboard/security/quick-entry') }
    else toast.error(res.error)
  }

  const reset = () => { stopAll(); setStep('form'); setRequest(null); setSeconds(300) }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-700 px-4 pt-8 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white"><ChevronLeft className="h-6 w-6" /></button>
        <UserPlus className="h-6 w-6 text-white" />
        <div>
          <h1 className="text-xl font-bold text-white">Walk-in Entry</h1>
          <p className="text-slate-300 text-xs">Needs resident approval</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {step === 'form' && (
            <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-4">
              <Card className="p-5 space-y-4">
                {[
                  { key: 'visitorName', label: 'Visitor Name *', placeholder: 'Full name', type: 'text' },
                  { key: 'visitorPhone', label: 'Phone (optional)', placeholder: '01XXXXXXXXX', type: 'tel' },
                  { key: 'destinationApt', label: 'Apartment *', placeholder: 'A-101', type: 'text' },
                ].map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{f.label}</label>
                    <Input
                      type={f.type} placeholder={f.placeholder}
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Purpose *</label>
                  <Select value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}>
                    {VISIT_PURPOSES.map((p) => <SelectOption key={p} value={p}>{p}</SelectOption>)}
                  </Select>
                </div>
              </Card>
              <Button type="submit" disabled={loading} className="w-full h-14 text-lg bg-slate-700 hover:bg-slate-800 gap-2">
                <UserPlus className="h-5 w-5" />
                {loading ? 'Sending…' : 'Notify Resident'}
              </Button>
            </motion.form>
          )}

          {step === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="p-6 text-center space-y-4">
                <Clock className="h-14 w-14 text-slate-600 mx-auto" />
                <p className="text-3xl font-bold text-slate-900">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </p>
                <p className="text-slate-600">Waiting for resident approval</p>
                <div className="rounded-xl bg-slate-50 p-4 text-left text-sm space-y-2">
                  <p className="font-semibold">{form.visitorName}</p>
                  <p className="text-slate-500">→ Apt {form.destinationApt} · {form.purpose}</p>
                </div>
              </Card>
              <Button variant="outline" onClick={reset} className="w-full">Cancel</Button>
            </motion.div>
          )}

          {step === 'identity' && (
            <motion.div key="identity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="border-emerald-300 bg-emerald-50 p-6 text-center space-y-3">
                <CheckCircle className="h-14 w-14 text-emerald-600 mx-auto" />
                <h2 className="text-xl font-bold text-emerald-800">Resident Approved</h2>
                <p className="text-emerald-700 text-sm">Verify the visitor's identity before allowing entry</p>
              </Card>
              <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-800">ID Verification</h3>
                </div>
                <Select value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {Object.entries(ID_TYPE_LABELS).map(([v, l]) => <SelectOption key={v} value={v}>{l}</SelectOption>)}
                </Select>
              </Card>
              <Button onClick={handleCheckIn} disabled={checkingIn}
                className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 gap-2">
                <LogIn className="h-5 w-5" />
                {checkingIn ? 'Checking in…' : 'Allow Entry'}
              </Button>
            </motion.div>
          )}

          {step === 'denied' && (
            <motion.div key="denied" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="border-red-300 bg-red-50 p-8 text-center space-y-3">
                <XCircle className="h-16 w-16 text-red-600 mx-auto" />
                <h2 className="text-2xl font-bold text-red-800">
                  {request?.status === 'rejected' ? 'REJECTED' : 'TIMED OUT'}
                </h2>
                <p className="text-red-700">
                  {request?.status === 'rejected'
                    ? 'Resident denied this visitor. Do not allow entry.'
                    : 'No response received. Entry not permitted.'}
                </p>
              </Card>
              <Button variant="outline" onClick={reset} className="w-full h-12">New Request</Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
