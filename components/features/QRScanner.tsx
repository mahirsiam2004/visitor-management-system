'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Scan,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Home,
  RefreshCw,
  LogIn,
  LogOut,
} from 'lucide-react'
import { checkInGuest, checkOutGuest, verifyGuestToken } from '@/app/actions/guest-passes'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime, formatDate, formatTime } from '@/lib/utils/guest-pass'
import type { VerifyTokenResult } from '@/types'
import { manualTokenSchema } from '@/lib/validations/schemas'

interface QRScannerProps {
  onSuccess?: () => void
}

type ScanState = 'idle' | 'scanning' | 'verified' | 'error'

export default function QRScanner({ onSuccess }: QRScannerProps) {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [manualToken, setManualToken] = useState('')
  const [processing, setProcessing] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyTokenResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [scannerStarted, setScannerStarted] = useState(false)
  const scannerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const processToken = useCallback(async (token: string) => {
    setProcessing(true)
    setErrorMessage('')
    try {
      // Extract token from URL if needed
      const tokenValue = token.includes('/verify/') ? token.split('/verify/').pop()! : token.trim()

      const result = await verifyGuestToken(tokenValue)
      if (result.success) {
        setVerifyResult(result.data)
        setScanState('verified')
        if (scannerRef.current) {
          try { await scannerRef.current.stop() } catch {}
        }
      } else {
        setErrorMessage(result.error)
        setScanState('error')
      }
    } catch {
      setErrorMessage('Failed to verify QR code')
      setScanState('error')
    } finally {
      setProcessing(false)
    }
  }, [])

  useEffect(() => {
    let scanner: any = null
    let mounted = true

    const startScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')

        if (!mounted || !containerRef.current) return

        scanner = new Html5QrcodeScanner(
          'qr-scanner-container',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false
        )

        scannerRef.current = scanner

        scanner.render(
          async (decodedText: string) => {
            if (mounted && !processing) {
              await processToken(decodedText)
            }
          },
          (error: string) => {
            if (!error.includes('NotFoundException')) {
              console.debug('QR scan error:', error)
            }
          }
        )
        setScannerStarted(true)
      } catch (err) {
        console.error('Failed to initialize scanner:', err)
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scanner) {
        try { scanner.clear() } catch {}
      }
    }
  }, [])

  const handleCheckIn = async () => {
    if (!verifyResult?.guest_pass) return
    setProcessing(true)
    try {
      const result = await checkInGuest({ token: verifyResult.guest_pass.qr_token })
      if (result.success) {
        toast.success(`${verifyResult.guest_pass.guest_name} checked in successfully!`)
        onSuccess?.()
        handleReset()
      } else {
        toast.error(result.error)
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    await processToken(manualToken)
  }

  const handleReset = () => {
    setScanState('idle')
    setVerifyResult(null)
    setErrorMessage('')
    setManualToken('')

    // Re-initialize scanner
    if (scannerRef.current) {
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }

    // Trigger re-mount of scanner
    setScannerStarted(false)
    setTimeout(async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')
        const scanner = new Html5QrcodeScanner(
          'qr-scanner-container',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        )
        scannerRef.current = scanner
        scanner.render(
          async (decodedText: string) => { await processToken(decodedText) },
          (error: string) => { if (!error.includes('NotFoundException')) console.debug(error) }
        )
        setScannerStarted(true)
      } catch {}
    }, 500)
  }

  const renderVerifyResult = () => {
    if (!verifyResult) return null

    const { status, guest_pass, resident, entry_log_id, entry_time, exit_time } = verifyResult as any

    const statusConfig = {
      valid: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Valid Pass' },
      expired: { icon: XCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Expired' },
      revoked: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Revoked' },
      not_found: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Not Found' },
      already_inside: { icon: User, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Already Inside' },
      completed: { icon: CheckCircle, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', label: 'Visit Completed' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_found
    const Icon = config.icon

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Status Banner */}
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${config.bg}`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
          <span className={`font-semibold ${config.color}`}>{config.label}</span>
          <span className="text-sm text-slate-600 ml-auto">{verifyResult.message}</span>
        </div>

        {/* Guest Details */}
        {guest_pass && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Guest Information</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500 text-xs">Guest Name</dt>
                <dd className="font-medium text-slate-900">{guest_pass.guest_name}</dd>
              </div>
              {guest_pass.guest_phone && (
                <div>
                  <dt className="text-slate-500 text-xs">Phone</dt>
                  <dd className="font-medium text-slate-900">{guest_pass.guest_phone}</dd>
                </div>
              )}
              {resident && (
                <div>
                  <dt className="text-slate-500 text-xs">Resident</dt>
                  <dd className="font-medium text-slate-900">{resident.full_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500 text-xs">Apartment</dt>
                <dd className="font-medium text-slate-900">{guest_pass.apartment_number}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Visit Date</dt>
                <dd className="font-medium text-slate-900">{formatDate(guest_pass.visit_date)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Visit Time</dt>
                <dd className="font-medium text-slate-900">{formatTime(guest_pass.visit_time)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Purpose</dt>
                <dd className="font-medium text-slate-900">{guest_pass.purpose}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Expires</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(guest_pass.expiry_time)}</dd>
              </div>
            </dl>
          </Card>
        )}

        {/* Already inside info */}
        {status === 'already_inside' && entry_time && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Clock className="h-4 w-4" />
              <span>Entered at {formatDateTime(entry_time)}</span>
            </div>
          </Card>
        )}

        {/* Completed info */}
        {status === 'completed' && entry_time && (
          <Card className="p-4 bg-slate-50">
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                <span>Entered: {formatDateTime(entry_time)}</span>
              </div>
              {exit_time && (
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>Exited: {formatDateTime(exit_time)}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {status === 'valid' && (
            <Button onClick={handleCheckIn} disabled={processing} className="flex-1 gap-2">
              <LogIn className="h-4 w-4" />
              {processing ? 'Processing...' : 'Allow Entry'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={processing}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Scan Another
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Camera Scanner */}
      {scanState !== 'verified' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Scan className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Camera QR Scanner</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Point your camera at a guest QR code</p>
          </div>
          <div className="p-4">
            <div
              id="qr-scanner-container"
              ref={containerRef}
              className="w-full max-w-sm mx-auto [&>#qr-scanner-container__scan_region]:rounded-xl [&>div]:border-0"
            />
          </div>
        </Card>
      )}

      {/* Verification Result */}
      <AnimatePresence mode="wait">
        {scanState === 'verified' && verifyResult && renderVerifyResult()}
      </AnimatePresence>

      {/* Error State */}
      <AnimatePresence>
        {scanState === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Verification Failed</p>
              <p className="text-sm text-red-600 mt-0.5">{errorMessage}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-red-600">
              Try again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Token Entry */}
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Manual Token Lookup</h3>
        <form onSubmit={handleManualSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Paste verification URL or token UUID"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            disabled={processing}
            className="flex-1 text-sm font-mono"
          />
          <Button type="submit" disabled={processing || !manualToken.trim()}>
            {processing ? 'Verifying...' : 'Verify'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
