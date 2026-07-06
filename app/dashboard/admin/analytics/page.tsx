'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { BarChart3, TrendingUp, MapPin } from 'lucide-react'
import { getAnalyticsData } from '@/app/actions/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/layout/PageHeader'

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<{
    passesPerDay: { date: string; count: number }[]
    visitsByPurpose: { purpose: string; count: number }[]
    visitorsByApartment: { apartment: string; count: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const result = await getAnalyticsData()
      if (result.success) {
        setAnalytics(result.data)
      } else {
        toast.error(result.error)
      }
      setLoading(false)
    }
    load()
  }, [])

  const maxPassCount = analytics?.passesPerDay.reduce((max, d) => Math.max(max, d.count), 1) || 1
  const maxPurposeCount = analytics?.visitsByPurpose.reduce((max, d) => Math.max(max, d.count), 1) || 1
  const maxApartmentCount = analytics?.visitorsByApartment.reduce((max, d) => Math.max(max, d.count), 1) || 1
  const totalPasses = analytics?.passesPerDay.reduce((sum, d) => sum + d.count, 0) || 0

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Analytics" description="Visitor trends and insights for the last 30 days" />

      {loading ? (
        <div className="grid gap-6">
          <Skeleton className="h-80 w-full rounded-xl" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Passes (30d)', value: totalPasses, icon: BarChart3, color: 'text-blue-600' },
              { label: 'Peak Day', value: analytics.passesPerDay.reduce((max, d) => d.count > (max?.count || 0) ? d : max, analytics.passesPerDay[0])?.count || 0, icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Active Apartments', value: analytics.visitorsByApartment.length, icon: MapPin, color: 'text-violet-600' },
              { label: 'Visit Purposes', value: analytics.visitsByPurpose.length, icon: BarChart3, color: 'text-amber-600' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-slate-500">{stat.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Passes per day chart */}
          <Card>
            <CardHeader>
              <CardTitle>Guest Passes Created (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.passesPerDay.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">No data available</p>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="flex items-end gap-1 h-48 min-w-[600px]">
                    {analytics.passesPerDay.map((d, i) => (
                      <motion.div
                        key={d.date}
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.count / maxPassCount) * 100}%` }}
                        transition={{ delay: i * 0.02, duration: 0.4 }}
                        className="flex-1 min-w-[20px] bg-blue-600 rounded-t-sm hover:bg-blue-700 transition-colors relative group cursor-default"
                        style={{ minHeight: d.count > 0 ? '4px' : '0' }}
                        title={`${d.date}: ${d.count} passes`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {d.count}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-2 min-w-[600px]">
                    {analytics.passesPerDay.map((d) => (
                      <div key={d.date} className="flex-1 text-center text-xs text-slate-400 truncate">
                        {d.date.split(' ')[0]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Visits by purpose */}
            <Card>
              <CardHeader>
                <CardTitle>Visits by Purpose</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.visitsByPurpose.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No data</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.visitsByPurpose.map((d, i) => (
                      <motion.div
                        key={d.purpose}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700 truncate">{d.purpose}</span>
                          <span className="text-sm font-semibold text-slate-900 ml-2">{d.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.count / maxPurposeCount) * 100}%` }}
                            transition={{ delay: i * 0.05 + 0.2, duration: 0.4 }}
                            className="h-full rounded-full bg-blue-500"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visitors by apartment */}
            <Card>
              <CardHeader>
                <CardTitle>Most Active Apartments</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.visitorsByApartment.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No data</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.visitorsByApartment.map((d, i) => (
                      <motion.div
                        key={d.apartment}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700">Apt {d.apartment}</span>
                          <span className="text-sm font-semibold text-slate-900">{d.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.count / maxApartmentCount) * 100}%` }}
                            transition={{ delay: i * 0.05 + 0.2, duration: 0.4 }}
                            className="h-full rounded-full bg-violet-500"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
