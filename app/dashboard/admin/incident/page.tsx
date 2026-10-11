'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, Download, Eye, FileText, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils/guest-pass'
import StatusBadge from '@/components/shared/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { downloadCSV } from '@/lib/utils'

export default function IncidentPage() {
  const [from, setFrom]     = useState('')
  const [to, setTo]         = useState('')
  const [apt, setApt]       = useState('')
  const [gate, setGate]     = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [attempts, setAttempts] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const runQuery = useCallback(async () => {
    if (!from || !to) { toast.error('Select a date-time window'); return }
    setLoading(true)
    const supabase = createClient()

    const fromISO = new Date(from).toISOString()
    const toISO   = new Date(to).toISOString()

    let q = supabase
      .from('entry_logs')
      .select(`
        id, entry_time, exit_time, status, visitor_type, gate, shift,
        id_type, identity_verified, entry_photo_url,
        guest_pass:guest_pass_id(
          id, guest_name, guest_phone, apartment_number, purpose,
          resident:resident_id(full_name, phone_number)
        ),
        visit_request:visit_request_id(visitor_name, platform),
        security_guard:security_guard_id(full_name)
      `)
      .or(`and(entry_time.gte.${fromISO},entry_time.lte.${toISO}),and(exit_time.gte.${fromISO},exit_time.lte.${toISO})`)
      .order('entry_time', { ascending: true })

    if (apt) q = q.eq('guest_pass.apartment_number', apt)
    if (gate) q = q.eq('gate', gate)

    const { data: entryData } = await q
    setEntries(entryData || [])

    // Failed attempts in window
    const { data: attemptData } = await supabase
      .from('access_attempts')
      .select(`
        id, token_used, result, created_at, ip_address,
        guard:guard_id(full_name),
        pass:pass_id(guest_name, apartment_number)
      `)
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: true })

    setAttempts(attemptData || [])
    setSearched(true)
    setLoading(false)
  }, [from, to, apt, gate])

  const handlePDF = async () => {
    setPdfLoading(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { IncidentReportDocument } = await import('@/lib/pdf/incident-report')

      const { data: { user } } = await createClient().auth.getUser()
      const { data: profile } = await createClient()
        .from('profiles').select('full_name').eq('id', user!.id).single()

      const blob = await pdf(
        IncidentReportDocument({
          window: { from, to },
          filter: { apartment: apt || undefined, gate: gate || undefined },
          entries,
          attempts,
          generatedBy: profile?.full_name ?? 'Admin',
          buildingName: 'SecureEntry Residential',
        }) as any
      ).toBlob()

      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.download = `incident-report-${new Date().toISOString().slice(0,16)}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (err: any) {
      toast.error('PDF generation failed: ' + err.message)
    }
    setPdfLoading(false)
  }

  const handleCSV = () => {
    const rows = entries.map((e) => ({
      'Entry Time':  formatDateTime(e.entry_time),
      'Exit Time':   e.exit_time ? formatDateTime(e.exit_time) : '',
      'Visitor':     e.guest_pass?.guest_name ?? e.visit_request?.visitor_name ?? '',
      'Apartment':   e.guest_pass?.apartment_number ?? '',
      'Resident':    e.guest_pass?.resident?.full_name ?? '',
      'Guard':       e.security_guard?.full_name ?? '',
      'Gate':        e.gate ?? '',
      'Shift':       e.shift ?? '',
      'ID Type':     e.id_type ?? '',
      'Verified':    e.identity_verified ? 'Yes' : 'No',
      'Status':      e.status,
      'Photo':       e.entry_photo_url ? 'Yes' : 'No',
    }))
    const attRows = attempts.map((a) => ({
      'Time':    formatDateTime(a.created_at),
      'Result':  a.result,
      'Guard':   a.guard?.full_name ?? '',
      'Pass':    a.pass?.guest_name ?? '',
      'Token':   a.token_used ?? '',
      'IP':      a.ip_address ?? '',
    }))
    downloadCSV([...rows, {}, { '---': 'FAILED ATTEMPTS ---' }, ...attRows],
      `incident-${new Date().toISOString().slice(0,16)}`)
    toast.success('CSV downloaded')
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title="Incident Investigation" description="Query who entered, was inside, or left in any time window. Export as PDF for GD/FIR." />

      {/* Filter panel */}
      <Card className="p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">From (Dhaka time)</label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">To (Dhaka time)</label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Apartment (optional)</label>
            <Input placeholder="A-101" value={apt} onChange={(e) => setApt(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Gate (optional)</label>
            <Input placeholder="Gate 1" value={gate} onChange={(e) => setGate(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button onClick={runQuery} disabled={loading} className="gap-2">
            <Search className="h-4 w-4" />
            {loading ? 'Searching…' : 'Search'}
          </Button>
          {searched && (
            <>
              <Button variant="outline" onClick={handlePDF} disabled={pdfLoading} className="gap-2">
                <FileText className="h-4 w-4" />
                {pdfLoading ? 'Generating…' : 'Export PDF'}
              </Button>
              <Button variant="outline" onClick={handleCSV} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </Card>

      {searched && (
        <>
          {/* Entries table */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Entry/Exit Records ({entries.length})
            </h2>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {['Entry','Exit','Visitor','Apt','Resident','Guard','Gate','ID','Status','Photo'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((e) => (
                      <tr key={e.id} className={`${e.status === 'overstay' ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">{formatDateTime(e.entry_time)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{e.exit_time ? formatDateTime(e.exit_time) : '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                          {e.guest_pass?.guest_name ?? e.visit_request?.visitor_name ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{e.guest_pass?.apartment_number ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{e.guest_pass?.resident?.full_name ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{e.security_guard?.full_name ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{e.gate ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{e.id_type ?? '—'}</td>
                        <td className="px-3 py-2"><StatusBadge type="entry" status={e.status} /></td>
                        <td className="px-3 py-2">
                          {e.entry_photo_url
                            ? <a href={e.entry_photo_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">View</a>
                            : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-400">No entries in this window</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Failed attempts */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Denied / Failed Attempts ({attempts.length})
            </h2>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {['Time','Result','Guard','Pass','Token','IP'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                      <td className="px-3 py-2"><span className="text-xs font-medium text-amber-700 bg-amber-50 rounded px-2 py-0.5">{a.result}</span></td>
                      <td className="px-3 py-2 text-slate-600">{a.guard?.full_name ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{a.pass?.guest_name ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono text-xs">{a.token_used ? a.token_used.slice(0, 14) + '…' : '—'}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs">{a.ip_address ?? '—'}</td>
                    </tr>
                  ))}
                  {attempts.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No failed attempts</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
