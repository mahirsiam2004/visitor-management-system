'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
import { formatDateTime, formatDate, generateQRToken } from '@/lib/utils/guest-pass'
import { updateGuestPassStatus } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Download, Trash2, Eye, EyeOff } from 'lucide-react'

interface GuestPass {
  id: string
  guest_id: string
  guest_name: string
  guest_phone?: string
  apartment_number: string
  visit_date: string
  visit_time: string
  expiry_time: string
  duration_hours: number
  purpose: string
  qr_token: string
  status: 'valid' | 'expired' | 'revoked'
  created_at: string
}

interface GuestPassCardProps {
  pass: GuestPass
  onUpdate: () => void
}

export default function GuestPassCard({ pass, onUpdate }: GuestPassCardProps) {
  const [showQR, setShowQR] = useState(true)
  const [loading, setLoading] = useState(false)

  const isExpired = new Date(pass.expiry_time) < new Date()
  const statusColor = {
    valid: 'bg-green-100 text-green-800 border-green-300',
    expired: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    revoked: 'bg-red-100 text-red-800 border-red-300',
  }

  const handleRevoke = async () => {
    setLoading(true)
    try {
      const result = await updateGuestPassStatus(pass.id, 'revoked')
      if (result.success) {
        toast.success('Guest pass revoked')
        onUpdate()
      } else {
        toast.error(result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadQR = () => {
    const canvas = document.getElementById(`qr-${pass.id}`) as HTMLCanvasElement
    if (!canvas) return

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `guest-pass-${pass.guest_id}.png`
    link.click()
  }

  const qrData = JSON.stringify({
    id: pass.guest_id,
    token: pass.qr_token,
  })

  return (
    <Card className="p-6 bg-white border border-slate-200 hover:border-slate-300 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">{pass.guest_name}</h3>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${statusColor[pass.status || 'valid']}`}>
              {pass.status?.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-slate-600">Apt {pass.apartment_number}</p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-slate-500 text-xs font-medium mb-1">Visit Date</p>
          <p className="text-slate-900 font-medium">{formatDate(pass.visit_date)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs font-medium mb-1">Visit Time</p>
          <p className="text-slate-900 font-medium">{pass.visit_time}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs font-medium mb-1">Duration</p>
          <p className="text-slate-900 font-medium">{pass.duration_hours} hours</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs font-medium mb-1">Purpose</p>
          <p className="text-slate-900 font-medium">{pass.purpose}</p>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-slate-50 rounded-lg p-4 mb-6 flex items-center justify-center">
        {showQR ? (
          <div id={`qr-${pass.id}`}>
            <QRCode value={qrData} size={180} level="H" />
          </div>
        ) : (
          <div className="text-center text-slate-600">
            <p className="text-sm">Guest ID: {pass.guest_id}</p>
            <p className="text-xs text-slate-500 mt-2">Token: {pass.qr_token.slice(0, 8)}...</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => setShowQR(!showQR)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {showQR ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showQR ? 'Hide' : 'Show'} QR
        </Button>
        {showQR && (
          <Button
            onClick={handleDownloadQR}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        )}
        {pass.status === 'valid' && !isExpired && (
          <Button
            onClick={handleRevoke}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Revoke
          </Button>
        )}
      </div>
    </Card>
  )
}
