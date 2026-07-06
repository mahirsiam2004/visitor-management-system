'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/layout/PageHeader'
import { Bell, Shield, LogOut } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState } from 'react'

export default function SettingsPage() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    const result = await logout()
    if (result.success) {
      router.push('/auth/login')
    } else {
      toast.error('Failed to log out')
      setLoggingOut(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" description="Manage your account preferences" />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Guest pass created', description: 'Receive a notification when a pass is created' },
            { label: 'Guest checked in', description: 'Get notified when your guest arrives' },
            { label: 'Guest checked out', description: 'Get notified when your guest leaves' },
            { label: 'Pass expiry reminder', description: 'Remind 1 hour before a pass expires' },
          ].map((setting) => (
            <div key={setting.label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-900">{setting.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{setting.description}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" defaultChecked className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

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
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base text-red-700">Sign Out</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Sign out from your current session on this device.
          </p>
          <Button
            variant="destructive-outline"
            onClick={handleLogout}
            disabled={loggingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
