'use client';

import { useState, useEffect } from 'react';
import { Users, Shield, QrCode, Activity, CheckCircle, Clock } from 'lucide-react';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDateTime } from '@/lib/utils';

interface AdminStats {
  totalResidents: number;
  totalGuards: number;
  totalPasses: number;
  activePasses: number;
  completedToday: number;
  recentLogs: {
    _id: string;
    guestPass?: { guestName?: string; purpose?: string };
    securityGuard?: { name?: string };
    checkIn: string;
    checkOut?: string;
  }[];
  passStatus: { active: number; inside: number; completed: number; expired: number };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((json) => { if (json.success) setStats(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const statCards = stats
    ? [
        { title: 'Total Residents', value: stats.totalResidents, icon: Users, iconColor: 'text-blue-400', iconBg: 'bg-blue-500/10' },
        { title: 'Security Guards', value: stats.totalGuards, icon: Shield, iconColor: 'text-green-400', iconBg: 'bg-green-500/10' },
        { title: 'Total Passes', value: stats.totalPasses, icon: QrCode, iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10' },
        { title: 'Active Now', value: stats.activePasses, icon: Activity, iconColor: 'text-orange-400', iconBg: 'bg-orange-500/10' },
        { title: 'Completed Today', value: stats.completedToday, icon: CheckCircle, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
        { title: 'Expired Passes', value: stats.passStatus.expired, icon: Clock, iconColor: 'text-red-400', iconBg: 'bg-red-500/10' },
      ]
    : [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">System Overview</h2>
        <p className="text-gray-400 text-sm mt-1">Real-time analytics across the entire platform</p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {statCards.map((card) => (
            <StatsCard key={card.title} {...card} className="opacity-0 animate-fade-in" />
          ))}
        </div>
      )}

      {/* Pass Status Breakdown */}
      {stats && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-5">Pass Status Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active', value: stats.passStatus.active, color: 'bg-blue-500', track: 'bg-blue-500/20' },
              { label: 'Inside', value: stats.passStatus.inside, color: 'bg-green-500', track: 'bg-green-500/20' },
              { label: 'Completed', value: stats.passStatus.completed, color: 'bg-gray-500', track: 'bg-gray-500/20' },
              { label: 'Expired', value: stats.passStatus.expired, color: 'bg-red-500', track: 'bg-red-500/20' },
            ].map((item) => {
              const total = stats.totalPasses || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label} className={`p-4 rounded-xl ${item.track} border border-gray-700/50`}>
                  <div className="text-2xl font-bold text-white mb-1">{item.value}</div>
                  <div className="text-sm text-gray-400 mb-3">{item.label}</div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{pct}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Entry Logs */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60">
          <h3 className="font-semibold text-white">Recent Entry Logs</h3>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
        ) : !stats?.recentLogs?.length ? (
          <div className="py-12 text-center text-gray-500">No entry logs yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/40">
                  {['Guest', 'Purpose', 'Guard', 'Check In', 'Check Out'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {stats.recentLogs.map((log) => (
                  <tr key={log._id}>
                    <td className="px-6 py-4 text-white font-medium">{log.guestPass?.guestName ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{log.guestPass?.purpose ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{log.securityGuard?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{formatDateTime(log.checkIn)}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{log.checkOut ? formatDateTime(log.checkOut) : <span className="text-green-400 text-xs">Still Inside</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
