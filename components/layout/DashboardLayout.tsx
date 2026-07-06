'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/app/actions/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Profile, UserRole } from '@/types'
import {
  LayoutDashboard,
  Plus,
  History,
  User,
  Settings,
  LogOut,
  Shield,
  Users,
  FileText,
  ClipboardList,
  BarChart3,
  Lock,
  Scan,
  QrCode,
  Building2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

const residentNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/resident', icon: LayoutDashboard },
  { label: 'Create Guest Pass', href: '/dashboard/resident/create-pass', icon: Plus },
  { label: 'Guest History', href: '/dashboard/resident/history', icon: History },
  { label: 'Profile', href: '/dashboard/resident/profile', icon: User },
  { label: 'Settings', href: '/dashboard/resident/settings', icon: Settings },
]

const securityNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/security', icon: LayoutDashboard },
  { label: 'QR Scanner', href: '/dashboard/security/scanner', icon: Scan },
  { label: "Today's Visitors", href: '/dashboard/security/visitors', icon: Users },
  { label: 'Entry Logs', href: '/dashboard/security/logs', icon: ClipboardList },
]

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'Residents', href: '/dashboard/admin/residents', icon: Building2 },
  { label: 'Security Guards', href: '/dashboard/admin/security', icon: Shield },
  { label: 'Guest Passes', href: '/dashboard/admin/guest-passes', icon: QrCode },
  { label: 'Entry Logs', href: '/dashboard/admin/entry-logs', icon: ClipboardList },
  { label: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart3 },
]

const navByRole: Record<UserRole, NavItem[]> = {
  resident: residentNav,
  security: securityNav,
  admin: adminNav,
}

const roleLabels: Record<UserRole, string> = {
  resident: 'Resident',
  security: 'Security Guard',
  admin: 'Administrator',
}

const roleIcons: Record<UserRole, React.ElementType> = {
  resident: Building2,
  security: Shield,
  admin: Lock,
}

interface DashboardLayoutProps {
  children: React.ReactNode
  profile: Profile
}

export default function DashboardLayout({ children, profile }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const role = profile.role as UserRole
  const navItems = navByRole[role] || residentNav
  const RoleIcon = roleIcons[role]

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const result = await logout()
      if (result.success) {
        router.push('/auth/login')
      } else {
        toast.error('Failed to log out')
      }
    } finally {
      setLoggingOut(false)
    }
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-slate-100 px-4 py-5',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <Lock className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-none">SecureEntry</p>
            <p className="text-xs text-slate-500 mt-0.5">VMS</p>
          </div>
        )}
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
            <RoleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-xs font-medium text-blue-700">{roleLabels[role]}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{profile.full_name}</p>
              <p className="truncate text-xs text-slate-500">{profile.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600',
            collapsed ? 'justify-center' : 'gap-3'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-full z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-r-md bg-white border border-l-0 border-slate-200 text-slate-400 hover:text-slate-600 transition-colors shadow-sm"
          style={{ left: collapsed ? '3.5rem' : '15.5rem' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl lg:hidden"
            >
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex lg:hidden items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>System Online</span>
            </div>
            {role === 'resident' && profile.apartment_number && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                <Building2 className="h-3 w-3" />
                Apt {profile.apartment_number}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
