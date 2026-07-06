'use client'

import { useRouter } from 'next/navigation'
import QRScanner from '@/components/features/QRScanner'
import PageHeader from '@/components/layout/PageHeader'

export default function ScannerPage() {
  const router = useRouter()

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="QR Scanner"
        description="Scan visitor QR codes to check them in or verify their pass"
      />
      <QRScanner onSuccess={() => router.refresh()} />
    </div>
  )
}
