'use client';

import { useState, useEffect } from 'react';
import { Search, Download, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { IEntryLog } from '@/types';
import { formatDateTime, downloadCSV, toCSV } from '@/lib/utils';

export default function LogsPage() {
  const [logs, setLogs] = useState<IEntryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      const res = await fetch(`/api/admin/logs?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setTotalPages(json.pagination?.pages ?? 1);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page]);

  const filtered = search
    ? logs.filter(
        (log) => {
          const guestName = typeof log.guestPass === 'object' ? log.guestPass?.guestName : '';
          const guardName = typeof log.securityGuard === 'object' ? log.securityGuard?.name : '';
          return (
            guestName?.toLowerCase().includes(search.toLowerCase()) ||
            guardName?.toLowerCase().includes(search.toLowerCase())
          );
        }
      )
    : logs;

  const handleExportCSV = () => {
    const csvData = logs.map((log) => ({
      Guest: typeof log.guestPass === 'object' ? log.guestPass?.guestName ?? 'N/A' : 'N/A',
      Purpose: typeof log.guestPass === 'object' ? log.guestPass?.purpose ?? 'N/A' : 'N/A',
      Guard: typeof log.securityGuard === 'object' ? log.securityGuard?.name ?? 'N/A' : 'N/A',
      'Check In': formatDateTime(log.checkIn),
      'Check Out': log.checkOut ? formatDateTime(log.checkOut) : 'Still Inside',
    }));
    const csv = toCSV(csvData as Record<string, unknown>[], Object.keys(csvData[0] ?? {}));
    downloadCSV(csv, `entry-logs-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Entry Logs</h2>
          <p className="text-gray-400 text-sm mt-0.5">{total} total entries</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-600/30 transition-all"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by guest name or guard name..."
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
              <BookOpen className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium">No entry logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/60">
                  {['Guest', 'Purpose', 'Guard', 'Check In', 'Check Out'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filtered.map((log) => (
                  <tr key={log._id} className="transition-colors">
                    <td className="px-6 py-4 text-white font-medium">
                      {typeof log.guestPass === 'object' ? log.guestPass?.guestName ?? '—' : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm max-w-[140px] truncate">
                      {typeof log.guestPass === 'object' ? log.guestPass?.purpose ?? '—' : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {typeof log.securityGuard === 'object' ? log.securityGuard?.name ?? '—' : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{formatDateTime(log.checkIn)}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {log.checkOut ? (
                        formatDateTime(log.checkOut)
                      ) : (
                        <span className="text-green-400 text-xs">Still Inside</span>
                      )}
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
