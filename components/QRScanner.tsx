'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScannerState, Html5QrcodeScanType } from 'html5-qrcode'
import { checkInGuest } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { AlertCircle, Smartphone } from 'lucide-react'

interface QRScannerProps {
  onSuccess: () => void
}

export default function QRScanner({ onSuccess }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [scanning, setScanning] = useState(true)
  const [manualInput, setManualInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      },
      false
    )

    scannerRef.current = scanner

    const onScanSuccess = async (decodedText: string) => {
      try {
        setProcessing(true)
        setError('')

        // Parse QR data
        const qrData = JSON.parse(decodedText)
        const { id, token } = qrData

        if (!id || !token) {
          throw new Error('Invalid QR code format')
        }

        // Check in guest
        const result = await checkInGuest({ guestId: id, qrToken: token })

        if (result.success) {
          toast.success(`${qrData.guest_name || 'Guest'} checked in!`)
          scanner.pause()
          setScanning(false)
          onSuccess()
        } else {
          setError(result.error || 'Failed to check in guest')
          toast.error(result.error)
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to process QR code'
        setError(errorMsg)
        toast.error(errorMsg)
      } finally {
        setProcessing(false)
      }
    }

    const onScanError = (errorMsg: string) => {
      // Suppress most errors as they're expected when scanning
      if (!errorMsg.includes('NotFoundException')) {
        console.error('QR Scan Error:', errorMsg)
      }
    }

    scanner.render(onScanSuccess, onScanError)

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear()
        } catch (err) {
          console.error('Error clearing scanner:', err)
        }
      }
    }
  }, [onSuccess])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) {
      setError('Please enter a guest ID or scan a code')
      return
    }

    setProcessing(true)
    setError('')

    try {
      // Try to parse as JSON first (scanned code format)
      let guestId = ''
      let qrToken = ''

      try {
        const qrData = JSON.parse(manualInput)
        guestId = qrData.id
        qrToken = qrData.token
      } catch {
        // If not JSON, assume it's just the guest ID
        guestId = manualInput.trim()
        qrToken = ''
      }

      if (!guestId) {
        throw new Error('Invalid guest ID format')
      }

      const result = await checkInGuest({ guestId, qrToken })

      if (result.success) {
        toast.success('Guest checked in successfully!')
        setManualInput('')
        onSuccess()
      } else {
        setError(result.error)
        toast.error(result.error)
      }
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleResume = () => {
    if (scannerRef.current) {
      scannerRef.current.resume()
      setScanning(true)
      setError('')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
      {/* Scanner Container */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Scan QR Code</h3>
        </div>

        {scanning && (
          <div id="qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-slate-300" />
        )}

        {!scanning && (
          <div className="w-full h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-600 mb-4">Scanner paused after successful check-in</p>
              <Button onClick={handleResume} className="bg-blue-600 hover:bg-blue-700 text-white">
                Scan Another
              </Button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry */}
      <div className="border-t border-slate-200 pt-6 space-y-4">
        <h3 className="font-semibold text-slate-900">Manual Entry</h3>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter guest ID or paste QR data"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            disabled={processing}
            className="flex-1"
          />
          <Button type="submit" disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white">
            {processing ? 'Processing...' : 'Check In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
