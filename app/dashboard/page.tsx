'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, UserCheck, Clock, CheckCircle, Plus, ArrowRight, QrCode } from 'lucide-react';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { IGuestPass } from '@/types';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';

interface Stats {
  totalGuests: number;
  activeGuests: number;
  expiredPasses: number;
  completedVisits: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalGuests: 0, activeGuests: 0, expiredPasses: 0, completedVisits: 0 });
  const [recentPasses, setRecentPasses] = useState<IGuestPass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/guest?limit=5');
        const json = await res.json();
        if (json.success) {
          const passes: IGuestPass[] = json.data;
          setRecentPasses(passes);
          setStats({
            totalGuests: json.pagination?.total ?? passes.length,
            activeGuests: passes.filter((p) => p.status === 'active' || p.status === 'inside').length,
            expiredPasses: passes.filter((p) => p.status === 'expired').length,
            completedVisits: passes.filter((p) => p.status === 'completed').length,
          });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    { title: 'Total Guests', value: stats.totalGuests, icon: Users, iconColor: 'text-blue-400', iconBg: 'bg-blue-500/10' },
    { title: 'Active Guests', value: stats.activeGuests, icon: UserCheck, iconColor: 'text-green-400', iconBg: 'bg-green-500/10' },
    { title: 'Expired Passes', value: stats.expiredPasses, icon: Clock, iconColor: 'text-red-400', iconBg: 'bg-red-500/10' },
    { title: 'Completed Visits', value: stats.completedVisits, icon: CheckCircle, iconColor: 'text-gray-400', iconBg: 'bg-gray-500/10' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Quick action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Overview</h2>
          <p className="text-gray-400 text-sm mt-0.5">Your visitor activity at a glance</p>
        </div>
        <Link
          href="/dashboard/create-pass"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus className="w-4 h-4" />
          New Guest Pass
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
        {statCards.map((card) => (
          <StatsCard key={card.title} {...card} className="opacity-0 animate-fade-in" />
        ))}
      </div>

      {/* Recent Passes */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" />
            Recent Guest Passes
          </h3>
          <Link
            href="/dashboard/guest-history"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 skeleton rounded-xl" />
            ))}
          </div>
        ) : recentPasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
              <QrCode className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium">No guest passes yet</p>
            <p className="text-gray-600 text-sm mt-1">Create your first guest pass to get started</p>
            <Link
              href="/dashboard/create-pass"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 text-sm hover:bg-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Pass
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/40">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Guest</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Purpose</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Visit Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Duration</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {recentPasses.map((pass) => (
                  <tr key={pass._id} className="transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{pass.guestName}</div>
                      <div className="text-xs text-gray-500">{pass.guestPhone}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{pass.purpose}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">{formatDate(pass.visitDate)}</div>
                      <div className="text-xs text-gray-500">{formatTime(pass.visitTime)}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{formatDuration(pass.duration)}</td>
                    <td className="px-6 py-4"><StatusBadge status={pass.status} /></td>
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
