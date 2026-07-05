'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Shield, LayoutDashboard, Users, UserCheck, QrCode,
  BookOpen, LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IUser } from '@/types';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/residents', label: 'Residents', icon: Users },
  { href: '/admin/guards', label: 'Security Guards', icon: UserCheck },
  { href: '/admin/passes', label: 'Guest Passes', icon: QrCode },
  { href: '/admin/logs', label: 'Entry Logs', icon: BookOpen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || json.data.role !== 'admin') {
          router.push('/login');
          return;
        }
        setUser(json.data);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 z-50 flex flex-col bg-gray-900/95 backdrop-blur-xl border-r border-gray-800/60 transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-6 border-b border-gray-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm gradient-text">Secure VMS</div>
              <div className="text-xs text-blue-400">Admin Panel</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {user && (
          <div className="px-4 py-4 border-b border-gray-800/60">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{user.name.charAt(0)}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                <div className="text-xs text-blue-400 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                )}
              >
                <item.icon className={cn('w-4 h-4', isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300')} />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-blue-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800/60">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/60">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-gray-500">Manage the entire system</p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
