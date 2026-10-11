'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import {
  BarChart3, TrendingUp, MapPin, Users, Clock,
  AlertTriangle, Download, Calendar, ArrowUpRight,
} from 'lucide-react'
import { getAnalyticsData, exportGuestPassesCSV, exportEntryLogsCSV } from '@/app/actions/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/layout/PageHeader'
import { downloadCSV } from '@/lib/utils'
import type { AnalyticsData } from '@/types'
import * as XLSX from 'xlsx'

// ─── colour palette ────────────────────────────────────────────────────────
const BLUE   = '#3b82f6'
const VIOLET = '#8b5cf6'
const EMERALD = '#10b981'
const AMBER  = '#f59e0b'
const SLATE  = '#64748b'
const COLORS  = [BLUE, VIOLET, EMERALD, AMBER, '#ec4899', '#14b8a6', '#f97316', '#6366f1']

// ─── helpers ───────────────────────────────────────────────────────────────
function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function StatCard({
  label, value, icon: Icon, color, sub, index,
}: {
  label: string; value: string | number; icon: React.ElementType
  color: string; sub?: string; index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.05 }}
    >
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-slate-500">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </Card>
    </motion.div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-slate-400">
      No data for this period
    </div>
  )
}

// ─── Custom tooltip ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [exporting, setExporting] = useState<'csv-passes' | 'csv-logs' | 'xlsx' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getAnalyticsData({
      dateFrom: dateFrom || undefined,
      dateTo:   dateTo   || undefined,
    })
    if (result.success) setData(result.data)
    else toast.error(result.error)
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // ── Exports ──────────────────────────────────────────────────────────────
  const handleExportPassesCSV = async () => {
    setExporting('csv-passes')
    const res = await exportGuestPassesCSV()
    if (res.success) {
      downloadCSV(res.data, `guest-passes-${new Date().toISOString().slice(0,10)}`)
      toast.success('Passes CSV downloaded')
    } else toast.error(res.error)
    setExporting(null)
  }

  const handleExportLogsCSV = async () => {
    setExporting('csv-logs')
    const res = await exportEntryLogsCSV()
    if (res.success) {
      downloadCSV(res.data, `entry-logs-${new Date().toISOString().slice(0,10)}`)
      toast.success('Entry logs CSV downloaded')
    } else toast.error(res.error)
    setExporting(null)
  }

  const handleExportXLSX = async () => {
    if (!data) return
    setExporting('xlsx')
    try {
      const wb = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.passesPerDay.map((d) => ({ Date: d.date, Passes: d.count }))),
        'Passes Per Day'
      )
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.visitsByPurpose),
        'By Purpose'
      )
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.visitorsByApartment),
        'By Apartment'
      )
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.entryExitByHour),
        'Hourly Activity'
      )
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.frequentVisitors),
        'Frequent Visitors'
      )

      XLSX.writeFile(wb, `analytics-${new Date().toISOString().slice(0,10)}.xlsx`)
      toast.success('Excel report downloaded')
    } catch {
      toast.error('Failed to generate Excel file')
    }
    setExporting(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const peakHour = data
    ? data.entryExitByHour.reduce(
        (max, h) => h.entries > max.entries ? h : max,
        data.entryExitByHour[0] ?? { label: '—', entries: 0 }
      )
    : null

  const summaryCards = data
    ? [
        { label: 'Total Visitors',  value: data.totalVisitors,                icon: Users,        color: 'text-blue-600',    sub: 'passes created in period' },
        { label: 'Avg Stay',        value: fmtMinutes(data.avgStayMinutes),   icon: Clock,        color: 'text-emerald-600', sub: 'completed visits only'  },
        { label: 'Overstay Count',  value: data.overstayCount,                icon: AlertTriangle,color: 'text-red-600',     sub: 'still or were overstaying'},
        { label: 'Peak Day',        value: data.peakDay?.count ?? 0,          icon: TrendingUp,   color: 'text-violet-600',  sub: data.peakDay?.date ?? '—' },
        { label: 'Total Check-ins', value: data.totalEntries,                 icon: ArrowUpRight, color: 'text-blue-600',    sub: 'entry log rows' },
        { label: 'Total Check-outs',value: data.totalExits,                   icon: ArrowUpRight, color: 'text-slate-600',   sub: 'exits recorded' },
        { label: 'Active Apartments',value: data.visitorsByApartment.length,  icon: MapPin,       color: 'text-violet-600',  sub: 'had at least 1 visitor' },
        { label: 'Busiest Hour',    value: peakHour?.label ?? '—',            icon: BarChart3,    color: 'text-amber-600',   sub: `${peakHour?.entries ?? 0} entries` },
      ]
    : []

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <PageHeader title="Analytics" description="Visitor trends and insights">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPassesCSV}
            disabled={!!exporting} className="gap-1.5">
            <Download className="h-4 w-4" />
            {exporting === 'csv-passes' ? 'Exporting…' : 'Passes CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportLogsCSV}
            disabled={!!exporting} className="gap-1.5">
            <Download className="h-4 w-4" />
            {exporting === 'csv-logs' ? 'Exporting…' : 'Logs CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXLSX}
            disabled={!!exporting || !data} className="gap-1.5">
            <Download className="h-4 w-4" />
            {exporting === 'xlsx' ? 'Exporting…' : 'Excel Report'}
          </Button>
        </div>
      </PageHeader>

      {/* ── Date-range filter ── */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-sm font-medium text-slate-700">Date range</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="text-slate-500"
          >
            Reset (last 30d)
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 rounded-xl" />
          <div className="grid sm:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-8">

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {summaryCards.map((c, i) => (
              <StatCard key={c.label} {...c} index={i} />
            ))}
          </div>

          {/* ── 1. Daily passes (bar chart) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guest Passes Created — Daily</CardTitle>
            </CardHeader>
            <CardContent>
              {data.passesPerDay.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.passesPerDay} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Passes" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {data.passesPerDay.map((_, i) => (
                        <Cell key={i} fill={BLUE} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── 2. Entry vs Exit by hour (line chart) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entry vs Exit by Hour (UTC)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.entryExitByHour.every((h) => h.entries === 0 && h.exits === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.entryExitByHour} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} />
                    <Line type="monotone" dataKey="entries" name="Entries" stroke={EMERALD} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="exits"   name="Exits"   stroke={VIOLET}  strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── 3. Monthly visitors (bar) ── */}
          {data.monthlyVisitors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Check-ins</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.monthlyVisitors} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Check-ins" fill={VIOLET} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {/* ── 4. Visits by purpose ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visits by Purpose</CardTitle>
              </CardHeader>
              <CardContent>
                {data.visitsByPurpose.length === 0 ? <EmptyChart /> : (
                  <div className="space-y-2.5">
                    {data.visitsByPurpose.map((d, i) => {
                      const max = data.visitsByPurpose[0].count || 1
                      return (
                        <div key={d.purpose}>
                          <div className="flex items-center justify-between mb-1 text-sm">
                            <span className="text-slate-700 truncate">{d.purpose}</span>
                            <span className="font-semibold text-slate-900 ml-2 shrink-0">{d.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(d.count / max) * 100}%` }}
                              transition={{ delay: i * 0.04 + 0.1, duration: 0.5 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 5. Most active apartments ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most Active Apartments</CardTitle>
              </CardHeader>
              <CardContent>
                {data.visitorsByApartment.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      layout="vertical"
                      data={data.visitorsByApartment}
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="apartment" width={50} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Visitors" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {data.visitorsByApartment.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── 6. Frequent visitors table ── */}
          {data.frequentVisitors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Frequent Visitors (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Phone</th>
                        <th className="pb-2 font-medium text-right">Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.frequentVisitors.map((v, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 text-slate-400 w-8">{i + 1}</td>
                          <td className="py-2 font-medium text-slate-900">{v.guest_name}</td>
                          <td className="py-2 text-slate-500">{v.guest_phone || '—'}</td>
                          <td className="py-2 text-right">
                            <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              {v.visit_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      ) : null}
    </div>
  )
}
