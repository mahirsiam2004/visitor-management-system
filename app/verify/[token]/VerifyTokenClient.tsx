'use client'

import { motion } from 'framer-motion'
import { Lock, CheckCircle, XCircle, Clock, User, Home, AlertCircle, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatDate, formatTime, formatDateTime } from '@/lib/utils/guest-pass'
import Link from 'next/link'

interface VerifyTokenClientProps {
  token: string
  initialResult: any
}

export default function VerifyTokenClient({ token, initialResult }: VerifyTokenClientProps) {
  const result = initialResult

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'valid':
        return {
          icon: CheckCircle,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          title: 'Valid Guest Pass',
          subtitle: 'This visitor is authorized to enter',
        }
      case 'expired':
        return {
          icon: Clock,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          title: 'Pass Expired',
          subtitle: 'This guest pass is no longer valid',
        }
      case 'revoked':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200',
          title: 'Pass Revoked',
          subtitle: 'Access has been denied by the resident',
        }
      case 'already_inside':
        return {
          icon: User,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          title: 'Guest Already Inside',
          subtitle: 'This visitor has already checked in',
        }
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-slate-600',
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          title: 'Visit Completed',
          subtitle: 'This guest has already checked out',
        }
      default:
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200',
          title: 'Invalid Pass',
          subtitle: 'This QR code is not valid',
        }
    }
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Verification Error</h1>
          <p className="text-sm text-slate-500">Failed to verify this QR code. Please try again.</p>
        </Card>
      </div>
    )
  }

  const { status, message, guest_pass, resident } = result
  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-slate-900">SecureEntry</span>
        </div>

        {/* Status Card */}
        <Card className={`p-5 border ${config.border} ${config.bg}`}>
          <div className="flex items-center gap-3 mb-3">
            <Icon className={`h-8 w-8 ${config.color} shrink-0`} />
            <div>
              <h1 className={`font-bold text-lg ${config.color}`}>{config.title}</h1>
              <p className="text-sm text-slate-600">{config.subtitle}</p>
            </div>
          </div>
          {message && (
            <p className="text-xs text-slate-500 border-t border-slate-200 pt-3 mt-3">{message}</p>
          )}
        </Card>

        {/* Guest Details */}
        {guest_pass && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Guest Information</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Guest
                </dt>
                <dd className="font-medium text-slate-900">{guest_pass.guest_name}</dd>
              </div>
              {resident && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5" />
                    Visiting
                  </dt>
                  <dd className="font-medium text-slate-900">
                    {resident.full_name} · Apt {guest_pass.apartment_number}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Visit Date
                </dt>
                <dd className="font-medium text-slate-900">
                  {formatDate(guest_pass.visit_date)} at {formatTime(guest_pass.visit_time)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Purpose</dt>
                <dd className="font-medium text-slate-900">{guest_pass.purpose}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <dt className="text-slate-500">Expires</dt>
                <dd className={`font-medium ${status === 'expired' ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatDateTime(guest_pass.expiry_time)}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400">
          Powered by{' '}
          <Link href="/" className="text-blue-600 hover:underline">
            SecureEntry VMS
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
