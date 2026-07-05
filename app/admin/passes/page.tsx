'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Download, QrCode, ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { IGuestPass } from '@/types';
import { formatDate, formatTime, formatDuration, downloadCSV, toCSV } from '@/lib/utils';

const STATUS_FILTERS = ['all', 'active', 'inside', 'completed', 'expired'];

export default function PassesPage() {
  const [passes, setPasses] = useState<IGuestPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPasses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const res = await fetch(`/api/guest?${params}`);
      const json = await res.json();
      if (json.success) {
        setPasses(json.data);
        setTotalPages(json.pagination?.pages ?? 1);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPasses(); }, [page, statusFilter]);

  const filtered = search
    ? passes.filter(
        (p) =>
          p.guestName.toLowerCase().includes(search.toLowerCase()) ||
          p.purpose.toLowerCase().includes(search.toLowerCase()) ||
          p.guestPhone.includes(search)
      )
    : passes;

  const handleExportCSV = () => {
    const csvData = passes.map((p) => ({
      'Guest Name': p.guestName,
      Phone: p.guestPhone,
      Purpose: p.purpose,
      'Visit Date': formatDate(p.visitDate),
      'Visit Time': formatTime(p.visitTime),
      Duration: formatDuration(p.duration),
      Status: p.status,
      'Expires At': new Date(p.expiresAt).toLocaleString(),
    }));
    const csv = toCSV(csvData as Record<string, unknown>[], Object.keys(csvData[0] ?? {}));
    downloadCSV(csv, `all-guest-passes-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Guest Passes</h2>
          <p className="text-gray-400 text-sm mt-0.5">{total} total passes</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-600/30 transition-all"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or purpose..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
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
              <QrCode className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium">No guest passes found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/60">
                  {['Guest', 'Phone', 'Purpose', 'Visit Date & Time', 'Duration', 'Status', 'Expires'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filtered.map((pass) => (
                  <tr key={pass._id} className="transition-colors">
                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{pass.guestName}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{pass.guestPhone}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm max-w-[140px] truncate">{pass.purpose}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{formatDate(pass.visitDate)}</div>
                      <div className="text-xs text-gray-500">{formatTime(pass.visitTime)}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm whitespace-nowrap">{formatDuration(pass.duration)}</td>
                    <td className="px-6 py-4"><StatusBadge status={pass.status} /></td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(pass.expiresAt).toLocaleString()}
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
