'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronLeft, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { createEmergencyEntry } from '@/app/actions/visit-requests'
import { EMERGENCY_TYPES } from '@/constants'

type Step = 'form' | 'done'

export default function EmergencyPage() {
  const router   = useRouter()
  const [step, setStep]   = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [form, setForm] = useState({
    emergencyType:  'Doctor',
    visitorName:    '',
    destinationApt: '',
    notes:          '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.visitorName.trim() || !form.destinationApt.trim()) {
      toast.error('Name and apartment required'); return
    }
    setLoading(true)
    const res = await createEmergencyEntry({
      visitorName:    form.visitorName,
      emergencyType:  form.emergencyType,
      destinationApt: form.destinationApt,
      notes:          form.notes || undefined,
    })
    setLoading(false)
    if (!res.success) { toast.error(res.error); return }
    setResult(res.data)
    setStep('done')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Red header */}
      <div className="bg-red-600 px-4 pt-8 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white"><ChevronLeft className="h-6 w-6" /></button>
        <AlertTriangle className="h-6 w-6 text-white" />
        <div>
          <h1 className="text-xl font-bold text-white">Emergency Entry</h1>
          <p className="text-red-200 text-xs">No approval wait — immediate entry</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {step === 'form' && (
            <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-4">
              <Card className="border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700 font-medium">
                  ⚠️ Emergency entries are logged immediately and both the resident and admin are notified. Use only for genuine emergencies.
                </p>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Emergency Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EMERGENCY_TYPES.map((t) => (
                      <button
                        key={t} type="button"
                        onClick={() => setForm((f) => ({ ...f, emergencyType: t }))}
                        className={`rounded-xl p-3 text-sm font-medium border-2 transition-all text-left ${
                          form.emergencyType === t
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Person's Name <span className="text-red-500">*</span></label>
                  <Input value={form.visitorName} onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))} placeholder="Dr. Rahman / Officer Khan…" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Destination Apartment <span className="text-red-500">*</span></label>
                  <Input value={form.destinationApt} onChange={(e) => setForm((f) => ({ ...f, destinationApt: e.target.value.toUpperCase() }))} placeholder="A-101" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 text-xs">(optional)</span></label>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional details…" />
                </div>
              </Card>

              <Button type="submit" disabled={loading}
                className="w-full h-16 text-xl font-bold bg-red-600 hover:bg-red-700 gap-3">
                <AlertTriangle className="h-6 w-6" />
                {loading ? 'Logging Entry…' : 'ALLOW EMERGENCY ENTRY'}
              </Button>
            </motion.form>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="border-red-300 bg-red-50 p-8 text-center space-y-3">
                <CheckCircle className="h-16 w-16 text-red-600 mx-auto" />
                <h2 className="text-2xl font-bold text-red-800">Entry Logged</h2>
                <p className="text-red-700">Resident and admin have been notified immediately.</p>
                <div className="rounded-lg bg-white border border-red-200 p-4 text-left text-sm space-y-1">
                  <p className="text-slate-600">Type: <span className="font-medium text-slate-900">{form.emergencyType}</span></p>
                  <p className="text-slate-600">Person: <span className="font-medium text-slate-900">{form.visitorName}</span></p>
                  <p className="text-slate-600">Apartment: <span className="font-medium text-slate-900">{form.destinationApt}</span></p>
                </div>
              </Card>
              <Button onClick={() => router.push('/dashboard/security/quick-entry')} className="w-full h-12">
                Back to Quick Entry
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
