'use client'

import { Button } from '@/components/ui/button'
import { LogOut, Lock, Shield } from 'lucide-react'

interface AdminHeaderProps {
  user: any
  onLogout: () => void
}

export default function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">SecureEntry</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* User info */}
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user?.email}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>

          {/* Logout button */}
          <Button
            onClick={onLogout}
            variant="outline"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
