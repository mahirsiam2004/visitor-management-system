'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/layout/PageHeader'
import { Bell, Shield, LogOut, MessageSquare } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { getNotificationPreferences, updateNotificationPreferences } from '@/app/actions/notifications'
import { useRouter } from 'next/navigation'
import type { NotificationPreferences } from '@/types'
import { NOTIFY_EVENT_LABELS } from '@/constants'

type PrefKey = keyof Pick<NotificationPreferences,
  'notify_checkin' | 'notify_checkout' | 'notify_overstay' | 'notify_ending_soon' |
  'notify_delivery' | 'notify_walk_in' | 'notify_extension' | 'notify_penalty' |
  'notify_revoked' | 'notify_event' | 'notify_emergency'>

const PREF_KEYS: PrefKey[] = [
  'notify_checkin', 'notify_checkout', 'notify_overstay', 'notify_ending_soon',
  'notify_delivery', 'notify_walk_in', 'notify_extension', 'notify_penalty',
  'notify_revoked', 'notify_event', 'notify_emergency',
]

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="peer sr-only" />
      <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [prefs, setPrefs]           = useState<NotificationPreferences | null>(null)
  const [saving, setSaving]         = useState(false)
  const [loadingPrefs, setLoadingPrefs] = useState(true)

  useEffect(() => {
    getNotificationPreferences().then((res) => {
      if (res.success) setPrefs(res.data)
      setLoadingPrefs(false)
    })
  }, [])

  const handleToggle = async (key: PrefKey, value: boolean) => {
    if (!prefs) return
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setSaving(true)
    const res = await updateNotificationPreferences({ [key]: value })
    setSaving(false)
    if (!res.success) { toast.error(res.error); setPrefs(prefs) /* revert */ }
  }

  const handleChannelToggle = async (channel: 'sms_enabled', value: boolean) => {
    if (!prefs) return
    const updated = { ...prefs, [channel]: value }
    setPrefs(updated)
    const res = await updateNotificationPreferences({ [channel]: value })
    if (!res.success) { toast.error(res.error); setPrefs(prefs) }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    const result = await logout()
    if (result.success) router.push('/auth/login')
    else { toast.error('Failed to log out'); setLoggingOut(false) }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" description="Manage your account and notification preferences" />

      {/* ── Notification Channels ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Notification Channels</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-900">In-app notifications</p>
              <p className="text-xs text-slate-500">Bell icon in the header — always on</p>
            </div>
            <Toggle checked={true} onChange={() => {}} disabled />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-900">SMS (critical events)</p>
              <p className="text-xs text-slate-500">Delivery requests, overstay, emergency. Requires phone number in profile.</p>
            </div>
            <Toggle
              checked={prefs?.sms_enabled ?? false}
              onChange={(v) => handleChannelToggle('sms_enabled', v)}
              disabled={loadingPrefs}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Per-event toggles ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Notification Events</CardTitle>
            {saving && <span className="text-xs text-slate-400 ml-auto">Saving…</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {PREF_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <p className="text-sm font-medium text-slate-800">{NOTIFY_EVENT_LABELS[key]}</p>
              <Toggle
                checked={prefs ? (prefs[key] as boolean) : true}
                onChange={(v) => handleToggle(key, v)}
                disabled={loadingPrefs || saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Security ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-900">Two-factor authentication</p>
              <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm">Enable</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Active sessions</p>
              <p className="text-xs text-slate-500 mt-0.5">Manage devices where you are logged in</p>
            </div>
            <Button variant="outline" size="sm">View</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardContent className="pt-5">
          <Button variant="destructive" onClick={handleLogout} disabled={loggingOut} className="gap-2 w-full">
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
