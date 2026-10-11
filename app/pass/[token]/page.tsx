import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import QRCode from 'react-qr-code'
import { getPassPublicInfo } from '@/app/actions/guest-passes'
import { buildQRUrl, formatDate, formatTime, formatDateTime } from '@/lib/utils/guest-pass'
import { BUILDING_ADDRESS } from '@/constants'
import { Key, Clock, Users, MapPin, QrCode } from 'lucide-react'

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const result = await getPassPublicInfo(token)
  const title = result.success ? `Guest Pass — ${result.data.guest_name}` : 'Guest Pass'
  return {
    title: `${title} | SecureEntry`,
    description: 'Show this QR code and gate code to the security guard at the entrance.',
    robots: 'noindex',
  }
}

export default async function PublicPassPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const result = await getPassPublicInfo(token)
  if (!result.success) notFound()

  const pass     = result.data
  const qrUrl    = buildQRUrl(pass.qr_token)
  const isExpired = new Date(pass.expiry_time) < new Date()
  const isRevoked = pass.status === 'revoked'
  const isInvalid = isExpired || isRevoked

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Status banner */}
        {isInvalid && (
          <div className={`rounded-2xl p-4 text-center font-bold text-lg ${
            isRevoked ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
          }`}>
            {isRevoked ? '❌ PASS REVOKED' : '⏰ PASS EXPIRED'}
          </div>
        )}

        {/* Main card */}
        <div className="rounded-2xl bg-white overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-5 text-center">
            <p className="text-blue-100 text-xs uppercase tracking-wider mb-1">Guest Pass</p>
            <h1 className="text-2xl font-bold text-white">{pass.guest_name}</h1>
            <p className="text-blue-200 text-sm mt-1">{pass.purpose}</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center py-6 bg-white">
            <div className={`p-4 rounded-xl border-2 ${isInvalid ? 'opacity-40 border-red-300' : 'border-slate-200'} shadow-sm`}>
              <QRCode
                value={qrUrl}
                size={180}
                level="H"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
          </div>

          {/* Gate code */}
          {pass.gate_code && !isInvalid && (
            <div className="mx-4 mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Key className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Gate Code</span>
              </div>
              <p className="text-4xl font-black tracking-[0.3em] text-blue-900 font-mono">{pass.gate_code}</p>
              <p className="text-xs text-blue-500 mt-1">Type this if QR won't scan</p>
            </div>
          )}

          {/* Details */}
          <div className="px-5 pb-5 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-400 text-xs">Visit</p>
                  <p className="font-medium text-slate-800">{formatDate(pass.visit_date)}</p>
                  <p className="text-slate-600">{formatTime(pass.visit_time)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-400 text-xs">Persons</p>
                  <p className="font-medium text-slate-800">{pass.allowed_persons}</p>
                  <p className="text-slate-600">{pass.duration_hours}h window</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 border-t border-slate-100 pt-3">
              <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Expires</p>
                <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatDateTime(pass.expiry_time)}
                </p>
              </div>
            </div>

            {/* Companions */}
            {pass.members && pass.members.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400 mb-2">Registered companions</p>
                <div className="space-y-1">
                  {pass.members.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      <span>{m.full_name}</span>
                      <span className="text-slate-400">({m.relation})</span>
                      {m.is_minor && <span className="text-amber-600">minor</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 border-t border-slate-100 pt-3">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-slate-500 text-xs">{BUILDING_ADDRESS}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {!isInvalid && (
          <div className="rounded-xl bg-white/10 p-4 text-white text-xs text-center space-y-1">
            <p className="font-medium">Show this screen at the security gate</p>
            <p className="opacity-70">The guard will scan your QR code or enter the gate code</p>
          </div>
        )}
      </div>
    </div>
  )
}
