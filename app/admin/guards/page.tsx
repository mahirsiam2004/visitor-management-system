'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus, Shield, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { IUser } from '@/types';
import { formatDate } from '@/lib/utils';

export default function GuardsPage() {
  const [guards, setGuards] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchGuards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role: 'security',
        page: String(page),
        limit: '20',
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (json.success) {
        setGuards(json.data);
        setTotalPages(json.pagination?.pages ?? 1);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGuards(); }, [page]);

  const filtered = search
    ? guards.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.email.toLowerCase().includes(search.toLowerCase()) ||
          g.phone.includes(search)
      )
    : guards;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Security Guards</h2>
          <p className="text-gray-400 text-sm mt-0.5">{total} total guards</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-600/30 transition-all">
          <UserPlus className="w-4 h-4" />
          Add Guard
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 skeleton rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium">No security guards found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/60">
                  {['Name', 'Email', 'Phone', 'Joined', 'Status'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filtered.map((guard) => (
                  <tr key={guard._id} className="transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{guard.name}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{guard.email}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{guard.phone}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(guard.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                        <Shield className="w-3 h-3" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/60">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
