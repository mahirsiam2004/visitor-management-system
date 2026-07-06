'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/utils/guest-pass'
import { checkOutGuest } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { LogOut, Clock, User, Home } from 'lucide-react'

interface EntryLog {
  id: string
  guest_pass_id: string
  entry_time: string
  exit_time?: string
  status: 'inside' | 'completed'
  guest_pass: {
    guest_name: string
    guest_id: string
    apartment_number: string
    purpose: string
    guest_phone?: string
  }
  guard?: {
    full_name: string
  }
}

interface EntryLogsListProps {
  logs: EntryLog[]
  onUpdate: () => void
}

export default function EntryLogsList({ logs, onUpdate }: EntryLogsListProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckOut = async (entryLogId: string) => {
    setLoading(entryLogId)
    try {
      const result = await checkOutGuest({ entryLogId })
      if (result.success) {
        toast.success('Guest checked out successfully')
        onUpdate()
      } else {
        toast.error(result.error)
      }
    } finally {
      setLoading(null)
    }
  }

  const calculateDuration = (entryTime: string, exitTime?: string) => {
    const entry = new Date(entryTime)
    const exit = exitTime ? new Date(exitTime) : new Date()
    const diff = exit.getTime() - entry.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id} className="p-4 bg-white border border-slate-200 hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            {/* Guest Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <p className="font-semibold text-slate-900">{log.guest_pass.guest_name}</p>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    log.status === 'inside'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {log.status === 'inside' ? 'Inside' : 'Completed'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {/* Apartment */}
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Apt {log.guest_pass.apartment_number}</span>
                </div>

                {/* Purpose */}
                <div className="text-slate-600 text-sm">
                  <span className="text-slate-500">Purpose:</span> {log.guest_pass.purpose}
                </div>

                {/* Entry Time */}
                <div className="text-slate-600 text-sm">
                  <span className="text-slate-500">Entered:</span>{' '}
                  {formatDateTime(log.entry_time)}
                </div>

                {/* Duration */}
                {log.exit_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{calculateDuration(log.entry_time, log.exit_time)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action */}
            {log.status === 'inside' && (
              <Button
                onClick={() => handleCheckOut(log.id)}
                disabled={loading === log.id}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 ml-4"
                size="sm"
              >
                <LogOut className="w-4 h-4" />
                Check Out
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
