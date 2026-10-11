'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { QrCode, Download, Share2, Printer, Check } from 'lucide-react'
import QRCode from 'react-qr-code'
import { createGuestPassSchema, type CreateGuestPassInput } from '@/lib/validations/schemas'
import { createGuestPass } from '@/app/actions/guest-passes'
import { buildQRUrl, formatDate, formatTime, formatDateTime, getTodayString } from '@/lib/utils/guest-pass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { DURATION_OPTIONS, VISIT_PURPOSES } from '@/constants'
import type { GuestPass } from '@/types'

interface CreateGuestPassFormProps {
  apartmentNumber: string
  onSuccess?: (pass: GuestPass) => void
}

export default function CreateGuestPassForm({ apartmentNumber, onSuccess }: CreateGuestPassFormProps) {
  const [loading, setLoading] = useState(false)
  const [createdPass, setCreatedPass] = useState<GuestPass | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateGuestPassInput>({
    resolver: zodResolver(createGuestPassSchema),
    defaultValues: {
      visitDate: getTodayString(),
      durationHours: 2,
    },
  })

  const onSubmit = async (data: CreateGuestPassInput) => {
    setLoading(true)
    try {
      const result = await createGuestPass(data)
      if (result.success) {
        setCreatedPass(result.data)
        onSuccess?.(result.data)
        toast.success('Guest pass created successfully!')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Failed to create guest pass')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width + 40
      canvas.height = img.height + 40
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 20, 20)
        const link = document.createElement('a')
        link.download = `guest-pass-${createdPass?.guest_id}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
    toast.success('QR code downloaded!')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    if (!createdPass) return
    const url = buildQRUrl(createdPass.qr_token)
    if (navigator.share) {
      await navigator.share({
        title: `Guest Pass for ${createdPass.guest_name}`,
        text: `Guest pass for visit on ${formatDate(createdPass.visit_date)} at ${formatTime(createdPass.visit_time)}`,
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard!')
    }
  }

  const handleCreateAnother = () => {
    setCreatedPass(null)
    reset()
  }

  if (createdPass) {
    const qrUrl = buildQRUrl(createdPass.qr_token)

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        <Card className="overflow-hidden">
          {/* Success Banner */}
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800">Guest Pass Created</p>
              <p className="text-xs text-emerald-600">Share the QR code with your guest</p>
            </div>
          </div>

          <div className="p-6 grid gap-8 md:grid-cols-2">
            {/* Guest Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Pass Details</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Guest Name</dt>
                  <dd className="font-medium text-slate-900">{createdPass.guest_name}</dd>
                </div>
                {createdPass.guest_phone && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="font-medium text-slate-900">{createdPass.guest_phone}</dd>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Apartment</dt>
                  <dd className="font-medium text-slate-900">{createdPass.apartment_number}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Visit Date</dt>
                  <dd className="font-medium text-slate-900">{formatDate(createdPass.visit_date)}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Visit Time</dt>
                  <dd className="font-medium text-slate-900">{formatTime(createdPass.visit_time)}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-medium text-slate-900">{createdPass.duration_hours} hours</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Expires</dt>
                  <dd className="font-medium text-red-600">{formatDateTime(createdPass.expiry_time)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Purpose</dt>
                  <dd className="font-medium text-slate-900">{createdPass.purpose}</dd>
                </div>
              </dl>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <div
                ref={qrRef}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
              >
                <QRCode
                  value={qrUrl}
                  size={180}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <p className="text-xs text-center text-slate-500 max-w-[200px]">
                This QR code will expire at {formatDateTime(createdPass.expiry_time)}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={handleDownloadQR} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Button variant="outline" onClick={handleCreateAnother} className="w-full">
          Create Another Pass
        </Button>
      </motion.div>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Guest Pass Details</h2>
        <p className="text-sm text-slate-500 mt-1">
          Apartment {apartmentNumber} — Fill in the details below to generate a QR pass
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Guest Name */}
          <div className="space-y-1.5">
            <label htmlFor="guestName" className="block text-sm font-medium text-slate-700">
              Guest Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="guestName"
              placeholder="John Smith"
              disabled={loading}
              aria-invalid={!!errors.guestName}
              {...register('guestName')}
            />
            {errors.guestName && (
              <p className="text-xs text-red-600" role="alert">{errors.guestName.message}</p>
            )}
          </div>

          {/* Guest Phone */}
          <div className="space-y-1.5">
            <label htmlFor="guestPhone" className="block text-sm font-medium text-slate-700">
              Guest Phone <span className="text-slate-400 text-xs">(optional)</span>
            </label>
            <Input
              id="guestPhone"
              type="tel"
              placeholder="01XXXXXXXXX"
              disabled={loading}
              {...register('guestPhone')}
            />
            {errors.guestPhone && (
              <p className="text-xs text-red-600" role="alert">{errors.guestPhone.message}</p>
            )}
          </div>

          {/* Visit Date */}
          <div className="space-y-1.5">
            <label htmlFor="visitDate" className="block text-sm font-medium text-slate-700">
              Visit Date <span className="text-red-500">*</span>
            </label>
            <Input
              id="visitDate"
              type="date"
              min={getTodayString()}
              disabled={loading}
              aria-invalid={!!errors.visitDate}
              {...register('visitDate')}
            />
            {errors.visitDate && (
              <p className="text-xs text-red-600" role="alert">{errors.visitDate.message}</p>
            )}
          </div>

          {/* Visit Time */}
          <div className="space-y-1.5">
            <label htmlFor="visitTime" className="block text-sm font-medium text-slate-700">
              Visit Time <span className="text-red-500">*</span>
            </label>
            <Input
              id="visitTime"
              type="time"
              disabled={loading}
              aria-invalid={!!errors.visitTime}
              {...register('visitTime')}
            />
            {errors.visitTime && (
              <p className="text-xs text-red-600" role="alert">{errors.visitTime.message}</p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label htmlFor="durationHours" className="block text-sm font-medium text-slate-700">
              Duration <span className="text-red-500">*</span>
            </label>
            <Select
              id="durationHours"
              defaultValue="2"
              disabled={loading}
              aria-invalid={!!errors.durationHours}
              {...register('durationHours', { valueAsNumber: true })}
            >
              {DURATION_OPTIONS.map((opt) => (
                <SelectOption key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectOption>
              ))}
            </Select>
            {errors.durationHours && (
              <p className="text-xs text-red-600" role="alert">{errors.durationHours.message}</p>
            )}
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <label htmlFor="purpose" className="block text-sm font-medium text-slate-700">
              Purpose of Visit <span className="text-red-500">*</span>
            </label>
            <Select
              id="purpose"
              disabled={loading}
              aria-invalid={!!errors.purpose}
              {...register('purpose')}
            >
              <SelectOption value="">Select a purpose</SelectOption>
              {VISIT_PURPOSES.map((p) => (
                <SelectOption key={p} value={p}>{p}</SelectOption>
              ))}
            </Select>
            {errors.purpose && (
              <p className="text-xs text-red-600" role="alert">{errors.purpose.message}</p>
            )}
          </div>

          {/* Apartment display (read-only) */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">
              Your Apartment
            </label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              {apartmentNumber}
            </div>
            <p className="text-xs text-slate-400">Automatically set from your profile</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            type="submit"
            disabled={loading}
            className="gap-2"
          >
            <QrCode className="h-4 w-4" />
            {loading ? 'Creating...' : 'Create & Generate QR'}
          </Button>
          <p className="text-xs text-slate-500">
            A QR code will be generated immediately after submission
          </p>
        </div>
      </form>
    </Card>
  )
}
