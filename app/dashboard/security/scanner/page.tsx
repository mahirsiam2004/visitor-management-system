'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scan, Search } from 'lucide-react'
import QRScanner from '@/components/features/QRScanner'
import GuestSearch from '@/components/features/GuestSearch'
import PageHeader from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type Tab = 'qr' | 'search'

export default function ScannerPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('qr')

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'qr',     label: 'QR Scanner',    icon: Scan   },
    { id: 'search', label: 'Guest Search',  icon: Search },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Scanner & Search"
        description="Scan a visitor QR code or search by name, phone, or apartment"
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'qr' && (
        <QRScanner onSuccess={() => router.refresh()} />
      )}
      {activeTab === 'search' && (
        <GuestSearch onCheckIn={() => router.refresh()} />
      )}
    </div>
  )
}
