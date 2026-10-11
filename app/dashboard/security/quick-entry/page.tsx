'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { QrCode, Package, UserPlus, RefreshCcw, CalendarDays, AlertTriangle } from 'lucide-react'

const ENTRY_TYPES = [
  {
    href:    '/dashboard/security/scanner',
    label:   'Guest / QR',
    sublabel:'Scan QR or enter gate code',
    icon:    QrCode,
    bg:      'bg-blue-600',
    hoverBg: 'hover:bg-blue-700',
    textColor: 'text-white',
  },
  {
    href:    '/dashboard/security/quick-entry/recurring',
    label:   'Staff',
    sublabel:'Maid, driver, cook, tutor…',
    icon:    RefreshCcw,
    bg:      'bg-violet-600',
    hoverBg: 'hover:bg-violet-700',
    textColor: 'text-white',
  },
  {
    href:    '/dashboard/security/quick-entry/delivery',
    label:   'Delivery',
    sublabel:'Foodpanda, Daraz, Pathao…',
    icon:    Package,
    bg:      'bg-amber-500',
    hoverBg: 'hover:bg-amber-600',
    textColor: 'text-white',
  },
  {
    href:    '/dashboard/security/quick-entry/walk-in',
    label:   'Walk-in',
    sublabel:'Unregistered visitor',
    icon:    UserPlus,
    bg:      'bg-slate-700',
    hoverBg: 'hover:bg-slate-800',
    textColor: 'text-white',
  },
  {
    href:    '/dashboard/security/quick-entry/event',
    label:   'Event',
    sublabel:'Wedding, party, gathering',
    icon:    CalendarDays,
    bg:      'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-700',
    textColor: 'text-white',
  },
  {
    href:    '/dashboard/security/quick-entry/emergency',
    label:   'Emergency',
    sublabel:'Doctor, ambulance, police',
    icon:    AlertTriangle,
    bg:      'bg-red-600',
    hoverBg: 'hover:bg-red-700',
    textColor: 'text-white',
  },
]

export default function QuickEntryPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-white">Quick Entry</h1>
        <p className="text-slate-400 text-sm mt-1">Select visitor type to proceed</p>
      </div>

      {/* Big tap buttons — designed for cheap Android phones */}
      <div className="flex-1 px-4 pb-8 grid grid-cols-2 gap-4 content-start">
        {ENTRY_TYPES.map((type, i) => (
          <motion.div
            key={type.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link href={type.href}>
              <button
                className={`w-full h-36 rounded-2xl ${type.bg} ${type.hoverBg} active:scale-95 transition-all flex flex-col items-center justify-center gap-2 shadow-lg`}
              >
                <type.icon className={`h-10 w-10 ${type.textColor}`} strokeWidth={1.5} />
                <span className={`text-lg font-bold ${type.textColor}`}>{type.label}</span>
                <span className={`text-xs ${type.textColor} opacity-80 text-center px-2`}>{type.sublabel}</span>
              </button>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
