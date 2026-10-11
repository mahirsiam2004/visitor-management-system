'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Settings, Save } from 'lucide-react'
import { getPolicy, updatePolicy } from '@/app/actions/policy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import PageHeader from '@/components/layout/PageHeader'
import type { PolicySettings } from '@/types'

type EditablePolicy = Omit<PolicySettings, 'id' | 'updated_by' | 'updated_at'>

const FIELDS: { key: keyof EditablePolicy; label: string; unit?: string; type?: 'checkbox' | 'number' }[] = [
  { key: 'overstay_grace_minutes',           label: 'Overstay Grace Period',              unit: 'minutes' },
  { key: 'overstay_penalty_rate_bdt',        label: 'Penalty Rate',                       unit: 'BDT/hour' },
  { key: 'overstay_notify_admin_after_minutes', label: 'Notify Admin After',              unit: 'minutes of overstay' },
  { key: 'ending_soon_warn_minutes',         label: '"Ending Soon" Warning',              unit: 'minutes before expiry' },
  { key: 'max_pass_duration_hours',          label: 'Max Pass Duration',                  unit: 'hours' },
  { key: 'max_extensions_resident',          label: 'Resident Self-Approve Extensions',   unit: 'max (rest need admin)' },
  { key: 'max_total_stay_hours',             label: 'Max Total Stay (with extensions)',    unit: 'hours' },
  { key: 'delivery_reply_minutes',           label: 'Delivery Reply Window',              unit: 'minutes' },
  { key: 'delivery_access_window_min',       label: 'Delivery Access Window',             unit: 'minutes after approval' },
  { key: 'walk_in_reply_minutes',            label: 'Walk-in Reply Window',               unit: 'minutes' },
  { key: 'event_approval_threshold',         label: 'Event Approval Threshold',           unit: 'guests' },
  { key: 'max_sms_per_resident_per_day',     label: 'Max SMS per Resident',               unit: 'per day' },
  { key: 'photo_retention_days',             label: 'Entry Photo Retention',              unit: 'days' },
  { key: 'penalty_enabled',                  label: 'Enable Penalty System',              type: 'checkbox' },
  { key: 'sms_critical_only',                label: 'SMS for Critical Events Only',       type: 'checkbox' },
]

export default function PolicyPage() {
  const [policy, setPolicy]   = useState<EditablePolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    getPolicy().then((res) => {
      if (res.success) setPolicy(res.data as EditablePolicy)
      else toast.error(res.error)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!policy) return
    setSaving(true)
    const res = await updatePolicy(policy)
    setSaving(false)
    if (res.success) toast.success('Policy saved — changes take effect immediately')
    else toast.error(res.error)
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading policy…</div>
  if (!policy) return null

  const sections = [
    { title: 'Overstay & Penalties', keys: ['overstay_grace_minutes','overstay_penalty_rate_bdt','overstay_notify_admin_after_minutes','ending_soon_warn_minutes','penalty_enabled'] },
    { title: 'Pass Limits', keys: ['max_pass_duration_hours','max_extensions_resident','max_total_stay_hours'] },
    { title: 'Delivery & Walk-in', keys: ['delivery_reply_minutes','delivery_access_window_min','walk_in_reply_minutes'] },
    { title: 'Events', keys: ['event_approval_threshold'] },
    { title: 'Notifications & Storage', keys: ['max_sms_per_resident_per_day','sms_critical_only','photo_retention_days'] },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Policy Settings" description="Global configuration — all changes are audit logged">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
        ⚠️ Changes take effect immediately for all future cron runs and resident actions.
      </div>

      {sections.map((section) => {
        const sectionFields = FIELDS.filter((f) => section.keys.includes(f.key as string))
        return (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sectionFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">{field.label}</label>
                    {field.unit && <p className="text-xs text-slate-400">{field.unit}</p>}
                  </div>
                  {field.type === 'checkbox' ? (
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={!!(policy as any)[field.key]}
                        onChange={(e) => setPolicy((p) => p ? { ...p, [field.key]: e.target.checked } : p)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-blue-600 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                    </label>
                  ) : (
                    <Input
                      type="number"
                      className="w-32 text-right"
                      value={(policy as any)[field.key] ?? ''}
                      min={0}
                      onChange={(e) => setPolicy((p) => p ? { ...p, [field.key]: Number(e.target.value) } : p)}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
