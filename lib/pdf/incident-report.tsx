import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

Font.register({
  family: 'Helvetica',
  src: undefined as any, // use built-in
})

const S = StyleSheet.create({
  page:        { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  header:      { marginBottom: 20 },
  title:       { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle:    { fontSize: 11, color: '#475569', marginBottom: 2 },
  meta:        { fontSize: 9, color: '#64748b', marginBottom: 16 },
  section:     { marginBottom: 16 },
  sectionTitle:{ fontSize: 12, fontWeight: 'bold', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4 },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  th:          { flex: 1, padding: '5 4', fontWeight: 'bold', backgroundColor: '#f8fafc', fontSize: 9, color: '#475569' },
  td:          { flex: 1, padding: '5 4', fontSize: 9, color: '#334155' },
  badge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 8, fontWeight: 'bold' },
  overstay:    { backgroundColor: '#fee2e2', color: '#b91c1c' },
  denied:      { backgroundColor: '#fef3c7', color: '#92400e' },
  footer:      { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8' },
})

interface IncidentReportProps {
  window: { from: string; to: string }
  filter: { apartment?: string; gate?: string }
  entries: any[]
  attempts: any[]
  generatedBy: string
  buildingName: string
}

export function IncidentReportDocument({
  window: w, filter, entries, attempts, generatedBy, buildingName,
}: IncidentReportProps) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })

  return (
    <Document title="Incident Evidence Report" author={generatedBy}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>Incident Evidence Report</Text>
          <Text style={S.subtitle}>{buildingName}</Text>
          <Text style={S.meta}>Window: {w.from} → {w.to}</Text>
          {filter.apartment && <Text style={S.meta}>Apartment filter: {filter.apartment}</Text>}
          {filter.gate && <Text style={S.meta}>Gate filter: {filter.gate}</Text>}
          <Text style={S.meta}>Generated: {now} · By: {generatedBy}</Text>
          <Text style={S.meta}>
            This document is an automated evidence export from SecureEntry VMS.
            For GD/FIR submissions, present with supporting CCTV footage.
          </Text>
        </View>

        {/* Entry/Exit log */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Entry / Exit Records ({entries.length})</Text>
          {/* Table header */}
          <View style={[S.row, { backgroundColor: '#f8fafc' }]}>
            {['Time In','Time Out','Visitor','Apartment','Resident','Guard','Gate','ID Type','Status','Photo'].map((h) => (
              <Text key={h} style={S.th}>{h}</Text>
            ))}
          </View>
          {entries.map((e: any) => (
            <View key={e.id} style={S.row} wrap={false}>
              <Text style={S.td}>{fmtShort(e.entry_time)}</Text>
              <Text style={S.td}>{e.exit_time ? fmtShort(e.exit_time) : '—'}</Text>
              <Text style={S.td}>{e.guest_pass?.guest_name ?? e.visit_request?.visitor_name ?? '—'}</Text>
              <Text style={S.td}>{e.guest_pass?.apartment_number ?? '—'}</Text>
              <Text style={S.td}>{e.guest_pass?.resident?.full_name ?? '—'}</Text>
              <Text style={S.td}>{e.security_guard?.full_name ?? '—'}</Text>
              <Text style={S.td}>{e.gate ?? '—'}</Text>
              <Text style={S.td}>{e.id_type ?? '—'}</Text>
              <Text style={[S.td, e.status === 'overstay' ? S.overstay : {}]}>{e.status}</Text>
              <Text style={S.td}>{e.entry_photo_url ? 'Yes' : 'No'}</Text>
            </View>
          ))}
          {entries.length === 0 && <Text style={{ ...S.td, color: '#94a3b8' }}>No entries in this window</Text>}
        </View>

        {/* Failed attempts */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Denied / Failed Attempts ({attempts.length})</Text>
          <View style={[S.row, { backgroundColor: '#f8fafc' }]}>
            {['Time','Token Used','Result','Guard','Pass'].map((h) => (
              <Text key={h} style={S.th}>{h}</Text>
            ))}
          </View>
          {attempts.map((a: any) => (
            <View key={a.id} style={S.row} wrap={false}>
              <Text style={S.td}>{fmtShort(a.created_at)}</Text>
              <Text style={S.td}>{a.token_used ? a.token_used.slice(0, 12) + '…' : '—'}</Text>
              <Text style={[S.td, S.denied]}>{a.result}</Text>
              <Text style={S.td}>{a.guard?.full_name ?? '—'}</Text>
              <Text style={S.td}>{a.pass?.guest_name ?? '—'}</Text>
            </View>
          ))}
          {attempts.length === 0 && <Text style={{ ...S.td, color: '#94a3b8' }}>No failed attempts</Text>}
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text>SecureEntry VMS — Confidential</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function fmtShort(ts?: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'Asia/Dhaka',
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
}
