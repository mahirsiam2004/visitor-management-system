'use client'

import { useState, useRef, useCallback } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  QrCode, Download, Share2, Printer, Check,
  Plus, Trash2, Users, Camera, Info,
  MessageCircle, Copy, Key,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { createGuestPassSchema, type CreateGuestPassInput } from '@/lib/validations/schemas'
import { createGuestPass } from '@/app/actions/guest-passes'
import {
  buildQRUrl, buildPassUrl, formatDate, formatTime,
  formatDateTime, getTodayString,
} from '@/lib/utils/guest-pass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { DURATION_OPTIONS, VISIT_PURPOSES, RELATION_OPTIONS, BUILDING_ADDRESS } from '@/constants'
import type { GuestPass } from '@/types'

interface CreateGuestPassFormProps {
  apartmentNumber: string
  onSuccess?: (pass: GuestPass) => void
}

// ─── Success screen ────────────────────────────────────────────────────────
function PassSuccessView({
  pass,
  onCreateAnother,
}: {
  pass: GuestPass
  onCreateAnother: () => void
}) {
  const qrRef       = useRef<HTMLDivElement>(null)
  const passUrl     = buildPassUrl(pass.qr_token)
  const qrVerifyUrl = buildQRUrl(pass.qr_token)

  const shareText = `*Guest Pass*\nGuest: ${pass.guest_name}\nApt: ${pass.apartment_number}\nDate: ${formatDate(pass.visit_date)} at ${formatTime(pass.visit_time)}\nDuration: ${pass.duration_hours}h\nPurpose: ${pass.purpose}\nGate Code: *${pass.gate_code}*\nPass Link: ${passUrl}\n\n_${BUILDING_ADDRESS}_`

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) { toast.error('QR not ready'); return }
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width  = img.width  + 40
      canvas.height = img.height + 40
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 20, 20)
        const link = document.createElement('a')
        link.download = `pass-${pass.guest_id}.png`
        link.href     = canvas.toDataURL('image/png')
        link.click()
      }
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
    toast.success('QR PNG downloaded!')
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(passUrl)
    toast.success('Pass link copied!')
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Guest pass for ${pass.guest_name}`, url: passUrl, text: shareText })
    } else {
      handleCopyLink()
    }
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800">Guest Pass Created</p>
            <p className="text-xs text-emerald-600">Share the QR code or gate code with your guest</p>
          </div>
        </div>

        <div className="p-6 grid gap-8 md:grid-cols-2">
          {/* Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Pass Details</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Guest', pass.guest_name],
                pass.guest_phone ? ['Phone', pass.guest_phone] : null,
                ['Apartment', pass.apartment_number],
                ['Date', formatDate(pass.visit_date)],
                ['Time', formatTime(pass.visit_time)],
                ['Duration', `${pass.duration_hours}h`],
                ['Persons allowed', String(pass.allowed_persons)],
                ['Purpose', pass.purpose],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <dt className="text-slate-500">Expires</dt>
                <dd className="font-medium text-red-600">{formatDateTime(pass.expiry_time)}</dd>
              </div>
            </dl>
          </div>

          {/* QR + Gate Code */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div ref={qrRef} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <QRCode value={qrVerifyUrl} size={180} level="H" bgColor="#ffffff" fgColor="#0f172a" />
            </div>

            {/* Gate Code */}
            {pass.gate_code && (
              <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Key className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Gate Code</span>
                </div>
                <p className="text-3xl font-bold tracking-[0.3em] text-blue-900 font-mono">
                  {pass.gate_code}
                </p>
                <p className="text-xs text-blue-500 mt-1">Type this at the gate if QR won't scan</p>
              </div>
            )}

            <p className="text-xs text-center text-slate-400">
              Expires {formatDateTime(pass.expiry_time)}
            </p>
          </div>
        </div>

        {/* Share actions */}
        <div className="border-t border-slate-100 p-5 space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Share Pass</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleWhatsApp}
              className="gap-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white"
              size="sm"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadQR} className="gap-1.5">
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handleNativeShare} className="gap-1.5">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      <Button variant="outline" onClick={onCreateAnother} className="w-full">
        Create Another Pass
      </Button>
    </motion.div>
  )
}

// ─── Main form ─────────────────────────────────────────────────────────────
export default function CreateGuestPassForm({ apartmentNumber, onSuccess }: CreateGuestPassFormProps) {
  const [loading,      setLoading]      = useState(false)
  const [createdPass,  setCreatedPass]  = useState<GuestPass | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUrl,     setPhotoUrl]     = useState<string>('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreateGuestPassInput>({
    resolver: zodResolver(createGuestPassSchema),
    defaultValues: {
      visitDate:      getTodayString(),
      durationHours:  2,
      allowedPersons: 1,
      companions:     [],
      guestPhotoUrl:  '',
    },
  })

  const { fields: companionFields, append: addCompanion, remove: removeCompanion } = useFieldArray({
    control,
    name: 'companions',
  })

  const allowedPersons = watch('allowedPersons') ?? 1
  const maxCompanions  = Math.max(0, (allowedPersons as number) - 1)

  // ── Guest photo upload to Supabase Storage ────────────────────────────
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5 MB'); return }

    setPhotoUploading(true)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()
      const path = `guest-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('guest-photos')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('guest-photos').getPublicUrl(path)
      setPhotoUrl(publicUrl)
      toast.success('Photo uploaded')
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }, [])

  const onSubmit = async (data: CreateGuestPassInput) => {
    setLoading(true)
    try {
      const result = await createGuestPass({ ...data, guestPhotoUrl: photoUrl || undefined })
      if (result.success) {
        setCreatedPass(result.data)
        onSuccess?.(result.data)
        toast.success('Guest pass created!')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Failed to create guest pass')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnother = () => {
    setCreatedPass(null)
    setPhotoUrl('')
    reset()
  }

  if (createdPass) {
    return <PassSuccessView pass={createdPass} onCreateAnother={handleCreateAnother} />
  }

  return (
    <div className="space-y-6">
      {/* Data-collection notice */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Guest information you provide is used solely for building access control. Optional photos
          are stored securely and are only accessible to security staff and admins.
        </p>
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Guest Pass Details</h2>
          <p className="text-sm text-slate-500 mt-1">Apartment {apartmentNumber}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-6">

            {/* ── Section 1: Guest basics ──────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Guest Name <span className="text-red-500">*</span>
                </label>
                <Input placeholder="Mohammad Rahim" disabled={loading} aria-invalid={!!errors.guestName} {...register('guestName')} />
                {errors.guestName && <p className="text-xs text-red-600">{errors.guestName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Guest Phone <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                <Input type="tel" placeholder="01XXXXXXXXX" disabled={loading} {...register('guestPhone')} />
                {errors.guestPhone && <p className="text-xs text-red-600">{errors.guestPhone.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Visit Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" min={getTodayString()} disabled={loading} aria-invalid={!!errors.visitDate} {...register('visitDate')} />
                {errors.visitDate && <p className="text-xs text-red-600">{errors.visitDate.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Visit Time <span className="text-red-500">*</span>
                </label>
                <Input type="time" disabled={loading} aria-invalid={!!errors.visitTime} {...register('visitTime')} />
                {errors.visitTime && <p className="text-xs text-red-600">{errors.visitTime.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Duration <span className="text-red-500">*</span>
                </label>
                <Select disabled={loading} defaultValue="2" aria-invalid={!!errors.durationHours} {...register('durationHours', { valueAsNumber: true })}>
                  {DURATION_OPTIONS.map((o) => (
                    <SelectOption key={o.value} value={String(o.value)}>{o.label}</SelectOption>
                  ))}
                </Select>
                {errors.durationHours && <p className="text-xs text-red-600">{errors.durationHours.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <Select disabled={loading} aria-invalid={!!errors.purpose} {...register('purpose')}>
                  <SelectOption value="">Select a purpose</SelectOption>
                  {VISIT_PURPOSES.map((p) => (
                    <SelectOption key={p} value={p}>{p}</SelectOption>
                  ))}
                </Select>
                {errors.purpose && <p className="text-xs text-red-600">{errors.purpose.message}</p>}
              </div>
            </div>

            {/* ── Section 2: Persons allowed ───────────────────────── */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-800">Number of Persons</h3>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Total persons allowed through this pass
                </label>
                <Controller
                  name="allowedPersons"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-3">
                      <button type="button"
                        onClick={() => field.onChange(Math.max(1, (field.value as number) - 1))}
                        disabled={loading || (field.value as number) <= 1}
                        className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >−</button>
                      <span className="text-lg font-bold text-slate-900 w-8 text-center">{field.value}</span>
                      <button type="button"
                        onClick={() => field.onChange(Math.min(10, (field.value as number) + 1))}
                        disabled={loading || (field.value as number) >= 10}
                        className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >+</button>
                      <span className="text-xs text-slate-500">person{(field.value as number) !== 1 ? 's' : ''} (max 10)</span>
                    </div>
                  )}
                />
              </div>
              {errors.allowedPersons && <p className="text-xs text-red-600">{errors.allowedPersons.message}</p>}
            </div>

            {/* ── Section 3: Companions ────────────────────────────── */}
            <AnimatePresence>
              {(allowedPersons as number) > 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-slate-200 p-4 space-y-3 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Pre-register Companions <span className="text-slate-400 text-xs font-normal">(optional)</span>
                    </h3>
                    <span className="text-xs text-slate-400">{companionFields.length}/{maxCompanions} added</span>
                  </div>

                  {companionFields.map((field, idx) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end"
                    >
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Name</label>
                        <Input
                          placeholder="Full name"
                          disabled={loading}
                          {...register(`companions.${idx}.full_name`)}
                        />
                        {errors.companions?.[idx]?.full_name && (
                          <p className="text-xs text-red-600">{errors.companions[idx]?.full_name?.message}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Relation</label>
                        <Select disabled={loading} {...register(`companions.${idx}.relation`)}>
                          <SelectOption value="">Relation</SelectOption>
                          {RELATION_OPTIONS.map((r) => (
                            <SelectOption key={r} value={r}>{r}</SelectOption>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Minor?</label>
                        <div className="h-9 flex items-center">
                          <input type="checkbox" disabled={loading} {...register(`companions.${idx}.is_minor`)} className="h-4 w-4 rounded" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCompanion(idx)}
                        disabled={loading}
                        className="h-9 w-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        aria-label="Remove companion"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}

                  {companionFields.length < maxCompanions && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCompanion({ full_name: '', relation: '', is_minor: false })}
                      disabled={loading}
                      className="gap-1.5 w-full"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Companion
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Section 4: Guest photo ───────────────────────────── */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Guest Photo <span className="text-slate-400 text-xs font-normal">(optional)</span>
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Upload a photo of your guest. The security guard will see it during check-in for identity verification.
              </p>
              <div className="flex items-center gap-3">
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Guest photo" className="h-16 w-16 rounded-xl object-cover border border-slate-200" />
                )}
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={loading || photoUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={loading || photoUploading}
                    className="gap-1.5"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {photoUploading ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP · max 5 MB</p>
                </div>
              </div>
            </div>

            {/* Apartment (read-only) */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Your Apartment</label>
              <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                {apartmentNumber}
              </div>
            </div>

            <Button type="submit" disabled={loading || photoUploading} className="w-full gap-2">
              <QrCode className="h-4 w-4" />
              {loading ? 'Creating…' : 'Create & Generate QR'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
