'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { logout } from '@/app/actions/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import Logo from '@/components/ui/Logo'
import type { Profile, UserRole } from '@/types'
import {
  LayoutDashboard, Plus, History, User, Settings,
  LogOut, Shield, Users, ClipboardList, BarChart3,
  Scan, QrCode, Building2, ChevronLeft, ChevronRight,
  Menu, X, ShieldCheck, RefreshCcw, CalendarDays,
  AlertTriangle, Zap, ShieldOff, PlusCircle, TrendingDown,
  SlidersHorizontal, ChevronDown, ChevronUp,
} from 'lucide-react'
import NotificationBell from '@/components/features/NotificationBell'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const residentNav: NavItem[] = [
  { label: 'Dashboard',         href: '/dashboard/resident',              icon: LayoutDashboard },
  { label: 'Create Guest Pass', href: '/dashboard/resident/create-pass',  icon: Plus },
  { label: 'Guest History',     href: '/dashboard/resident/history',      icon: History },
  { label: 'My Staff',          href: '/dashboard/resident/staff',        icon: RefreshCcw },
  { label: 'My Events',         href: '/dashboard/resident/events',       icon: CalendarDays },
  { label: 'My Penalties',      href: '/dashboard/resident/penalties',    icon: TrendingDown },
  { label: 'Profile',           href: '/dashboard/resident/profile',      icon: User },
  { label: 'Settings',          href: '/dashboard/resident/settings',     icon: Settings },
]

const securityNav: NavItem[] = [
  { label: 'Dashboard',         href: '/dashboard/security',              icon: LayoutDashboard },
  { label: 'Quick Entry',       href: '/dashboard/security/quick-entry',  icon: Zap },
  { label: 'QR Scanner',        href: '/dashboard/security/scanner',      icon: Scan },
  { label: "Today's Visitors",  href: '/dashboard/security/visitors',     icon: Users },
  { label: 'Entry Logs',        href: '/dashboard/security/logs',         icon: ClipboardList },
]

// Grouped admin nav
const adminNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Residents', href: '/dashboard/admin/residents', icon: Building2 },
      { label: 'Guards',    href: '/dashboard/admin/security',  icon: Shield },
    ],
  },
  {
    label: 'Access',
    items: [
      { label: 'Guest Passes', href: '/dashboard/admin/guest-passes', icon: QrCode },
      { label: 'Entry Logs',   href: '/dashboard/admin/entry-logs',   icon: ClipboardList },
      { label: 'Events',       href: '/dashboard/admin/events',       icon: CalendarDays },
      { label: 'Extensions',   href: '/dashboard/admin/extensions',   icon: PlusCircle },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'Penalties',    href: '/dashboard/admin/penalties',    icon: TrendingDown },
      { label: 'Blacklist',    href: '/dashboard/admin/blacklist',    icon: ShieldOff },
      { label: 'Audit Log',    href: '/dashboard/admin/audit',        icon: ClipboardList },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Policy Settings', href: '/dashboard/admin/policy',    icon: SlidersHorizontal },
      { label: 'Analytics',       href: '/dashboard/admin/analytics', icon: BarChart3 },
    ],
  },
]

const navByRole: Record<UserRole, NavItem[]> = {
  resident: residentNav,
  security: securityNav,
  admin:    [], // admin uses adminNavGroups
}

const roleLabels: Record<UserRole, string> = {
  resident: 'Resident',
  security: 'Security Guard',
  admin:    'Administrator',
}

const roleIcons: Record<UserRole, React.ElementType> = {
  resident: Building2,
  security: Shield,
  admin:    ShieldCheck,
}

interface DashboardLayoutProps {
  children: React.ReactNode
  profile: Profile
}

export default function DashboardLayout({ children, profile }: DashboardLayoutProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)
  // Track which admin groups are open (all open by default)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(adminNavGroups.map(g => [g.label, true]))
  )

  const role      = profile.role as UserRole
  const navItems  = navByRole[role] || residentNav
  const RoleIcon  = roleIcons[role]

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const result = await logout()
      if (result.success) {
        window.location.replace('/auth/login')
      } else {
        toast.error('Failed to log out')
        setLoggingOut(false)
      }
    } catch {
      setLoggingOut(false)
    }
  }

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  /* ------------------------------------------------------------------ */
  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon     = item.icon
    // Exact match for /dashboard/admin; prefix match for sub-routes
    const isActive = item.href === '/dashboard/admin'
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/')
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 min-h-[40px]',
          collapsed ? 'justify-center' : 'gap-3',
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">

      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center border-b border-slate-100 px-4',
        collapsed ? 'justify-center py-4' : 'py-4'
      )}>
        {collapsed ? <Logo size="sm" /> : <Logo size="lg" />}
      </div>

      {/* ── Role badge ── */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
            <RoleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-xs font-medium text-blue-700">{roleLabels[role]}</span>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {role === 'admin' ? (
          // Grouped admin nav
          <div className="space-y-1">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {!collapsed ? (
                  <>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <span>{group.label}</span>
                      {openGroups[group.label]
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                      }
                    </button>
                    <AnimatePresence initial={false}>
                      {openGroups[group.label] && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden space-y-0.5 pl-1"
                        >
                          {group.items.map(item => (
                            <li key={item.href}><NavLink item={item} /></li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  // Collapsed: show icons only, no group headers
                  <ul className="space-y-0.5">
                    {group.items.map(item => (
                      <li key={item.href}><NavLink item={item} /></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Flat nav for resident/security
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}><NavLink item={item} /></li>
            ))}
          </ul>
        )}
      </nav>

      {/* ── User / logout ── */}
      <div className="border-t border-slate-100 p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{profile.full_name}</p>
              <p className="truncate text-xs text-slate-400">{profile.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Logging out…' : 'Logout'}</span>}
        </button>
      </div>
    </div>
  )
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r border-slate-200 bg-white relative transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <SidebarContent />

        {/* collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl lg:hidden"
            >
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex lg:hidden items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile logo */}
          <div className="flex lg:hidden">
            <Logo size="md" />
          </div>

          <div className="flex-1" />

          {/* System status */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>System Online</span>
          </div>

          {/* Notification bell */}
          <NotificationBell userId={profile.id} />

          {/* Apartment badge (residents) */}
          {role === 'resident' && profile.apartment_number && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Building2 className="h-3 w-3" />
              Apt {profile.apartment_number}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
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
