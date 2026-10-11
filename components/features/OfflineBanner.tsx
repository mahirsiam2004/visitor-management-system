'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [syncing,   setSyncing]   = useState(false)
  const [syncMsg,   setSyncMsg]   = useState('')

  useEffect(() => {
    const onOffline = () => setIsOffline(true)
    const onOnline  = () => {
      setIsOffline(false)
      // Trigger background sync when reconnected
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((sw) =>
          (sw as any).sync.register('sync-offline-entries').catch(() => {})
        )
      }
    }

    setIsOffline(!navigator.onLine)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    // Listen for SW sync-done messages
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_DONE') {
        setSyncing(false)
        setSyncMsg(`${event.data.count} offline entr${event.data.count === 1 ? 'y' : 'ies'} synced`)
        setTimeout(() => setSyncMsg(''), 4000)
      }
      if (event.data?.type === 'SYNCING') setSyncing(true)
    }
    navigator.serviceWorker?.addEventListener('message', handler)

    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      navigator.serviceWorker?.removeEventListener('message', handler)
    }
  }, [])

  // Register SW
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => console.log('[PWA] Service worker registered'))
        .catch((err) => console.warn('[PWA] SW registration failed:', err))
    }
  }, [])

  if (!isOffline && !syncMsg) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 ${
      isOffline ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
    }`}>
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>অফলাইন — No internet. Check-ins will be queued and synced automatically.</span>
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          <span>Syncing offline entries…</span>
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{syncMsg}</span>
        </>
      )}
    </div>
  )
}
