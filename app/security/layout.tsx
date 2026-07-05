'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, LogOut, X, Menu } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { IUser } from '@/types';

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !['security', 'admin'].includes(json.data.role)) {
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
        <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 z-50 flex flex-col bg-gray-900/95 backdrop-blur-xl border-r border-gray-800/60 transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-6 border-b border-gray-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-600 to-blue-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm gradient-text">Secure VMS</div>
              <div className="text-xs text-green-400">Security Portal</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {user && (
          <div className="px-4 py-4 border-b border-gray-800/60">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-blue-400 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{user.name.charAt(0)}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                <div className="text-xs text-green-400 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-4">
          <Link
            href="/security"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              pathname === '/security'
                ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Scanner & Lookup
          </Link>
        </nav>

        <div className="p-3 border-t border-gray-800/60">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
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
              <h1 className="text-xl font-bold text-white">Security Portal</h1>
              <p className="text-xs text-gray-500">Scan QR codes and manage visitor entry</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Active</span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
